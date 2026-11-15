import { type BindingKind, type Cell, type ControlType, type Panel } from './model';
/** The most controls and groups a panel instantiates to; what is past it is left out, and said. */
export declare const MAX_INSTANCES = 2000;
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
/** The largest value a kind carries. */
export declare const MAX_VALUE: Readonly<Record<BindingKind, number>>;
export declare function instantiate(panel: Panel): PanelInstance;
