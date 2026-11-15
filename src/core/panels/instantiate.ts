/**
 * A panel instantiated (decision 005): its groups repeated, its templates filled in, every expression given its
 * number, so what is left is what is drawn and played: a tree of groups and controls, each control with a key and its
 * bindings as plain numbers. Whatever can't be resolved is said in words (`errors`) and left out, binding by binding:
 * a panel with a mistake in it still plays the rest.
 */
import { compileExpression, type Expression, type Scope } from './expr';
import {
  isGroup,
  MAX_DEPTH,
  type Binding,
  type BindingKind,
  type Cell,
  type Control,
  type ControlType,
  type Group,
  type NodePath,
  type Num,
  type Panel,
  type PanelNode,
} from './model';

/** The most controls and groups a panel instantiates to; what is past it is left out, and said. */
export const MAX_INSTANCES = 2000;

/** A binding with its numbers: the channel 0–15, as on the wire. */
export interface BoundMessage {
  readonly kind: BindingKind;
  readonly channel: number;
  /** The controller, note or parameter; 0 for a kind that has none. */
  readonly number: number;
  /** What the control's value 0 and 1 are on the wire. */
  readonly lo: number;
  readonly hi: number;
  readonly axis: 'x' | 'y';
}

export interface ControlInstance {
  readonly kind: 'control';
  /** Its place in the panel, the same each time the panel is instantiated: `strips[3]/level`. */
  readonly key: string;
  /** Where it is defined: every instance of one definition has the same, so an editor finds and marks them all. */
  readonly source: NodePath;
  readonly type: ControlType;
  readonly label: string;
  /** Where it starts, 0 … 1. */
  readonly value: number;
  /** 0–15: what a `keyboard`'s and a `pads`' notes go out on. */
  readonly channel: number;
  readonly bindings: readonly BoundMessage[];
  readonly cell?: Cell;
  /** A `keyboard`'s and a `pads`' notes, in order. */
  readonly notes: readonly number[];
}

export interface GroupInstance {
  readonly kind: 'group';
  readonly key: string;
  readonly source: NodePath;
  readonly label: string;
  readonly columns?: number;
  readonly cell?: Cell;
  readonly children: readonly InstanceNode[];
}

export type InstanceNode = ControlInstance | GroupInstance;

export interface PanelInstance {
  readonly id: string;
  readonly name: string;
  readonly columns?: number;
  readonly children: readonly InstanceNode[];
  /** Every control, in the order drawn. */
  readonly controls: readonly ControlInstance[];
  /** What couldn't be resolved, each as `where: why`. */
  readonly errors: readonly string[];
  /** Whether it ran past `MAX_INSTANCES`, the rest left out. */
  readonly truncated: boolean;
}

/** The largest `number` a kind takes; null for a kind that has none. */
const MAX_NUMBER: Readonly<Record<BindingKind, number | null>> = { cc: 127, cc14: 31, note: 127, program: null, bend: null, pressure: null, nrpn: 16383, rpn: 16383 };
/** The largest value a kind carries. */
export const MAX_VALUE: Readonly<Record<BindingKind, number>> = { cc: 127, cc14: 16383, note: 127, program: 127, bend: 16383, pressure: 127, nrpn: 16383, rpn: 16383 };

const DEFAULT_KEYS = { low: 48, high: 72 };
const DEFAULT_PADS: readonly number[] = [36, 38, 42, 46];

export function instantiate(panel: Panel): PanelInstance {
  const errors: string[] = [];
  const controls: ControlInstance[] = [];
  const keys = new Set<string>();
  const compiled = new Map<string, Expression | string>();
  let count = 0;
  let full = false;

  /** Room for one more instance; said once when there is none. */
  const room = (): boolean => {
    if (count < MAX_INSTANCES) return (count++, true);
    if (!full) errors.push(`${panel.name}: more than ${MAX_INSTANCES} controls and groups; the rest is left out.`);
    full = true;
    return false;
  };

  /** A number's value in a scope, or null, said. */
  const valueOf = (v: Num, scope: Scope, where: string): number | null => {
    if (typeof v === 'number') return v;
    const names = Object.keys(scope);
    const id = `${names.join(',')}|${v}`;
    const e = compiled.get(id) ?? compileExpression(v, names);
    compiled.set(id, e);
    if (typeof e === 'string') return (errors.push(`${where}: ${e}`), null);
    return e(scope);
  };

  /** A whole number in a range, or null, said. */
  const whole = (v: Num, scope: Scope, lo: number, hi: number, where: string, what: string): number | null => {
    const n = valueOf(v, scope, where);
    if (n === null) return null;
    const r = Math.round(n);
    return r >= lo && r <= hi ? r : (errors.push(`${where}: ${r} is no ${what} (${lo} to ${hi}).`), null);
  };

  /** A channel 0–15 from one written 1–16, else the one inherited. */
  const channelOf = (v: Num | undefined, scope: Scope, inherited: number, where: string): number =>
    v === undefined ? inherited : (whole(v, scope, 1, 16, where, 'channel') ?? inherited + 1) - 1;

  /** Text with each `{…}` as its expression's value; one that can't be read is left as written, and said. */
  const labelOf = (text: string | undefined, scope: Scope, where: string): string =>
    (text ?? '').replace(/\{([^{}]*)\}/g, (written: string, source: string) => {
      const n = valueOf(source, scope, where);
      return n === null ? written : String(n);
    });

  const bound = (b: Binding, scope: Scope, channel: number, where: string): BoundMessage | null => {
    const max = MAX_NUMBER[b.kind];
    let number = 0;
    if (max !== null) {
      if (b.number === undefined) return (errors.push(`${where}: a ${b.kind} binding needs a number.`), null);
      const n = whole(b.number, scope, 0, max, where, `${b.kind} number`);
      if (n === null) return null;
      number = n;
    }
    const top = MAX_VALUE[b.kind];
    const end = (v: Num | undefined, fallback: number): number => {
      const n = v === undefined ? fallback : valueOf(v, scope, where);
      return n === null ? fallback : Math.max(0, Math.min(top, Math.round(n)));
    };
    return { kind: b.kind, channel: channelOf(b.channel, scope, channel, where), number, lo: end(b.range?.[0], 0), hi: end(b.range?.[1], top), axis: b.axis ?? 'x' };
  };

  const control = (c: Control, scope: Scope, channel: number, key: string, source: NodePath): ControlInstance => {
    const low = c.low ?? DEFAULT_KEYS.low;
    const high = Math.max(low, c.high ?? DEFAULT_KEYS.high);
    const notes = c.type === 'keyboard' ? Array.from({ length: high - low + 1 }, (_, i) => low + i) : c.type === 'pads' ? (c.notes ?? DEFAULT_PADS) : [];
    const instance: ControlInstance = {
      kind: 'control',
      key,
      source,
      type: c.type,
      label: labelOf(c.label, scope, key),
      value: c.value ?? 0,
      channel,
      bindings: (c.bind ?? []).flatMap((b) => bound(b, scope, channel, key) ?? []),
      ...(c.cell ? { cell: c.cell } : {}),
      notes,
    };
    controls.push(instance);
    return instance;
  };

  /** One instance of a group: its children inline, in the scope it stands in, or a template's, in the scope `with` gives. */
  const body = (g: Group, scope: Scope, channel: number, key: string, depth: number, used: readonly string[], source: NodePath): { columns?: number; children: InstanceNode[] } => {
    if (g.use === undefined) return { columns: g.columns, children: nodes(g.children ?? [], scope, channel, key, depth + 1, used, source) };
    const t = panel.templates && Object.hasOwn(panel.templates, g.use) ? panel.templates[g.use]! : null;
    if (!t) return (errors.push(`${key}: there is no template “${g.use}”.`), { children: [] });
    if (used.includes(g.use)) return (errors.push(`${key}: the template “${g.use}” uses itself.`), { children: [] });
    const given: Record<string, number> = {};
    for (const p of t.params) {
      const v = g.with && Object.hasOwn(g.with, p) ? valueOf(g.with[p]!, scope, key) : (errors.push(`${key}: the template “${g.use}” needs “${p}”.`), null);
      if (v === null) return { children: [] };
      given[p] = v;
    }
    return { columns: g.columns ?? t.columns, children: nodes(t.children, given, channel, key, depth + 1, [...used, g.use], { template: g.use, at: [] }) };
  };

  const group = (g: Group, scope: Scope, inherited: number, parent: string, depth: number, used: readonly string[], source: NodePath): GroupInstance[] => {
    const base = `${parent}${g.group}`;
    const one = (inner: Scope, key: string, value?: number): GroupInstance[] => {
      if (!room()) return [];
      const channel = channelOf(g.channel, inner, inherited, key);
      const own = value !== undefined && g.overrides && Object.hasOwn(g.overrides, String(value)) ? g.overrides[String(value)]!.label : undefined;
      const { columns, children } = body(g, inner, channel, key, depth, used, source);
      return [{ kind: 'group', key, source, label: labelOf(own ?? g.label, inner, key), ...(columns ? { columns } : {}), ...(g.cell ? { cell: g.cell } : {}), children }];
    };
    if (!g.repeat) return one(scope, base);
    const from = valueOf(g.repeat.from, scope, base);
    const to = valueOf(g.repeat.to, scope, base);
    if (from === null || to === null) return [];
    const out: GroupInstance[] = [];
    for (let v = Math.round(from); v <= Math.round(to) && !full; v++) out.push(...one({ ...scope, [g.repeat.name]: v }, `${base}[${v}]`, v));
    return out;
  };

  function nodes(children: readonly PanelNode[], scope: Scope, channel: number, parent: string, depth: number, used: readonly string[], home: NodePath): InstanceNode[] {
    if (depth > MAX_DEPTH) return (errors.push(`${parent}: groups are nested more than ${MAX_DEPTH} deep.`), []);
    const prefix = parent ? `${parent}/` : '';
    return children.flatMap((n, i): InstanceNode[] => {
      const source: NodePath = { ...home, at: [...home.at, i] };
      if (isGroup(n)) {
        const made = group(n, scope, channel, prefix, depth, used, source);
        return made.filter((g) => (keys.has(g.key) ? (errors.push(`${g.key}: two groups under one name; the second is left out.`), false) : (keys.add(g.key), true)));
      }
      const key = `${prefix}${n.id ?? `#${i + 1}`}`;
      if (keys.has(key)) return (errors.push(`${key}: two controls under one id; the second is left out.`), []);
      if (!room()) return [];
      keys.add(key);
      return [control(n, scope, channel, key, source)];
    });
  }

  const children = nodes(panel.children, {}, channelOf(panel.channel, {}, 0, panel.name), '', 1, [], { at: [] });
  return { id: panel.id, name: panel.name, ...(panel.columns ? { columns: panel.columns } : {}), children, controls, errors, truncated: full };
}
