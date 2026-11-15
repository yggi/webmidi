/**
 * A panel edited (decision 005, the editor's pure part): each operation takes a panel and a place (`NodePath`) and
 * gives a new panel, so an editor keeps nothing of its own but what is selected. A place inside a template is the
 * template's, so a change there is a change to every group that uses it; adding into a group that uses a template
 * adds to the template. An operation on a place that isn't there gives the panel as it was.
 */
import { BINDING_KINDS, isGroup, type Binding, type Control, type ControlType, type Group, type NodePath, type Panel, type PanelNode } from './model';

export const samePath = (a: NodePath | null | undefined, b: NodePath | null | undefined): boolean =>
  !!a && !!b && a.template === b.template && a.at.length === b.at.length && a.at.every((n, i) => n === b.at[i]);

/** The children a path's top is among: the panel's, or a template's (undefined: no such template). */
const top = (panel: Panel, path: NodePath): readonly PanelNode[] | undefined =>
  path.template === undefined ? panel.children : panel.templates && Object.hasOwn(panel.templates, path.template) ? panel.templates[path.template]!.children : undefined;

/** The node at a place, or undefined: nothing there, or the empty path (which is the panel or the template itself). */
export function nodeAt(panel: Panel, path: NodePath): PanelNode | undefined {
  let children = top(panel, path);
  let node: PanelNode | undefined;
  for (const i of path.at) {
    node = children?.[i];
    children = node && isGroup(node) ? node.children : undefined;
  }
  return node;
}

/**
 * Where a node's children are kept: the place itself for the panel, a template, or a group with children inline; the
 * template for a group that uses one; undefined for a control, or nothing there.
 */
export function containerOf(panel: Panel, path: NodePath): NodePath | undefined {
  if (!path.at.length) return top(panel, path) ? path : undefined;
  const node = nodeAt(panel, path);
  if (!node || !isGroup(node)) return undefined;
  return node.use === undefined ? path : containerOf(panel, { template: node.use, at: [] });
}

/** The children kept at a container's place (`containerOf`), or undefined. */
export function childrenAt(panel: Panel, container: NodePath): readonly PanelNode[] | undefined {
  if (!container.at.length) return top(panel, container);
  const node = nodeAt(panel, container);
  return node && isGroup(node) && node.use === undefined ? (node.children ?? []) : undefined;
}

/** The panel with the children at a container's place changed; as it was when the place holds none. */
function withChildren(panel: Panel, container: NodePath, change: (children: readonly PanelNode[]) => readonly PanelNode[]): Panel {
  if (childrenAt(panel, container) === undefined) return panel;
  const down = (children: readonly PanelNode[], at: readonly number[]): readonly PanelNode[] =>
    at.length ? children.map((n, i) => (i === at[0] && isGroup(n) ? { ...n, children: down(n.children ?? [], at.slice(1)) } : n)) : change(children);
  const changed = down(top(panel, container)!, container.at);
  if (container.template === undefined) return { ...panel, children: changed };
  return { ...panel, templates: { ...panel.templates, [container.template]: { ...panel.templates![container.template]!, children: changed } } };
}

const parentOf = (path: NodePath): NodePath => ({ ...path, at: path.at.slice(0, -1) });
const indexOf = (path: NodePath): number => path.at.at(-1) ?? -1;

/** The node at a place changed. */
export function updateNode(panel: Panel, path: NodePath, change: (node: PanelNode) => PanelNode): Panel {
  if (!nodeAt(panel, path)) return panel;
  return withChildren(panel, parentOf(path), (children) => children.map((n, i) => (i === indexOf(path) ? change(n) : n)));
}

/** A node put among a container's children, last or at an index: the panel, and the node's place. */
export function insertNode(panel: Panel, container: NodePath, node: PanelNode, index?: number): { panel: Panel; path: NodePath } {
  const children = childrenAt(panel, container);
  if (!children) return { panel, path: container };
  const at = Math.max(0, Math.min(children.length, index ?? children.length));
  return { panel: withChildren(panel, container, (c) => [...c.slice(0, at), node, ...c.slice(at)]), path: { ...container, at: [...container.at, at] } };
}

export function removeNode(panel: Panel, path: NodePath): Panel {
  if (!nodeAt(panel, path)) return panel;
  return withChildren(panel, parentOf(path), (children) => children.filter((_, i) => i !== indexOf(path)));
}

/** A node moved among its siblings, one earlier (`-1`) or later (`1`): the panel, and its place now (as it was at an end). */
export function moveNode(panel: Panel, path: NodePath, by: -1 | 1): { panel: Panel; path: NodePath } {
  const siblings = childrenAt(panel, parentOf(path));
  const from = indexOf(path);
  const to = from + by;
  if (!siblings || !siblings[from] || to < 0 || to >= siblings.length) return { panel, path };
  const moved = withChildren(panel, parentOf(path), (c) => c.map((n, i) => (i === from ? c[to]! : i === to ? c[from]! : n)));
  return { panel: moved, path: { ...path, at: [...path.at.slice(0, -1), to] } };
}

/** A name no sibling has: the base, or the base with the first free number after it (`knob`, `knob2`). */
function freeName(siblings: readonly PanelNode[], base: string): string {
  const taken = new Set(siblings.map((n) => (isGroup(n) ? n.group : n.id)));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

/** A node again right after itself, under a name of its own: the panel, and the copy's place. */
export function duplicateNode(panel: Panel, path: NodePath): { panel: Panel; path: NodePath } {
  const node = nodeAt(panel, path);
  const siblings = childrenAt(panel, parentOf(path));
  if (!node || !siblings) return { panel, path };
  const copy: PanelNode = isGroup(node) ? { ...node, group: freeName(siblings, node.group) } : { ...node, id: freeName(siblings, node.id ?? node.type) };
  return insertNode(panel, parentOf(path), copy, indexOf(path) + 1);
}

/** The controller numbers a panel's bindings name as plain numbers (an expression's is not known here). */
function controllers(panel: Panel): Set<number> {
  const used = new Set<number>();
  const walk = (children: readonly PanelNode[]) => {
    for (const n of children) {
      if (isGroup(n)) walk(n.children ?? []);
      else for (const b of n.bind ?? []) if ((b.kind === 'cc' || b.kind === 'cc14') && typeof b.number === 'number') used.add(b.number);
    }
  };
  walk(panel.children);
  for (const t of Object.values(panel.templates ?? {})) walk(t.children);
  return used;
}

/** The first controller from 1 that no binding of the panel names, and isn't a channel mode message (120 and up); 1 when all are taken. */
function freeController(panel: Panel, after = 0): number {
  const used = controllers(panel);
  for (let n = Math.max(1, after + 1); n < 120; n++) if (!used.has(n)) return n;
  return 1;
}

/**
 * A new control of a type, to put among `siblings`: named after its type, and bound so it does something at once (a
 * knob, a fader and a switch to the panel's next free controller, an XY pad to the next two, a button to middle C).
 */
export function newControl(panel: Panel, type: ControlType, siblings: readonly PanelNode[]): Control {
  const id = freeName(siblings, type);
  const cc = freeController(panel);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  switch (type) {
    case 'knob':
    case 'fader':
    case 'switch':
      return { type, id, label, bind: [{ kind: 'cc', number: cc }] };
    case 'xy':
      return {
        type,
        id,
        label: 'XY',
        value: 0.5,
        bind: [
          { kind: 'cc', number: cc },
          { kind: 'cc', number: freeController(panel, cc), axis: 'y' },
        ],
      };
    case 'button':
      return { type, id, label, bind: [{ kind: 'note', number: 60 }] };
    default:
      return { type, id, label };
  }
}

/** A new group, to put among `siblings`: empty, its children in a row. */
export const newGroup = (siblings: readonly PanelNode[]): Group => ({ group: freeName(siblings, 'group'), children: [] });

/** A binding of another kind: its number kept where the new kind has one, its range dropped (each kind has its own). */
export function ofKind(binding: Binding, kind: Binding['kind']): Binding {
  if (!BINDING_KINDS.includes(kind)) return binding;
  const numbered = kind !== 'program' && kind !== 'bend' && kind !== 'pressure';
  const { range: _range, number, ...rest } = binding;
  return { ...rest, kind, ...(numbered ? { number: number ?? 1 } : {}) };
}
