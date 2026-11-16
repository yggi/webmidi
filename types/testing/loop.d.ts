/** What a made loop does to a message. Times are ms. */
export interface LoopOptions {
    /** From leaving the output to arriving at the input (default 1). */
    readonly latency?: number;
    /** Added to each message, uniformly from 0 to this (default 0). */
    readonly jitter?: number;
    /** The loop grows by this much each minute (default 0). */
    readonly drift?: number;
    /** A share of messages never arriving, 0 … 1 (default 0). */
    readonly loss?: number;
    /** A share arriving `reorderBy` late (default 0, and 25 ms), so after the messages sent after them. */
    readonly reorder?: number;
    readonly reorderBy?: number;
    /** A share arriving twice (default 0). */
    readonly duplicate?: number;
    /** Whether a message sent with a timestamp leaves at it (default true) or at once, as a platform that ignores them does. */
    readonly honoursTimestamps?: boolean;
    /** How long after the message arrived the page's handler runs (default 0.1): the event's `timeStamp` is when it arrived. */
    readonly pageLag?: number;
    /** Whether SysEx passes (default true): a device that doesn't echo it. */
    readonly passesSysex?: boolean;
    readonly seed?: number;
}
/** An event as the loop's input delivers it. */
interface LoopEvent {
    readonly data: Uint8Array | null;
    readonly timeStamp: number;
}
type Listener = (event: LoopEvent) => void;
/** An output wired to an input: `output.send` as a `MidiPort`, `input.addEventListener('midimessage', …)` as a `MIDIInput`. */
export declare function fakeLoop(options?: LoopOptions): {
    output: {
        id: string;
        name: string;
        sent: number[][];
        send(data: readonly number[], timestamp?: number): void;
    };
    input: {
        id: string;
        name: string;
        addEventListener: (_type: "midimessage", listener: Listener) => undefined;
        removeEventListener: (_type: "midimessage", listener: Listener) => undefined;
    };
    drops: number;
    arrivals: number;
    /** Messages dropped, and delivered (a duplicate counts twice). */
    readonly dropped: number;
    readonly delivered: number;
};
export {};
