/**
 * A control panel as it is kept (decision 005): a layout of controls a person plays, each bound to MIDI messages, both
 * ways. A panel is data, never code, read from anything by `readPanel` (junk dropped field by field, as `readBook`),
 * and it names no port: what it sends goes out on its row of the patch (`panelRow`), and what its column is sent
 * moves its controls.
 *
 * A number may be an expression over the parameters in scope (`expr.ts`). A group nests, lays its children on a grid,
 * may repeat over a parameter, and holds its children inline or takes them from a template with its parameters given:
 * eight mixer strips are one template used by a group repeated eight times, so a change to the strip changes all eight.
 */
import { panelKey } from '../setups';
import { MAX_EXPRESSION } from './expr';

/** A number, or an expression that gives one in the scope it stands in. */
export type Num = number | string;

export const CONTROL_TYPES = ['button', 'switch', 'knob', 'fader', 'xy', 'label', 'keyboard', 'pads'] as const;
/**
 * `button` is on while held and `switch` flips (both on when their value is above 0); `knob` and `fader` are 0 … 1;
 * `xy` has two values; a `label` has none; `keyboard` and `pads` send notes of their own, struck and released.
 */
export type ControlType = (typeof CONTROL_TYPES)[number];

export const BINDING_KINDS = ['cc', 'cc14', 'note', 'program', 'bend', 'pressure', 'nrpn', 'rpn'] as const;
/**
 * What a binding speaks: a control change (`number` 0–127), a 14-bit one (0–31, its fine half 32 above), a note
 * (0–127: on while the control's value is above 0, the value its velocity), a program change, the pitch bend, channel
 * pressure (these three have no `number`), an NRPN or an RPN (0–16383).
 */
export type BindingKind = (typeof BINDING_KINDS)[number];

/**
 * A control's value and a message, both ways: moved, the control sends it; received, it moves the control. The value
 * 0 … 1 is `range[0]` … `range[1]` on the wire, linear, so it reads back (a range may run downward).
 */
export interface Binding {
  readonly kind: BindingKind;
  readonly number?: Num;
  /** By default the whole of what the kind carries: 0 … 127, or 0 … 16383 for `cc14`, `bend`, `nrpn` and `rpn`. */
  readonly range?: readonly [Num, Num];
  /** 1–16; by default the group's, else the panel's, else 1. */
  readonly channel?: Num;
  /** Which of an `xy`'s values, `x` by default. */
  readonly axis?: 'x' | 'y';
}

/** Where a child sits on its parent's grid, from 1, and how many cells it spans; without a place it follows the one before. */
export interface Cell {
  readonly column?: number;
  readonly row?: number;
  readonly columns?: number;
  readonly rows?: number;
}

export interface Control {
  readonly type: ControlType;
  /** Its name among its siblings, in its key; without one its place is. */
  readonly id?: string;
  /** Text; `{…}` holds an expression (`"Ch {ch}"`). */
  readonly label?: string;
  /** Where it starts, 0 … 1 (0 by default). */
  readonly value?: number;
  readonly cell?: Cell;
  readonly bind?: readonly Binding[];
  /** A `keyboard`'s lowest and highest note (48 and 72 by default), a `pads`' notes in order; their channel is the group's. */
  readonly low?: number;
  readonly high?: number;
  readonly notes?: readonly number[];
}

/** A group repeated: once for each whole number `from` … `to`, as the parameter `name`. */
export interface Repeat {
  readonly name: string;
  readonly from: Num;
  readonly to: Num;
}

export interface Group {
  /** Its name, in its children's keys. */
  readonly group: string;
  readonly label?: string;
  readonly repeat?: Repeat;
  /** How many columns its grid has; without it the children stand in one row. */
  readonly columns?: number;
  readonly cell?: Cell;
  /** 1–16, for everything in it. */
  readonly channel?: Num;
  /** What one instance of a repeated group has of its own, by its parameter's value. */
  readonly overrides?: Readonly<Record<string, { readonly label?: string }>>;
  /** Its children, inline: they see the scope the group stands in, and its parameter. */
  readonly children?: readonly PanelNode[];
  /** Or a template's, by name, `with` its parameters given (each read in the group's scope). `use` wins over `children`. */
  readonly use?: string;
  readonly with?: Readonly<Record<string, Num>>;
}

export type PanelNode = Control | Group;

/** Children to be used by groups: they see the template's parameters and nothing else. */
export interface Template {
  readonly params: readonly string[];
  readonly columns?: number;
  readonly children: readonly PanelNode[];
}

export interface Panel {
  readonly id: string;
  readonly name: string;
  /** 1–16, for everything in it (1 by default). */
  readonly channel?: Num;
  readonly columns?: number;
  readonly templates?: Readonly<Record<string, Template>>;
  readonly children: readonly PanelNode[];
}

/**
 * Where a node is defined: its place among the children of the panel, or of one of its templates, as indices down
 * from the top (`[0, 2]`: the third child of the first). The empty path is the panel, or the template, itself.
 */
export interface NodePath {
  readonly template?: string;
  readonly at: readonly number[];
}

/** A panel's row and column in the patch: an active panel is both. */
export const panelRow = panelKey;

export const isGroup = (node: PanelNode): node is Group => 'group' in node;

// ---- bounds ----

/** How deep groups nest, a template's children counted where they are used. */
export const MAX_DEPTH = 16;
/** The longest name, id or label, in characters. */
const MAX_TEXT = 64;
/** The most columns a grid has, and the furthest cell. */
export const MAX_GRID = 64;

// ---- reading ----

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= MAX_TEXT ? v : undefined);
const name = (v: unknown): string | undefined => (typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(v) ? v : undefined);
const num = (v: unknown): Num | undefined =>
  (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && v.length <= MAX_EXPRESSION) ? v : undefined;
/** The fields that are there: one left undefined isn't kept, so a panel read is a panel written. */
const kept = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function cell(v: unknown): Cell | undefined {
  if (!isRecord(v)) return undefined;
  const at = (x: unknown) => (isInt(x, 1, MAX_GRID) ? x : undefined);
  const c = kept({ column: at(v.column), row: at(v.row), columns: at(v.columns), rows: at(v.rows) });
  return Object.keys(c).length ? c : undefined;
}

function binding(v: unknown): Binding | null {
  if (!isRecord(v) || !BINDING_KINDS.includes(v.kind as BindingKind)) return null;
  const lo = Array.isArray(v.range) ? num(v.range[0]) : undefined;
  const hi = Array.isArray(v.range) ? num(v.range[1]) : undefined;
  return kept({
    kind: v.kind as BindingKind,
    number: num(v.number),
    range: lo !== undefined && hi !== undefined ? ([lo, hi] as const) : undefined,
    channel: num(v.channel),
    axis: v.axis === 'y' ? ('y' as const) : undefined,
  });
}

function control(v: Record<string, unknown>): Control {
  const bind = Array.isArray(v.bind) ? v.bind.flatMap((b) => binding(b) ?? []) : [];
  const notes = Array.isArray(v.notes) ? v.notes.filter((n): n is number => isInt(n, 0, 127)).slice(0, MAX_GRID) : [];
  return kept({
    type: v.type as ControlType,
    id: name(v.id),
    label: text(v.label),
    value: typeof v.value === 'number' && v.value >= 0 && v.value <= 1 ? v.value : undefined,
    cell: cell(v.cell),
    bind: bind.length ? bind : undefined,
    low: isInt(v.low, 0, 127) ? v.low : undefined,
    high: isInt(v.high, 0, 127) ? v.high : undefined,
    notes: notes.length ? notes : undefined,
  });
}

/** Built by fromEntries, so a key `__proto__` is a key, not the object's prototype. */
const record = <T>(v: unknown, key: (k: string) => boolean, value: (x: unknown) => T | undefined): Record<string, T> | undefined => {
  if (!isRecord(v)) return undefined;
  const entries = Object.entries(v).flatMap(([k, x]) => {
    const read = key(k) ? value(x) : undefined;
    return read === undefined ? [] : [[k, read] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
};

function group(v: Record<string, unknown>, depth: number): Group {
  const param = isRecord(v.repeat) ? name(v.repeat.name) : undefined;
  const from = isRecord(v.repeat) ? num(v.repeat.from) : undefined;
  const to = isRecord(v.repeat) ? num(v.repeat.to) : undefined;
  const use = name(v.use);
  return kept({
    group: v.group as string,
    label: text(v.label),
    repeat: param !== undefined && from !== undefined && to !== undefined ? { name: param, from, to } : undefined,
    columns: isInt(v.columns, 1, MAX_GRID) ? v.columns : undefined,
    cell: cell(v.cell),
    channel: num(v.channel),
    overrides: record(
      v.overrides,
      (k) => k.length <= MAX_TEXT,
      (o) => (isRecord(o) && text(o.label) !== undefined ? { label: text(o.label)! } : undefined),
    ),
    children: use === undefined ? nodes(v.children, depth + 1) : undefined,
    use,
    with: use === undefined ? undefined : record(v.with, (k) => name(k) !== undefined, num),
  });
}

/** The nodes kept: a control by its `type`, a group by its `group`; anything else, and a group nested too deep, dropped. */
function nodes(v: unknown, depth: number): PanelNode[] {
  if (!Array.isArray(v) || depth > MAX_DEPTH) return [];
  return v.flatMap((n): PanelNode[] => {
    if (!isRecord(n)) return [];
    if (CONTROL_TYPES.includes(n.type as ControlType)) return [control(n)];
    return name(n.group) !== undefined ? [group(n, depth)] : [];
  });
}

const template = (v: unknown): Template | undefined =>
  isRecord(v)
    ? kept({
        params: Array.isArray(v.params) ? [...new Set(v.params.flatMap((p) => name(p) ?? []))] : [],
        columns: isInt(v.columns, 1, MAX_GRID) ? v.columns : undefined,
        children: nodes(v.children, 1),
      })
    : undefined;

/** A panel from what was kept: anything. Junk is dropped field by field; what has no id is no panel. */
export function readPanel(v: unknown): Panel | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !v.id || v.id.length > MAX_TEXT) return null;
  return kept({
    id: v.id,
    name: text(v.name)?.trim() || v.id,
    channel: num(v.channel),
    columns: isInt(v.columns, 1, MAX_GRID) ? v.columns : undefined,
    templates: record(v.templates, (k) => name(k) !== undefined, template),
    children: nodes(v.children, 1),
  });
}
