/**
 * What a page adds to a message it passes on (docs/proposals/patchbay.md, section 4: "the page measures what it adds
 * before it claims to be a router"): the time from when the port saw the message (the event's `timeStamp`) to when
 * the page sent it on, both on the page's clock, over the last messages passed. It is the page's own delay only: not
 * the device's, the cable's or the driver's. Pure: the frontend gives both times.
 */
/** The delay over the messages kept, in milliseconds. */
export interface ThruStats {
    /** How many messages it is over (at most the meter's size), and how many were passed on in all. */
    readonly count: number;
    readonly total: number;
    /** Half the messages were passed on within this. */
    readonly median: number;
    /** 95 in 100 were passed on within this. */
    readonly p95: number;
    readonly worst: number;
}
/** The smallest value that at least `share` of the sorted values are within (nearest rank); the link meter reads its percentiles the same way. */
export declare const nearestRank: (sorted: readonly number[], share: number) => number;
export declare class ThruMeter {
    private readonly size;
    private readonly kept;
    private next;
    private total;
    /** A meter over the last `size` messages (256 by default). */
    constructor(size?: number);
    /**
     * A message passed on: when its port saw it and when it was sent, in ms on one clock. A time that is no number is
     * left out; a message sent "before" it was seen (clocks that disagree by a hair) counts as 0.
     */
    add(seen: number, sent: number): void;
    /** The delay over the messages kept, or null: none yet. */
    get stats(): ThruStats | null;
    reset(): void;
}
/** A delay in words: tenths of a millisecond under 10 ms, whole ones from there ("0.8 ms", "12 ms"). */
export declare const delayText: (ms: number) => string;
