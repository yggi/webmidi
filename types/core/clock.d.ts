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
 * The audio clock against the page's: when what is scheduled on the AudioContext is *heard*, on `performance.now()`,
 * the clock MIDI timestamps are read against (Cell studio's decision 005: the heard moment). One estimator for it, which
 * a frontend's pictures read too (Cell studio's `audio/device.ts` `heardLatency`): facts in one place.
 *
 * Each reading is a sample of the offset (the moment heard, on the audio clock, less the page clock), within its
 * `bound`. Where the platform pairs the two clocks (`getOutputTimestamp`) a reading is good to a few tenths of a
 * millisecond. In Chromium the pairing steps by a buffer at a time while the output starts, so it is read only once the
 * output has run for `PAIRED_AFTER`. Where the platform never pairs, the audio clock less its output latency stands in,
 * a render quantum coarser; the two are never mixed.
 *
 * Of the latest samples the one with the least bound is trusted, the latest of equals; the offset played by moves
 * toward it by at most `slew` a sample (clocks drift apart by some parts per million). A clock can also jump: an
 * output that drops a buffer loses 10 ms at once. When `confirm` samples in a row disagree with the one trusted and
 * agree with each other, the clocks jumped: the samples before are dropped and the offset follows at once (a single
 * blip is dropped). A jump no wider than the samples' bounds is not told from drift, and is slewed. A leap wider than
 * `leap` is no blip (another output device, a context suspended and resumed: tens of milliseconds to seconds) and is
 * followed from its first sample, so the pictures and the MIDI timestamps don't wait three readings for it.
 */
/** How a pair of clocks is estimated. */
export interface PairConfig {
    /** How many of the latest samples the estimate is taken from. */
    readonly window: number;
    /** How many samples it takes before the offset is trusted at all. */
    readonly ready: number;
    /** How far, in seconds, the offset played by moves on one sample. */
    readonly slew: number;
    /** How far, in seconds, two samples' ranges may miss each other and still be of the same clocks. */
    readonly jumped: number;
    /** How many samples in a row it takes to say the clocks jumped. */
    readonly confirm: number;
    /** How far, in seconds, a sample may miss the trusted one before it is followed at once, unconfirmed. */
    readonly leap: number;
}
/** A sample of a pair's offset: it lies within `bound` of `offset`, both in seconds. */
export interface PairSample {
    readonly offset: number;
    readonly bound: number;
}
/** What the estimator carries from one sample to the next. */
export interface PairCarried {
    /** The latest samples, the oldest first. */
    readonly samples: readonly PairSample[];
    /** The offset played by, once it is trusted. */
    readonly offset: number | null;
    /** The samples in a row that disagreed with those before them, waiting for enough to say the clocks jumped. */
    readonly doubts: readonly PairSample[];
    /** How many jumps the pair has followed. */
    readonly jumps: number;
}
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
 * The estimator of a pair of clocks, from samples of their offset: a step from what it carried and one sample.
 * `clockOffset` runs it with `OUTPUT`; exported so a test (or a frontend) can run it with another configuration, as
 * yggi/webmidi#10's check of `leap: Infinity` against Jambot's estimator does.
 */
export declare function clockPair(config: PairConfig): {
    initial: PairCarried;
    advance: (carried: PairCarried, sample: PairSample) => {
        carried: PairCarried;
        output: PairEstimate;
    };
};
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
