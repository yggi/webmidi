/** A number, or an expression that gives one in the scope it stands in. */
export type Num = number | string;
export declare const CONTROL_TYPES: readonly ["button", "switch", "knob", "fader", "xy", "label", "keyboard", "pads"];
/**
 * `button` is on while held and `switch` flips (both on when their value is above 0); `knob` and `fader` are 0 … 1;
 * `xy` has two values; a `label` has none; `keyboard` and `pads` send notes of their own, struck and released.
 */
export type ControlType = (typeof CONTROL_TYPES)[number];
export declare const BINDING_KINDS: readonly ["cc", "cc14", "note", "program", "bend", "pressure", "nrpn", "rpn"];
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
    readonly overrides?: Readonly<Record<string, {
        readonly label?: string;
    }>>;
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
export declare const panelRow: (id: string) => string;
export declare const isGroup: (node: PanelNode) => node is Group;
/** How deep groups nest, a template's children counted where they are used. */
export declare const MAX_DEPTH = 16;
/** The most columns a grid has, and the furthest cell. */
export declare const MAX_GRID = 64;
/** A panel from what was kept: anything. Junk is dropped field by field; what has no id is no panel. */
export declare function readPanel(v: unknown): Panel | null;
