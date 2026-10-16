// Lifted from yggi/cell-studio src/midi/clock.ts @ 3813fbb, which lifted it from yggi/jambot packages/session/src/clock.ts
// (clockPair, the output pair) and apps/web/src/audio/clock-offset.ts @ 8cdb6b8.

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
interface PairConfig {
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
interface Sample {
  readonly offset: number;
  readonly bound: number;
}

interface PairCarried {
  /** The latest samples, the oldest first. */
  readonly samples: readonly Sample[];
  /** The offset played by, once it is trusted. */
  readonly offset: number | null;
  /** The samples in a row that disagreed with those before them, waiting for enough to say the clocks jumped. */
  readonly doubts: readonly Sample[];
  /** How many jumps the pair has followed. */
  readonly jumps: number;
}

interface PairEstimate {
  /** The offset to play by, in seconds. Null until enough samples. */
  readonly offset: number | null;
  /** The bound of the sample trusted, or null before the first. */
  readonly bound: number | null;
  /** How many jumps the pair has followed. */
  readonly jumps: number;
}

/** Whether two samples could be of the same two clocks: their ranges meet, give or take `jumped`. */
const agree = (a: Sample, b: Sample, jumped: number) => Math.abs(a.offset - b.offset) <= a.bound + b.bound + jumped;

/** The sample trusted: the least bound, the latest of equals. */
const trustedOf = (samples: readonly Sample[]) => (samples.length === 0 ? null : samples.reduce((a, b) => (b.bound <= a.bound ? b : a)));

const estimateOf = ({ samples, offset, jumps }: PairCarried): PairEstimate => ({ offset, bound: trustedOf(samples)?.bound ?? null, jumps });

/** The estimator of a pair of clocks, from samples of their offset: a step from what it carried and one sample. */
function clockPair(config: PairConfig) {
  const { window, ready, slew, jumped, confirm, leap } = config;
  const initial: PairCarried = { samples: [], offset: null, doubts: [], jumps: 0 };
  const advance = (carried: PairCarried, sample: Sample): { carried: PairCarried; output: PairEstimate } => {
    if (!(sample.bound >= 0)) return { carried, output: estimateOf(carried) };
    const trusted = trustedOf(carried.samples);
    const withDoubts = carried.doubts.every((d) => agree(sample, d, jumped));
    if (trusted && !agree(sample, trusted, jumped)) {
      // (a leap is followed from this one sample; a smaller jump waits for `confirm` in a row)
      const leapt = !agree(sample, trusted, leap);
      const doubts = withDoubts && !leapt ? [...carried.doubts, sample] : [sample];
      if (!leapt && doubts.length < confirm) {
        // too few against the rest: held until more say which is right
        const next = { ...carried, doubts };
        return { carried: next, output: estimateOf(next) };
      }
      // enough against the rest: the clocks jumped; start again from them
      const followed = carried.offset !== null;
      const next = { samples: doubts, offset: followed ? trustedOf(doubts)!.offset : null, doubts: [], jumps: carried.jumps + (followed ? 1 : 0) };
      return { carried: next, output: estimateOf(next) };
    }
    const samples = [...carried.samples, sample].slice(-window);
    const best = trustedOf(samples)!;
    let offset = carried.offset;
    if (samples.length >= ready) offset = offset === null ? best.offset : offset + Math.max(-slew, Math.min(slew, best.offset - offset));
    // (a wide sample agrees with both: it leaves the doubts standing)
    const next = { samples, offset, doubts: withDoubts ? carried.doubts : [], jumps: carried.jumps };
    return { carried: next, output: estimateOf(next) };
  };
  return { initial, advance };
}

/**
 * The output pair: the pairing is good to a few tenths of a millisecond and blips by a few on a busy machine, one
 * reading at a time, so a jump takes three readings to confirm.
 */
export const OUTPUT = {
  window: 16,
  ready: 2,
  confirm: 3,
  /** A quarter of a millisecond a reading. */
  slew: 0.00025,
  jumped: 0.001,
  /** Fifty milliseconds: a dropped buffer (about 10) is confirmed, another device or a resume is followed at once. */
  leap: 0.05,
  /** The bound of a reading of the pairing. */
  paired: 0.0005,
  /** The bound of a reading of the clock less its latency: a render quantum, at 44.1 kHz. */
  unpaired: 0.003,
} as const;

const outputPair = clockPair(OUTPUT);

/** A reading of the platform's pairing, as a sample of the output's offset from the page's clock. */
const pairingSample = (contextTime: number, performanceTime: number): Sample => ({ offset: contextTime - performanceTime / 1000, bound: OUTPUT.paired });

/** The output's clock less its latency, against the page's clock in milliseconds, where the platform doesn't pair them. */
const unpairedSample = (currentTime: number, latency: number, pageMs: number): Sample => ({ offset: currentTime - latency - pageMs / 1000, bound: OUTPUT.unpaired });

/** What the clock reads of an AudioContext (a fake in the tests). */
export interface OutputClock {
  readonly currentTime: number;
  /** How far behind `currentTime` what is heard is, in seconds, where the platform has no pairing. */
  readonly latency?: number;
  /** A precise pairing of the two clocks, where the platform gives one. */
  outputTimestamp?(): { readonly contextTime?: number; readonly performanceTime?: number } | undefined;
}

/** How long, in seconds, an output runs before its clock's pairing is read. */
export const PAIRED_AFTER = 0.2;

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

export function clockOffset(clock: OutputClock, now: () => number = () => performance.now()): ClockOffset {
  let carried = outputPair.initial;
  let estimate: PairEstimate = { offset: null, bound: null, jumps: 0 };
  // the audio time of the reading last taken, so one reading isn't taken twice
  let last: number | null = null;
  const reading = () => {
    if (!clock.outputTimestamp) {
      const at = clock.currentTime;
      return { at, sample: unpairedSample(at, clock.latency ?? 0, now()) };
    }
    const ts = clock.outputTimestamp();
    if (!ts || !(ts.contextTime! >= PAIRED_AFTER) || !(ts.performanceTime! > 0)) return null;
    return { at: ts.contextTime!, sample: pairingSample(ts.contextTime!, ts.performanceTime!) };
  };
  // the offset to read by: the estimate, or before there is one, a single reading of whatever the platform gives
  const offset = () => {
    if (estimate.offset !== null) return estimate.offset;
    const ts = clock.outputTimestamp?.();
    if (ts && ts.contextTime! > 0 && ts.performanceTime! > 0) return pairingSample(ts.contextTime!, ts.performanceTime!).offset;
    return unpairedSample(clock.currentTime, clock.latency ?? 0, now()).offset;
  };
  return {
    update() {
      const read = reading();
      if (!read || read.at === last) return;
      last = read.at;
      const next = outputPair.advance(carried, read.sample);
      carried = next.carried;
      estimate = next.output;
    },
    heardOffset: () => estimate.offset,
    heard: () => now() / 1000 + offset(),
    toDeviceMs: (seconds) => (seconds - offset()) * 1000,
    fromDeviceMs: (ms) => ms / 1000 + offset(),
    paired: !!clock.outputTimestamp,
  };
}
