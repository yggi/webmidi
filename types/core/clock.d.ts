/**
 * The output pair: the pairing is good to a few tenths of a millisecond and blips by a few on a busy machine, one
 * reading at a time, so a jump takes three readings to confirm.
 */
export declare const OUTPUT: {
    readonly window: 16;
    readonly ready: 2;
    readonly confirm: 3;
    /** A quarter of a millisecond a reading. */
    readonly slew: 0.00025;
    readonly jumped: 0.001;
    /** Fifty milliseconds: a dropped buffer (about 10) is confirmed, another device or a resume is followed at once. */
    readonly leap: 0.05;
    /** The bound of a reading of the pairing. */
    readonly paired: 0.0005;
    /** The bound of a reading of the clock less its latency: a render quantum, at 44.1 kHz. */
    readonly unpaired: 0.003;
};
/** What the clock reads of an AudioContext (a fake in the tests). */
export interface OutputClock {
    readonly currentTime: number;
    /** How far behind `currentTime` what is heard is, in seconds, where the platform has no pairing. */
    readonly latency?: number;
    /** A precise pairing of the two clocks, where the platform gives one. */
    outputTimestamp?(): {
        readonly contextTime?: number;
        readonly performanceTime?: number;
    } | undefined;
}
/** How long, in seconds, an output runs before its clock's pairing is read. */
export declare const PAIRED_AFTER = 0.2;
export interface ClockOffset {
    /** Read the clocks once more (a reading already taken is not taken twice). */
    update(): void;
    /** The moment heard less the page's clock, in seconds, once trusted. */
    heardOffset(): number | null;
    /** The moment heard now, on the audio clock. */
    heard(): number;
    /** `seconds` on the audio clock, as a `performance.now()` timestamp: when it is heard. */
    toDeviceMs(seconds: number): number;
    /** The inverse: a `performance.now()` timestamp as seconds on the audio clock. */
    fromDeviceMs(ms: number): number;
    /** Whether the platform pairs the clocks (else the clock less its latency stands in). */
    readonly paired: boolean;
}
export declare function clockOffset(clock: OutputClock, now?: () => number): ClockOffset;
