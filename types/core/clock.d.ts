/** What the estimator says after a sample: what `ClockOffset.estimate` shows a frontend's timing panel. */
export interface PairEstimate {
    /** The offset to play by, in seconds. Null until enough samples. */
    readonly offset: number | null;
    /** The bound of the sample trusted, or null before the first. */
    readonly bound: number | null;
    /** How many jumps the pair has followed. */
    readonly jumps: number;
}
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
/**
 * The clock `clockOffset` makes: a `ClockOffset` that also shows its estimate in full, as of the last reading: the
 * offset (`heardOffset`), the bound of the reading trusted (`OUTPUT.paired` or `OUTPUT.unpaired`), and how many jumps
 * it has followed (a dropped buffer, a leap), for a timing panel or report (yggi/webmidi#9). Apart from `ClockOffset`,
 * so a frontend's own fake of a `ClockOffset` needs no estimate.
 */
export interface EstimatedClockOffset extends ClockOffset {
    readonly estimate: PairEstimate;
}
export declare function clockOffset(clock: OutputClock, now?: () => number): EstimatedClockOffset;
