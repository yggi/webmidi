/**
 * A panel edited (decision 005, the editor's pure part): each operation takes a panel and a place (`NodePath`) and
 * gives a new panel, so an editor keeps nothing of its own but what is selected. A place inside a template is the
 * template's, so a change there is a change to every group that uses it; adding into a group that uses a template
 * adds to the template. An operation on a place that isn't there gives the panel as it was. A node moves among its
 * siblings, or into another group or out of its own, as one operation (`moveNode`), refused in words (`moveProblem`)
 * wherever it would change what the node means or what the reader keeps. The label of one instance of a repeated group
 * is set or cleared by its value (`setOverride`), refused in words where the repeat doesn't give it (`overrideProblem`).
 */
import {
  BINDING_KINDS,
  isGroup,
  MAX_DEPTH,
  MAX_GRID,
  MAX_OVERRIDES,
  type Binding,
  type Control,
  type ControlType,
  type Group,
  type NodePath,
  type Panel,
  type PanelNode,
} from './model';
import { instantiate, MAX_NUMBER, type InstanceNode, type PanelInstance } from './instantiate';
import { depthAt, freeNames, height, NAME, NAME_RULE, scopeOf, topChildren, usedBy } from './scope';

export const samePath = (a: NodePath | null | undefined, b: NodePath | null | undefined): boolean =>
  !!a && !!b && a.template === b.template && a.at.length === b.at.length && a.at.every((n, i) => n === b.at[i]);

/** The node at a place, or undefined: nothing there, or the empty path (which is the panel or the template itself). */
export function nodeAt(panel: Panel, path: NodePath): PanelNode | undefined {
  let children = topChildren(panel, path);
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
  if (!path.at.length) return topChildren(panel, path) ? path : undefined;
  const node = nodeAt(panel, path);
  if (!node || !isGroup(node)) return undefined;
  return node.use === undefined ? path : containerOf(panel, { template: node.use, at: [] });
}

/** The children kept at a container's place (`containerOf`), or undefined. */
export function childrenAt(panel: Panel, container: NodePath): readonly PanelNode[] | undefined {
  if (!container.at.length) return topChildren(panel, container);
  const node = nodeAt(panel, container);
  return node && isGroup(node) && node.use === undefined ? (node.children ?? []) : undefined;
}

/** The panel with the children at a container's place changed; as it was when the place holds none. */
function withChildren(panel: Panel, container: NodePath, change: (children: readonly PanelNode[]) => readonly PanelNode[]): Panel {
  if (childrenAt(panel, container) === undefined) return panel;
  const down = (children: readonly PanelNode[], at: readonly number[]): readonly PanelNode[] =>
    at.length ? children.map((n, i) => (i === at[0] && isGroup(n) ? { ...n, children: down(n.children ?? [], at.slice(1)) } : n)) : change(children);
  const changed = down(topChildren(panel, container)!, container.at);
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

/** Where a node goes: among a container's children (`containerOf`), at the index it will have there once it has moved. */
export interface Destination {
  readonly container: NodePath;
  readonly index: number;
}

/** A path moved for an insertion at `index` among `container`'s children (`by` 1), or the taking out of the child there (`by` -1). */
function shifted(path: NodePath, container: NodePath, index: number, by: 1 | -1): NodePath {
  const n = container.at.length;
  const inside = path.template === container.template && path.at.length > n && container.at.every((x, i) => path.at[i] === x);
  return inside && path.at[n]! >= index + (by === 1 ? 0 : 1) ? { ...path, at: path.at.map((x, i) => (i === n ? x + by : x)) } : path;
}

/**
 * Why a node can't go among the children kept at a container, in words; undefined when it can. Not into itself or a
 * group inside it, not where a sibling has its name (`nameProblem`'s rules: a control and a group share one key space,
 * a control with no name is kept by its place), not where it would read a parameter that place doesn't have (a
 * template's own, a repeat's: they are the same name in another place only by chance, so it is the name that is held),
 * not into a template that it, or what it holds, uses, and not deeper than the reader reads (`MAX_DEPTH`).
 */
export function moveProblem(panel: Panel, path: NodePath, container: NodePath): string | undefined {
  const node = nodeAt(panel, path);
  if (!node) return undefined;
  const siblings = childrenAt(panel, container);
  if (!siblings) return 'That isn’t a group.';
  if (path.template === container.template && container.at.length >= path.at.length && path.at.every((x, i) => container.at[i] === x))
    return 'A group can’t go into itself or into a group inside it.';
  if (container.template !== undefined && usedBy(panel, node).has(container.template)) return 'That template would use itself.';
  const wanted = isGroup(node) ? node.group : node.id;
  const own = samePath(parentOf(path), container) ? indexOf(path) : -1;
  const taken = wanted === undefined ? undefined : siblings.find((n, i) => i !== own && (isGroup(n) ? n.group : n.id) === wanted);
  if (taken)
    return `“${wanted}” is already the name of a ${isGroup(taken) ? 'group' : 'control'} in ${container.at.length ? 'the group' : container.template === undefined ? 'the panel' : 'the template'}.`;
  const scope = scopeOf(panel, container);
  const missing = [...freeNames(node)].find((n) => !scope.has(n));
  if (missing !== undefined) return `It uses “${missing}”, which is not set in that place.`;
  if (depthAt(panel, container) + height(panel, node) > MAX_DEPTH) return `Groups nest at most ${MAX_DEPTH} deep.`;
  return undefined;
}

/**
 * A node moved: one earlier (`-1`) or later (`1`) among its siblings, or to a destination, into any container (its own
 * parent's too: a place among its siblings is one case of it). The panel, and the node's place now; as it was at an end,
 * for a place that isn't there, or when `moveProblem` has something to say.
 */
export function moveNode(panel: Panel, path: NodePath, to: -1 | 1 | Destination): { panel: Panel; path: NodePath } {
  const node = nodeAt(panel, path);
  const parent = parentOf(path);
  const from = indexOf(path);
  const siblings = childrenAt(panel, parent);
  if (!node || !siblings) return { panel, path };
  const where: Destination = typeof to === 'number' ? { container: parent, index: from + to } : to;
  const kept = samePath(where.container, parent) ? siblings.length - 1 : (childrenAt(panel, where.container)?.length ?? 0);
  if (typeof to === 'number' && (where.index < 0 || where.index > kept)) return { panel, path };
  if (moveProblem(panel, path, where.container) !== undefined) return { panel, path };
  const index = Math.max(0, Math.min(kept, where.index));
  // inserted first, so the container's own place can't have moved; then the node taken from where it was, shifted for that
  const at = samePath(where.container, parent) && index > from ? index + 1 : index;
  const put = insertNode(panel, where.container, node, at);
  const old = shifted(path, where.container, at, 1);
  const moved = shifted(put.path, parentOf(old), indexOf(old), -1);
  return { panel: removeNode(put.panel, old), path: moved };
}

/** Where moving a node out of its group goes: right after that group, in the container the group is in; none at the top of the panel or a template. */
export function moveOutOf(panel: Panel, path: NodePath): Destination | undefined {
  const parent = parentOf(path);
  return nodeAt(panel, path) && parent.at.length ? { container: parentOf(parent), index: indexOf(parent) + 1 } : undefined;
}

/** The groups a node can go into, by name (a group of a template, and one that uses it, are the template's body): not the one it is in, nor one it is refused (`moveProblem`). */
export function moveTargets(panel: Panel, path: NodePath): { group: NodePath; name: string }[] {
  const home = containerOf(panel, parentOf(path));
  const out: { group: NodePath; name: string }[] = [];
  const walk = (template: string | undefined, children: readonly PanelNode[], at: number[], names: string[]) =>
    children.forEach((n, i) => {
      if (!isGroup(n)) return;
      const group: NodePath = { ...(template === undefined ? {} : { template }), at: [...at, i] };
      const here = [...names, n.group];
      const container = containerOf(panel, group);
      if (container && !(home && samePath(container, home)) && !out.some((o) => samePath(containerOf(panel, o.group), container)) && !moveProblem(panel, path, container))
        out.push({ group, name: `${here.join(' / ')}${n.use === undefined ? '' : ` (template ${n.use})`}` });
      if (n.use === undefined) walk(template, n.children ?? [], [...at, i], here);
    });
  if (!nodeAt(panel, path)) return out;
  walk(undefined, panel.children, [], []);
  for (const [name, t] of Object.entries(panel.templates ?? {})) walk(name, t.children, [], [`template ${name}`]);
  return out;
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

/**
 * Why a name asked for, for the control or group at `path`, can't be taken, in words; undefined when it can. It must be
 * a name the reader keeps, and no sibling's: a control and a group beside each other share one key space, and
 * instantiating leaves the second of two under one name out. A control may have none (it is then kept by its place), a
 * group may not.
 */
export function nameProblem(panel: Panel, path: NodePath, wanted: string): string | undefined {
  const node = nodeAt(panel, path);
  if (!node) return undefined;
  if (wanted === '') return isGroup(node) ? 'A group needs a name.' : undefined;
  if (!NAME.test(wanted)) return NAME_RULE;
  const own = path.at.at(-1);
  const siblings = childrenAt(panel, { ...path, at: path.at.slice(0, -1) }) ?? [];
  const taken = siblings.find((n, i) => i !== own && (isGroup(n) ? n.group : n.id) === wanted);
  return taken ? `“${wanted}” is already the name of a ${isGroup(taken) ? 'group' : 'control'} beside it.` : undefined;
}

/** The plain number fields the editor reads strictly: where a control starts, a key or a note, a pad's notes, and how far a control spans a grid. */
export type NumberField = 'start' | 'note' | 'notes' | 'span';

const WHOLE = /^\d+$/;
const DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/;

/**
 * Why a text typed into a plain number field can't be taken, in words; undefined when it can. The reader keeps a value
 * only inside its range, so the editor takes the text as written or not at all: a word, a fraction where a whole number
 * is wanted, or a number out of range is a problem here, never turned into another number. An empty text is no problem
 * (it clears the field), and a pad's notes are a list, each held to a note's range.
 */
export function numberProblem(field: NumberField, text: string): string | undefined {
  const t = text.trim();
  if (t === '') return undefined;
  switch (field) {
    case 'start':
      return DECIMAL.test(t) && Number(t) <= 1 ? undefined : 'Starts at takes a number from 0 to 1.';
    case 'note':
      return WHOLE.test(t) && Number(t) <= 127 ? undefined : 'A note is a whole number from 0 to 127.';
    case 'notes':
      return t
        .split(/[\s,]+/)
        .filter(Boolean)
        .every((n) => WHOLE.test(n) && Number(n) <= 127)
        ? undefined
        : 'Notes are whole numbers from 0 to 127, separated by commas or spaces.';
    case 'span':
      return WHOLE.test(t) && Number(t) >= 1 && Number(t) <= MAX_GRID ? undefined : `A span is a whole number from 1 to ${MAX_GRID}.`;
  }
}

/** What a binding's number may be for its kind, in words, from the limit `instantiate` holds it to; undefined for a kind that has no number. */
export function numberHint(kind: Binding['kind']): string | undefined {
  const max = MAX_NUMBER[kind];
  return max === null ? undefined : `0 to ${max}, or an expression`;
}

/** The value a repeated group's instance stands for, read from its key (`strips[3]`, `play/row[10]`); undefined for a key that isn't one. */
export const repeatValueOf = (key: string): number | undefined => {
  const at = /\[(-?\d+)\]$/.exec(key);
  return at ? Number(at[1]) : undefined;
};

/** The values the group defined at `source` is drawn for, ascending and each once (a group inside a repeat is drawn for each of its values in each outer one): what an override is by. Empty for a group that doesn't repeat. */
export function repeatValues(made: PanelInstance, source: NodePath): number[] {
  const values = new Set<number>();
  const walk = (nodes: readonly InstanceNode[]) => {
    for (const n of nodes) {
      if (n.kind !== 'group') continue;
      const value = repeatValueOf(n.key);
      if (samePath(n.source, source) && value !== undefined) values.add(value);
      walk(n.children);
    }
  };
  walk(made.children);
  return [...values].sort((a, b) => a - b);
}

/**
 * Why the label of one instance, of the group at `path`, can't be set, in words; undefined when it can: the group must
 * repeat, the repeat must give that value, and a group keeps at most `MAX_OVERRIDES` (an empty text clears one, so it is
 * never refused for the count).
 */
export function overrideProblem(panel: Panel, path: NodePath, value: number, label: string): string | undefined {
  const node = nodeAt(panel, path);
  if (!node || !isGroup(node)) return undefined;
  if (!node.repeat) return 'Only a group that repeats has instances.';
  const values = repeatValues(instantiate(panel), path);
  if (!values.length) return 'The repeat gives nothing.';
  if (!values.includes(value)) return `The repeat doesn’t give ${value}: it gives ${values[0]} to ${values.at(-1)}.`;
  const held = node.overrides ?? {};
  if (label.trim() !== '' && !Object.hasOwn(held, String(value)) && Object.keys(held).length >= MAX_OVERRIDES) return `A group keeps at most ${MAX_OVERRIDES} overrides.`;
  return undefined;
}

/** The label of the instance of the group at `path` for `value` set, or removed by an empty text (the last one takes the field with it). As it was (the same panel) when `overrideProblem` has something to say, or when the group already has it so. */
export function setOverride(panel: Panel, path: NodePath, value: number, label: string): Panel {
  if (overrideProblem(panel, path, value, label) !== undefined) return panel;
  const at = String(value);
  const node = nodeAt(panel, path);
  const held = node && isGroup(node) && node.overrides && Object.hasOwn(node.overrides, at) ? node.overrides[at]!.label : undefined;
  if (label.trim() === '' ? held === undefined : held === label) return panel;
  return updateNode(panel, path, (n) => {
    if (!isGroup(n)) return n;
    const { overrides, ...rest } = n;
    const { [at]: _old, ...others } = overrides ?? {};
    const next = label.trim() === '' ? others : { ...others, [at]: { label } };
    return Object.keys(next).length ? { ...rest, overrides: next } : rest;
  });
}
