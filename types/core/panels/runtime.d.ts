import { type PanelInstance } from './instantiate';
import type { Panel } from './model';
/** A control's values, each 0 … 1; `y` is an `xy`'s second. */
export interface ControlValue {
    readonly x: number;
    readonly y: number;
}
export declare class PanelRuntime {
    readonly panel: PanelInstance;
    private readonly byKey;
    private readonly values;
    /** By binding: the last number on the wire, sent or received (a note's: its velocity, 0 when off). */
    private readonly wire;
    private readonly held;
    /** By what a message is (`cc:0:7`), the bindings that read it. */
    private readonly readers;
    private readonly parameters;
    /** A keyboard's and a pads' notes sounding, as `key:note`. */
    private readonly struck;
    constructor(panel: Panel);
    /** A control's values now; a key the panel has none for reads 0. */
    value(key: string): ControlValue;
    /** The person's finger is on it: nothing received moves it until `lift`. */
    press(key: string): void;
    lift(key: string): void;
    /** The person set it (each value held to 0 … 1; one left out stays): the messages that sends. */
    move(key: string, to: Partial<ControlValue>): number[][];
    /** What a binding sends for a value, when it is not what is already on the wire. */
    private send;
    /**
     * A message the panel's column was sent: the keys of the controls it moved, for a view to redraw. Each binding that
     * speaks this message takes its value, and none of it is sent back; a control being held is left where it is.
     */
    receive(data: ArrayLike<number>): string[];
    /** A key of a `keyboard` or a pad of a `pads` struck: its note-on, once until it is released; nothing for a note it hasn't. */
    strike(key: string, note: number, velocity?: number): number[][];
    unstrike(key: string, note: number): number[][];
    /**
     * Everything sounding released: each note struck, and each note a control holds on (its control back at 0), for a
     * view that closes, so no note hangs. Nothing is held after it.
     */
    silence(): number[][];
}
