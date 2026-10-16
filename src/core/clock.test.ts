// Lifted from yggi/cell-studio src/midi/clock.test.ts @ 3813fbb. There, the clockOffset cases were lifted from yggi/jambot
// apps/web/src/audio/clock-offset.test.ts @ 8cdb6b8; the pair's own from packages/session/src/clock.test.ts there,
// without its simulated device.
import { describe, expect, it } from 'vitest';
import { OUTPUT, PAIRED_AFTER, clockOffset } from './clock';

/** A clock whose output time the test moves, and its pairing, where it has one. */
function clockAt(currentTime: number, pairing?: { contextTime: number; performanceTime: number }) {
  const clock = { currentTime, latency: 0, ...(pairing && { outputTimestamp: () => clock.pairing }), pairing };
  return clock;
}

describe('clockOffset', () => {
  it('reads the output clock less its latency where the platform has no pairing', () => {
    const clock = { currentTime: 2, latency: 0.04 };
    let now = 3000;
    const offset = clockOffset(clock, () => now);
    offset.update();
    clock.currentTime = 2.025;
    now = 3025;
    offset.update();
    // the moment heard, 1.96 s, is 3000 ms on the page's clock
    expect(offset.toDeviceMs(1.96)).toBeCloseTo(3000, 9);
    expect(offset.heardOffset()).toBeCloseTo(1.96 - 3, 12);
    expect(offset.paired).toBe(false);
  });

  it("reads the platform's pairing where there is one, and never the clock less its latency", () => {
    const clock = clockAt(2, { contextTime: 1.965, performanceTime: 2500 });
    const offset = clockOffset(clock, () => 999999);
    offset.update();
    clock.pairing = { contextTime: 1.99, performanceTime: 2525 };
    offset.update();
    expect(offset.toDeviceMs(1.965)).toBeCloseTo(2500, 9);
    expect(offset.paired).toBe(true);
  });

  it('reads no pairing before the output has run for PAIRED_AFTER, and none twice', () => {
    const clock = clockAt(0.1, { contextTime: PAIRED_AFTER - 0.01, performanceTime: 5000 });
    const offset = clockOffset(clock, () => 5000);
    offset.update();
    offset.update();
    expect(offset.heardOffset()).toBeNull();
    clock.pairing = { contextTime: 0.3, performanceTime: 5100 };
    offset.update();
    offset.update();
    // one reading, read twice, is one reading: not yet trusted
    expect(offset.heardOffset()).toBeNull();
    clock.pairing = { contextTime: 0.325, performanceTime: 5125 };
    offset.update();
    expect(offset.heardOffset()).toBeCloseTo(0.3 - 5.1, 12);
  });

  it('reads a single pairing, or the clock, before it has an estimate', () => {
    expect(clockOffset({ currentTime: 4 }, () => 4500).toDeviceMs(0)).toBe(500);
    const early = clockAt(1, { contextTime: 0.05, performanceTime: 2000 });
    expect(clockOffset(early, () => 0).toDeviceMs(0.05)).toBeCloseTo(2000, 9);
  });

  it('inverts toDeviceMs, for a note timestamped on performance.now()', () => {
    const offset = clockOffset({ currentTime: 2 }, () => 3000);
    expect(offset.fromDeviceMs(4500)).toBe(3.5);
    expect(offset.fromDeviceMs(offset.toDeviceMs(7))).toBeCloseTo(7, 9);
  });

  it('reads the moment heard now on both paths: the fallback takes the output latency off currentTime', () => {
    // Chromium, measured: the time getOutputTimestamp says is heard lags currentTime by about the output latency
    const precise = clockOffset({ currentTime: 1.512, latency: 0.032, outputTimestamp: () => ({ contextTime: 1.48, performanceTime: 1620 }) }, () => 1620);
    const fallback = clockOffset({ currentTime: 1.512, latency: 0.032 }, () => 1620);
    expect(precise.heard()).toBeCloseTo(1.48, 9);
    expect(fallback.heard()).toBeCloseTo(1.48, 9);
    expect(precise.fromDeviceMs(1620)).toBeCloseTo(1.48, 9);
  });
});

describe('the output pair: one estimate of the clocks', () => {
  /** A pairing read every 25 ms from 0.3 s, the output `offset(t)` seconds from the page; the estimate after each. */
  const run = (offset: (t: number, i: number) => number, readings = 200) => {
    let t = 0.3;
    let i = 0;
    const clock = { currentTime: t, outputTimestamp: () => ({ contextTime: t, performanceTime: (t - offset(t, i)) * 1000 }) };
    const est = clockOffset(clock, () => 0);
    const out: (number | null)[] = [];
    for (; i < readings; i++, t += 0.025) {
      est.update();
      out.push(est.heardOffset());
    }
    return out;
  };

  it('is trusted from its second reading, and then exact on steady clocks', () => {
    const out = run(() => -12);
    expect(out[0]).toBeNull();
    for (const o of out.slice(1)) expect(o).toBeCloseTo(-12, 9);
  });

  it('follows a dropped buffer within three readings, and a blip not at all', () => {
    const drop = 512 / 48000;
    const out = run((_, i) => (i >= 100 ? -12 - drop : i === 50 ? -12 - 0.004 : -12));
    for (const o of out.slice(1, 100)) expect(o).toBeCloseTo(-12, 9);
    expect(out[100 + OUTPUT.confirm - 2]).toBeCloseTo(-12, 9);
    for (const o of out.slice(100 + OUTPUT.confirm - 1)) expect(o).toBeCloseTo(-12 - drop, 9);
  });

  it('follows a leap wider than OUTPUT.leap from its first reading: another device, or a suspend and resume', () => {
    for (const leap of [0.08, -0.3, 5]) {
      const out = run((_, i) => (i >= 100 ? -12 + leap : -12));
      expect(out[99]).toBeCloseTo(-12, 9);
      for (const o of out.slice(100)) expect(o).toBeCloseTo(-12 + leap, 9);
    }
  });

  it('follows drift by at most the slew a reading', () => {
    const out = run((t) => -12 + 1e-4 * t, 400);
    for (let i = 2; i < out.length; i++) expect(Math.abs(out[i]! - out[i - 1]!)).toBeLessThanOrEqual(OUTPUT.slew + 1e-12);
    expect(Math.abs(out.at(-1)! - (-12 + 1e-4 * (0.3 + 399 * 0.025)))).toBeLessThan(0.0005);
  });
});
