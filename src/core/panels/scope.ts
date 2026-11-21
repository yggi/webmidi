/**
 * What a panel's names mean where they stand (decision 005), shared by the editor's operations (`edit.ts`,
 * `templates.ts`), and not part of the surface: the one scoped walk of the names a node's expressions read
 * (`mapNames`: a name is bound by the nearest group that repeats over it, and free otherwise), what it is used for
 * (`freeNames` collects, `templates.ts` renames and substitutes), the parameters in scope at a place, the templates a
 * node uses, and how deep groups go.
 */
import { isGroup, type NodePath, type Num, type Panel, type PanelNode } from './model';

/** A name the reader keeps: a letter or `_`, then letters, digits and `_`, at most 32. Any other is dropped, and with it the key. */
export const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const NAME_RULE = 'A name starts with a letter or _, then letters, digits and _, up to 32 characters.';

/** The children a path's top is among: the panel's, or a template's (undefined: no such template). */
export const topChildren = (panel: Panel, path: NodePath): readonly PanelNode[] | undefined =>
  path.template === undefined ? panel.children : panel.templates && Object.hasOwn(panel.templates, path.template) ? panel.templates[path.template]!.children : undefined;

/** A number, a name, or a function's name followed by `(`: the pieces of an expression that matter here. */
const PIECE = /(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?/g;

/** An expression, or the `{…}` of a label, with each name it reads (not a function's) given by `to`. */
export function renameIn(source: string, braced: boolean, to: (name: string) => string): string {
  const part = (s: string) =>
    s.replace(PIECE, (m: string, _number: string | undefined, id: string | undefined, call: string | undefined) => (id === undefined || call !== undefined ? m : to(id)));
  return braced ? source.replace(/\{([^{}]*)\}/g, (_m: string, inner: string) => `{${part(inner)}}`) : part(source);
}

/** What `mapNames` asks about each name an expression reads: its text there, given the names bound by the repeats around it. */
export type NameMap = (name: string, bound: ReadonlySet<string>) => string;

/**
 * A node with every name its expressions read replaced by `to`'s answer (the name itself leaves it as it was): a
 * control's label, binding numbers, ranges and channels; a group's label, overrides' labels, channel, `with` values and
 * children read the scope the group stands in and its own repeat's name, its repeat's bounds the scope alone. `bound`
 * is what the groups around the node repeat over. A group that uses a template has no children of its own here.
 */
export function mapNames(node: PanelNode, to: NameMap, bound: ReadonlySet<string> = new Set()): PanelNode {
  const text = (v: Num, at: ReadonlySet<string>, braced = false): Num => (typeof v === 'string' ? renameIn(v, braced, (n) => to(n, at)) : v);
  if (!isGroup(node)) {
    return {
      ...node,
      ...(node.label !== undefined ? { label: text(node.label, bound, true) as string } : {}),
      ...(node.bind
        ? {
            bind: node.bind.map((b) => ({
              ...b,
              ...(b.number !== undefined ? { number: text(b.number, bound) } : {}),
              ...(b.channel !== undefined ? { channel: text(b.channel, bound) } : {}),
              ...(b.range ? { range: [text(b.range[0], bound), text(b.range[1], bound)] as const } : {}),
            })),
          }
        : {}),
    };
  }
  const inner = node.repeat ? new Set([...bound, node.repeat.name]) : bound;
  return {
    ...node,
    ...(node.label !== undefined ? { label: text(node.label, inner, true) as string } : {}),
    ...(node.repeat ? { repeat: { ...node.repeat, from: text(node.repeat.from, bound), to: text(node.repeat.to, bound) } } : {}),
    ...(node.channel !== undefined ? { channel: text(node.channel, inner) } : {}),
    ...(node.overrides
      ? { overrides: Object.fromEntries(Object.entries(node.overrides).map(([k, o]) => [k, o.label === undefined ? o : { ...o, label: text(o.label, inner, true) as string }])) }
      : {}),
    ...(node.with ? { with: Object.fromEntries(Object.entries(node.with).map(([k, v]) => [k, text(v, inner)])) } : {}),
    ...(node.use === undefined && node.children ? { children: node.children.map((c) => mapNames(c, to, inner)) } : {}),
  };
}

/** The parameters a node reads from the place it stands in: its own repeat's are its own. */
export function freeNames(node: PanelNode): Set<string> {
  const free = new Set<string>();
  mapNames(node, (name, bound) => (bound.has(name) || free.add(name), name));
  return free;
}

/** The parameters in scope for the children kept at a container: a template's, and the repeats of the groups on the way down. */
export function scopeOf(panel: Panel, container: NodePath): Set<string> {
  const names = new Set(container.template === undefined ? [] : (panel.templates?.[container.template]?.params ?? []));
  let children = topChildren(panel, container) ?? [];
  for (const i of container.at) {
    const n = children[i];
    if (!n || !isGroup(n)) break;
    if (n.repeat) names.add(n.repeat.name);
    children = n.children ?? [];
  }
  return names;
}

/** The templates a node uses, and those they use, and so on. */
export function usedBy(panel: Panel, node: PanelNode, seen = new Set<string>()): Set<string> {
  if (!isGroup(node)) return seen;
  if (node.use !== undefined) {
    if (!seen.has(node.use)) {
      seen.add(node.use);
      for (const c of panel.templates?.[node.use]?.children ?? []) usedBy(panel, c, seen);
    }
  } else for (const c of node.children ?? []) usedBy(panel, c, seen);
  return seen;
}

/** How many groups deep a node's own groups go: a control none, a group one more than its deepest child (a template's, counted for a group that uses one). */
export function height(panel: Panel, node: PanelNode, seen: readonly string[] = []): number {
  if (!isGroup(node)) return 0;
  if (node.use === undefined) return 1 + Math.max(0, ...(node.children ?? []).map((c) => height(panel, c, seen)));
  if (seen.includes(node.use)) return 1;
  return 1 + Math.max(0, ...(panel.templates?.[node.use]?.children ?? []).map((c) => height(panel, c, [...seen, node.use!])));
}

/** The depth the reader reads the children kept at a container at (top is 1); a template's are counted where it is used, the deepest use. */
export function depthAt(panel: Panel, container: NodePath, seen: readonly string[] = []): number {
  if (container.template === undefined) return container.at.length + 1;
  if (seen.includes(container.template)) return 1;
  const template = container.template;
  let base = 1;
  const walk = (children: readonly PanelNode[], home: NodePath) =>
    children.forEach((n, i) => {
      if (!isGroup(n)) return;
      if (n.use === template) base = Math.max(base, depthAt(panel, home, [...seen, template]) + 1);
      if (n.use === undefined) walk(n.children ?? [], { ...home, at: [...home.at, i] });
    });
  walk(panel.children, { at: [] });
  for (const [name, t] of Object.entries(panel.templates ?? {})) walk(t.children, { template: name, at: [] });
  return base + container.at.length;
}
