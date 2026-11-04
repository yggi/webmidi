// yggi/webmidi#10 (yggi/cells#63 step 2): with `leap: Infinity`, webmidi's estimator is Jambot's, which has no leap,
// sample for sample. Jambot's is lifted below, from yggi/jambot packages/session/src/clock.ts @ b17b648 (`clockPair`,
// its `Machine`'s unused first argument left out), and both are run over seeded series of a pairing's readings.
import { describe, expect, it } from 'vitest';
import { clockPair, OUTPUT, type PairCarried, type PairEstimate, type PairSample } from './clock';

// ---- Lifted from yggi/jambot packages/session/src/clock.ts @ b17b648 ----
interface JambotConfig {
  readonly window: number;
  readonly ready: number;
  readonly slew: number;
  readonly jumped: number;
  readonly confirm: number;
}
const agree = (a: PairSample, b: PairSample, jumped: number) => Math.abs(a.offset - b.offset) <= a.bound + b.bound + jumped;
const trustedOf = (samples: readonly PairSample[]) => (samples.length === 0 ? null : samples.reduce((a, b) => (b.bound <= a.bound ? b : a)));
const estimate = ({ samples, offset, jumps }: PairCarried): PairEstimate => ({ offset, bound: trustedOf(samples)?.bound ?? null, jumps });
function jambotPair(config: JambotConfig) {
  const { window, ready, slew, jumped, confirm } = config;
  return {
    initial: { samples: [], offset: null, doubts: [], jumps: 0 } as PairCarried,
    advance(carried: PairCarried, sample: PairSample): { carried: PairCarried; output: PairEstimate } {
      if (!(sample.bound >= 0)) return { carried, output: estimate(carried) };
      const trusted = trustedOf(carried.samples);
      const withDoubts = carried.doubts.every((d) => agree(sample, d, jumped));
      if (trusted && !agree(sample, trusted, jumped)) {
        const doubts = withDoubts ? [...carried.doubts, sample] : [sample];
        if (doubts.length < confirm) {
          const next = { ...carried, doubts };
          return { carried: next, output: estimate(next) };
        }
        const followed = carried.offset !== null;
        const next = { samples: doubts, offset: followed ? trustedOf(doubts)!.offset : null, doubts: [], jumps: carried.jumps + (followed ? 1 : 0) };
        return { carried: next, output: estimate(next) };
      }
      const samples = [...carried.samples, sample].slice(-window);
      const best = trustedOf(samples)!;
      let offset = carried.offset;
      if (samples.length >= ready) offset = offset === null ? best.offset : offset + Math.max(-slew, Math.min(slew, best.offset - offset));
      const next = { samples, offset, doubts: withDoubts ? carried.doubts : [], jumps: carried.jumps };
      return { carried: next, output: estimate(next) };
    },
  };
}
// ---- end of the lift ----

/** A seeded generator in [0, 1) (mulberry32), so a failing series can be run again. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 2,000 readings of a pairing, 25 ms apart: jitter of ±0.4 ms, a blip of ±4 ms one reading in twenty, 100 ppm of drift,
 * and every 200 readings a jump of `jump()` seconds, either way.
 */
function series(seed: number, jump: (r: () => number) => number): PairSample[] {
  const r = random(seed);
  const out: PairSample[] = [];
  let base = -12;
  for (let i = 0; i < 2000; i++) {
    if (i > 0 && i % 200 === 0) base += (r() < 0.5 ? -1 : 1) * jump(r);
    const jitter = (r() * 2 - 1) * 0.0004;
    const blip = r() < 1 / 20 ? (r() * 2 - 1) * 0.004 : 0;
    out.push({ offset: base + 1e-4 * i * 0.025 + jitter + blip, bound: OUTPUT.paired });
  }
  return out;
}

/** The estimate after each sample. */
function run(pair: { initial: PairCarried; advance(c: PairCarried, s: PairSample): { carried: PairCarried; output: PairEstimate } }, samples: readonly PairSample[]) {
  let carried = pair.initial;
  return samples.map((s) => {
    const next = pair.advance(carried, s);
    carried = next.carried;
    return next.output;
  });
}

const SMALL = (r: () => number) => 0.005 + r() * 0.039; // 5 to 44 ms: a dropped buffer or two
const LARGE = (r: () => number) => 0.06 + r() * 1.94; // 60 ms to 2 s: another device, a suspend and resume

describe('leap: Infinity is Jambot’s estimator (yggi/webmidi#10)', () => {
  const ours = clockPair({ ...OUTPUT, leap: Infinity });
  const theirs = jambotPair(OUTPUT);

  it.each([1, 2, 3, 4, 5])('gives the same estimate at every reading, jumps of 5 to 44 ms (seed %i)', (seed) => {
    const samples = series(seed, SMALL);
    expect(run(ours, samples)).toEqual(run(theirs, samples));
  });

  it.each([1, 2, 3, 4, 5])('gives the same estimate at every reading, jumps of 60 ms to 2 s (seed %i)', (seed) => {
    const samples = series(seed, LARGE);
    expect(run(ours, samples)).toEqual(run(theirs, samples));
  });

  it('is shown firing: with OUTPUT’s own leap, the large jumps are followed sooner than Jambot’s', () => {
    const samples = series(1, LARGE);
    const leaping = run(clockPair(OUTPUT), samples);
    const jambot = run(theirs, samples);
    expect(leaping).not.toEqual(jambot);
    // a leap is followed at the reading it lands on, Jambot's at the confirm-th
    expect(leaping[200]!.offset).not.toBe(jambot[200]!.offset);
  });
});
