/**
 * A group made a template, detached, and a template's names changed (decision 005, the editor's pure part, as
 * `edit.ts`): each operation takes a panel and a place and gives a new panel, as it was for a place that isn't there or
 * one that is refused, and each has a `…Problem` that says the refusal in words. What plays is unchanged by every one.
 *
 * - `extractTemplate`: a group's children go into a new template, whose parameters are the names they read that the
 *   group's scope gave (its repeat's, its parents', its template's), and the group `use`s it, giving each its own name
 *   (`with: { ch: 'ch' }`), so each reads what it read.
 * - `detachTemplate`: a group that uses a template holds a copy of its children, each `with` value put in place of its
 *   parameter (a number as written, a name as it is, any other expression in parentheses). That is exact for every value
 *   but a division (`/`, `%`: a division by 0 is 0 only as a whole, so a copy could play differently), which is
 *   refused, as are a value the group's scope can't read, a parameter not given, and a name the copy would capture (a
 *   repeat inside the template of the same name). The template stays for the groups that use it, and goes when none does.
 * - `renameTemplate` and `renameParam`: every `use`, every `with` key and every expression that read the name follows;
 *   a name a repeat inside the template binds is that repeat's own, and left.
 */
import { compileExpression } from './expr';
import { nodeAt, updateNode } from './edit';
import { isGroup, MAX_DEPTH, readPanel, type Group, type NodePath, type Num, type Panel, type PanelNode, type Template } from './model';
import { depthAt, freeNames, height, mapNames, NAME, NAME_RULE, renameIn, scopeOf, usedBy } from './scope';

/** A refusal in words, or the panel the operation made. */
type Plan = string | Panel;

const made = (panel: Panel, plan: Plan): Panel => (typeof plan === 'string' ? panel : plan);
const problem = (plan: Plan): string | undefined => (typeof plan === 'string' ? plan : undefined);

/** Whether two values are the same data, whatever the order of the keys and the fields left undefined. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const [x, y] = [a, b] as [Record<string, unknown>, Record<string, unknown>];
  const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined);
  return keys(x).length === keys(y).length && keys(x).every((k) => same(x[k], y[k]));
}

/** What would be written, if the reader would keep all of it of a panel it kept all of; else the words for why not. */
const READ_BACK = 'It wouldn’t be read back whole: an expression or a label would be too long.';
const kept = (before: Panel, after: Panel): boolean => !same(readPanel(before), before) || same(readPanel(after), after);

/** The panel with its templates changed, none left when none is. */
function withTemplates(panel: Panel, templates: Record<string, Template>): Panel {
  const { templates: _old, ...rest } = panel;
  return Object.keys(templates).length ? { ...rest, templates } : rest;
}

/** The groups' `use` through a list of nodes, inline groups' children too. */
function anyUse(nodes: readonly PanelNode[], name: string): boolean {
  return nodes.some((n) => isGroup(n) && (n.use === name || (n.use === undefined && anyUse(n.children ?? [], name))));
}

/** A list of nodes with every group's change applied, inline groups' children too. */
const eachGroup = (nodes: readonly PanelNode[], change: (g: Group) => Group): PanelNode[] =>
  nodes.map((n) => {
    if (!isGroup(n)) return n;
    const g = change(n);
    return g.use === undefined && g.children ? { ...g, children: eachGroup(g.children, change) } : g;
  });

const hasTemplate = (panel: Panel, name: string): boolean => !!panel.templates && Object.hasOwn(panel.templates, name);

// ---- make a template ----

function planExtract(panel: Panel, path: NodePath, name: string): Plan {
  const node = nodeAt(panel, path);
  if (!node) return panel;
  if (!isGroup(node)) return 'Only a group can be made a template.';
  if (node.use !== undefined) return `This group already uses the template “${node.use}”.`;
  if (name === '') return 'A template needs a name.';
  if (!NAME.test(name)) return NAME_RULE;
  if (hasTemplate(panel, name)) return `“${name}” is already a template.`;
  if (path.template !== undefined && usedBy(panel, node).has(path.template)) return 'That template would use itself.';
  const children = node.children ?? [];
  const scope = scopeOf(panel, path);
  const params = [...new Set(children.flatMap((c) => [...freeNames(c)]))].filter((n) => scope.has(n));
  const { children: _children, ...rest } = node;
  const used: Group = { ...rest, use: name, ...(params.length ? { with: Object.fromEntries(params.map((p) => [p, p])) } : {}) };
  const template: Template = { params, ...(node.columns !== undefined ? { columns: node.columns } : {}), children };
  const changed = updateNode(panel, path, () => used);
  return { ...changed, templates: { ...changed.templates, [name]: template } };
}

/**
 * Why the group at `path` can't be made a template of this name, in words; undefined when it can. It must be a group
 * that holds its children, the name one the reader keeps and no template's, and the template it stands in not one it
 * would then use.
 */
export const templateProblem = (panel: Panel, path: NodePath, name: string): string | undefined => problem(planExtract(panel, path, name));

/**
 * The group at `path` made a template of this name: its children move into it, with the names they read that the
 * group's scope gave as its parameters, and the group uses it, giving each its own name. The group keeps its repeat,
 * channel, label, overrides and columns (the template has the columns too). As it was when `templateProblem` has
 * something to say.
 */
export const extractTemplate = (panel: Panel, path: NodePath, name: string): Panel => made(panel, planExtract(panel, path, name));

// ---- detach ----

/** How a `with` value stands in an expression in the place of its parameter, or the words for why it can't. */
function written(parameter: string, value: Num): { text: string } | { problem: string } {
  if (typeof value === 'number') {
    const digits = String(Math.abs(value));
    if (/e/.test(digits)) return { problem: `“${parameter}”: ${value} can’t be written as an expression.` };
    return { text: value < 0 ? `(-${digits})` : digits };
  }
  const v = value.trim();
  return { text: /^([A-Za-z_][A-Za-z0-9_]*|\d+(\.\d+)?|\.\d+)$/.test(v) ? v : `(${v})` };
}

function planDetach(panel: Panel, path: NodePath): Plan {
  const node = nodeAt(panel, path);
  if (!node) return panel;
  if (!isGroup(node)) return 'Only a group can be detached from a template.';
  if (node.use === undefined) return 'This group doesn’t use a template.';
  const template = hasTemplate(panel, node.use) ? panel.templates![node.use]! : undefined;
  if (!template) return `There is no template “${node.use}”.`;
  if (path.template !== undefined && usedBy(panel, node).has(path.template)) return 'That template would use itself.';
  const scope = [...scopeOf(panel, path)];
  const given = node.with ?? {};
  const put = new Map<string, { text: string; reads: string[] }>();
  for (const p of template.params) {
    if (!Object.hasOwn(given, p)) return `The group doesn’t give “${p}”, which the template needs.`;
    const value = given[p]!;
    if (typeof value === 'string') {
      const e = compileExpression(value, scope);
      if (typeof e === 'string') return `“${p}”: ${e}`;
      if (/[/%]/.test(value)) return `“${p}” has a division (/ or %), which can’t be put in the template’s place exactly: a division by 0 is 0 only as a whole.`;
    }
    const w = written(p, value);
    if ('problem' in w) return w.problem;
    const reads: string[] = [];
    if (typeof value === 'string') renameIn(value, false, (n) => (reads.push(n), n));
    put.set(p, { text: w.text, reads });
  }
  let captured: string | undefined;
  const children = template.children.map((c) =>
    mapNames(c, (name, bound) => {
      const p = put.get(name);
      if (!p || bound.has(name)) return name;
      captured ??= p.reads.find((r) => bound.has(r));
      return p.text;
    }),
  );
  if (captured !== undefined) return `“${captured}” would mean the repeat inside the template.`;
  if (depthAt(panel, path) + Math.max(0, ...template.children.map((c) => height(panel, c))) > MAX_DEPTH) return `Groups nest at most ${MAX_DEPTH} deep.`;
  const { use: _use, with: _with, ...rest } = node;
  const columns = node.columns ?? template.columns;
  const inline: Group = { ...rest, ...(columns !== undefined ? { columns } : {}), children };
  const changed = updateNode(panel, path, () => inline);
  const stays = anyUse(changed.children, node.use) || Object.values(changed.templates ?? {}).some((t) => anyUse(t.children, node.use!));
  const result = stays ? changed : withTemplates(changed, Object.fromEntries(Object.entries(changed.templates ?? {}).filter(([k]) => k !== node.use)));
  return kept(panel, result) ? result : READ_BACK;
}

/**
 * Why the group at `path` can't be detached from its template, in words; undefined when it can. It must use a template
 * that is there, give every parameter a value its scope reads that goes in the parameter's place exactly (no division,
 * no name a repeat inside the template would capture), and hold the template's children at a depth the reader reads.
 */
export const detachProblem = (panel: Panel, path: NodePath): string | undefined => problem(planDetach(panel, path));

/**
 * The group at `path` holding a copy of its template's children, its `with` values in place of the parameters, so what
 * plays is the same. The template stays for the groups that still use it and is taken out of the panel when none
 * does. As it was when `detachProblem` has something to say.
 */
export const detachTemplate = (panel: Panel, path: NodePath): Panel => made(panel, planDetach(panel, path));

// ---- rename ----

function planRenameTemplate(panel: Panel, from: string, to: string): Plan {
  if (!hasTemplate(panel, from)) return `There is no template “${from}”.`;
  if (from === to) return panel;
  if (!NAME.test(to)) return NAME_RULE;
  if (hasTemplate(panel, to)) return `“${to}” is already a template.`;
  const follow = (g: Group): Group => (g.use === from ? { ...g, use: to } : g);
  return {
    ...panel,
    templates: Object.fromEntries(Object.entries(panel.templates!).map(([k, t]) => [k === from ? to : k, { ...t, children: eachGroup(t.children, follow) }])),
    children: eachGroup(panel.children, follow),
  };
}

/** Why a template can't be called this, in words; undefined when it can: there is one of that name, the name is one the reader keeps, and no template has it. */
export const renameTemplateProblem = (panel: Panel, from: string, to: string): string | undefined => problem(planRenameTemplate(panel, from, to));

/** A template under another name, every group that uses it following. As it was when `renameTemplateProblem` has something to say. */
export const renameTemplate = (panel: Panel, from: string, to: string): Panel => made(panel, planRenameTemplate(panel, from, to));

function planRenameParam(panel: Panel, name: string, from: string, to: string): Plan {
  if (!hasTemplate(panel, name)) return `There is no template “${name}”.`;
  const template = panel.templates![name]!;
  if (!template.params.includes(from)) return `The template “${name}” has no parameter “${from}”.`;
  if (from === to) return panel;
  if (!NAME.test(to)) return NAME_RULE;
  if (template.params.includes(to)) return `“${to}” is already a parameter of “${name}”.`;
  let trouble: string | undefined;
  const children = template.children.map((c) =>
    mapNames(c, (n, bound) => {
      if (n === to && !bound.has(n)) trouble ??= `“${to}” is already read by the template.`;
      if (n !== from || bound.has(n)) return n;
      if (bound.has(to)) trouble ??= `“${to}” would mean the repeat inside the template.`;
      return to;
    }),
  );
  if (trouble !== undefined) return trouble;
  const follow = (g: Group): Group => {
    if (g.use !== name || !g.with || !Object.hasOwn(g.with, from)) return g;
    return { ...g, with: Object.fromEntries(Object.entries(g.with).flatMap(([k, v]) => (k === to ? [] : [[k === from ? to : k, v] as const]))) };
  };
  const result: Panel = {
    ...panel,
    templates: { ...panel.templates, [name]: { ...template, params: template.params.map((p) => (p === from ? to : p)), children: eachGroup(children, follow) } },
  };
  const everywhere: Panel = {
    ...result,
    templates: Object.fromEntries(Object.entries(result.templates!).map(([k, t]) => [k, k === name ? t : { ...t, children: eachGroup(t.children, follow) }])),
    children: eachGroup(panel.children, follow),
  };
  return kept(panel, everywhere) ? everywhere : READ_BACK;
}

/**
 * Why a template’s parameter can't be called this, in words; undefined when it can: the template has the parameter,
 * the name is one the reader keeps, no parameter has it, the template doesn't read it already, and no repeat inside
 * binds it around a place the parameter is read.
 */
export const renameParamProblem = (panel: Panel, template: string, from: string, to: string): string | undefined => problem(planRenameParam(panel, template, from, to));

/** A template's parameter under another name: every expression in the template and every `with` of the groups that use it follows. As it was when `renameParamProblem` has something to say. */
export const renameParam = (panel: Panel, template: string, from: string, to: string): Panel => made(panel, planRenameParam(panel, template, from, to));
