import { describe, expect, it } from 'vitest';
import {
  LINK_CHANNEL,
  LINK_CONTROLLER,
  LINK_LEAD,
  LINK_LIMITS,
  LINK_RUNS,
  LINK_TIMEOUT,
  LinkMeter,
  linkReport,
  linkTier,
  probeBytes,
  probeMarker,
  type LinkMeasures,
  type LinkReport,
  type LinkTier,
} from './link';
import { nearestRank } from './thru';

/** A run on a made loop: probe `i` is called at `i * spacing` (scheduled `lead` ahead when `ahead(i)`), and comes back after `loop(i)` ms from when it left. */
function run(meter: LinkMeter, n: number, made: { spacing?: number; ahead?: (i: number) => boolean; loop?: (i: number) => number | null; honoured?: boolean; page?: number } = {}) {
  const { spacing = 20, ahead = () => false, loop = () => 1, honoured = true, page = 0.1 } = made;
  for (let i = 0; i < n; i++) {
    const called = 1000 + i * spacing;
    const lead = ahead(i) ? LINK_LEAD : 0;
    const { bytes } = meter.sent(called, lead);
    const l = loop(i);
    if (l === null) continue;
    const left = honoured ? called + lead : called;
    const back = left + l;
    meter.heard(bytes, back, back + page);
  }
}

describe('the probe', () => {
  it('is a control change on channel 16 of a controller no instrument is known to use, the probe number its value', () => {
    expect(LINK_CONTROLLER).toBeGreaterThanOrEqual(102);
    expect(LINK_CONTROLLER).toBeLessThanOrEqual(119);
    expect(LINK_CHANNEL).toBe(16);
    expect(probeBytes(5)).toEqual([0xb0 | 15, LINK_CONTROLLER, 5]);
    expect(probeBytes(128 + 7)).toEqual([0xb0 | 15, LINK_CONTROLLER, 7]);
  });

  it('is read back from every number, and only from its own controller and channel', () => {
    for (let i = 0; i < 300; i++) expect(probeMarker(probeBytes(i))).toBe(i % 128);
    expect(probeMarker([0xb0 | 14, LINK_CONTROLLER, 5])).toBeNull();
    expect(probeMarker([0xb0 | 15, LINK_CONTROLLER - 1, 5])).toBeNull();
    expect(probeMarker([0x9f, 60, 100])).toBeNull();
    expect(probeMarker([0xb0 | 15, LINK_CONTROLLER])).toBeNull();
    expect(probeMarker([])).toBeNull();
  });
});

describe('the constants', () => {
  it('are the quick and the long run, the lead and the timeout, as the owner approved them', () => {
    expect(LINK_RUNS).toEqual({ quick: { probes: 100, spacing: 20 }, long: { probes: 600, spacing: 100 } });
    expect([LINK_LEAD, LINK_TIMEOUT]).toEqual([20, 250]);
    expect(LINK_LIMITS).toEqual({ jitter: [1, 3, 8], loss: [0, 0.002, 0.01], drift: [0.5, 2, 5], played: [6, 12, 25] });
  });
});

describe('LinkMeter on a loop with no jitter', () => {
  it('has nothing to say before a probe is sent or a message heard', () => {
    const stats = new LinkMeter().stats(0);
    expect(stats).toMatchObject({ method: 'passive', sent: 0, back: 0, lost: 0, loop: null, drift: null, lag: null, timestampsHonoured: null });
  });

  it('has every statistic exact: loop, jitter 0, no loss, no outliers, page lag', () => {
    const meter = new LinkMeter();
    run(meter, 100, { loop: () => 2.5, page: 0.25 });
    const stats = meter.stats(1000 + 100 * 20 + 1000);
    expect(stats.method).toBe('loop');
    expect(stats).toMatchObject({ sent: 100, back: 100, lost: 0, loss: 0, outOfOrder: 0, duplicates: 0, outliers: 0, wraps: 0 });
    expect(stats.loop).toEqual({ count: 100, median: 2.5, p95: 2.5, worst: 2.5, jitter: 0 });
    expect(stats.lag).toMatchObject({ count: 100, median: 0.25, p95: 0.25, worst: 0.25 });
  });

  it('shares its percentile with the thru meter: nearest rank, 1 … 100 gives 50 and 95', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect([nearestRank(sorted, 0.5), nearestRank(sorted, 0.95), nearestRank(sorted, 1)]).toEqual([50, 95, 100]);
    const meter = new LinkMeter();
    run(meter, 100, { loop: (i) => i + 1 });
    expect(meter.stats(1e6).loop).toEqual({ count: 100, median: 50, p95: 95, worst: 100, jitter: 45 });
  });

  it('is exact on a jitter that goes both ways: jitter is p95 minus the median', () => {
    const meter = new LinkMeter();
    run(meter, 20, { loop: (i) => (i < 10 ? 2 : 3) });
    expect(meter.stats(1e6).loop).toMatchObject({ median: 2, p95: 3, worst: 3, jitter: 1 });
  });
});

describe('LinkMeter, loss', () => {
  it('counts a probe not back within the timeout as lost, and one still within it as pending', () => {
    const meter = new LinkMeter();
    run(meter, 10, { loop: (i) => (i === 3 ? null : 1) });
    const last = 1000 + 9 * 20;
    expect(meter.stats(last + 50)).toMatchObject({ sent: 10, back: 9, lost: 0, loss: 0 });
    const later = meter.stats(1000 + 3 * 20 + LINK_TIMEOUT + 1);
    expect(later).toMatchObject({ back: 9, lost: 1 });
    expect(later.loss).toBeCloseTo(1 / 10, 12);
  });

  it('counts a probe that comes back after the timeout as lost, not as a loop of that length', () => {
    const meter = new LinkMeter();
    run(meter, 10, { loop: (i) => (i === 3 ? LINK_TIMEOUT + 10 : 1) });
    const stats = meter.stats(1e6);
    expect(stats).toMatchObject({ back: 9, lost: 1 });
    expect(stats.loop!.worst).toBe(1);
  });

  it('is exactly a share: 1 in 500 is 0.002', () => {
    const meter = new LinkMeter();
    run(meter, 500, { loop: (i) => (i === 7 ? null : 1) });
    expect(meter.stats(1e7).loss).toBe(0.002);
  });
});

describe('LinkMeter, order and duplicates', () => {
  it('counts a probe that comes back after a later one as out of order', () => {
    const meter = new LinkMeter();
    const a = meter.sent(1000, 0);
    const b = meter.sent(1020, 0);
    const c = meter.sent(1040, 0);
    meter.heard(b.bytes, 1021, 1021);
    meter.heard(a.bytes, 1022, 1022);
    meter.heard(c.bytes, 1041, 1041);
    expect(meter.stats(5000)).toMatchObject({ back: 3, outOfOrder: 1, duplicates: 0 });
  });

  it('counts a probe heard twice as a duplicate, and leaves the loop at its first hearing', () => {
    const meter = new LinkMeter();
    const a = meter.sent(1000, 0);
    expect(meter.heard(a.bytes, 1002, 1002)).toBe('matched');
    expect(meter.heard(a.bytes, 1003, 1003)).toBe('duplicate');
    expect(meter.stats(5000)).toMatchObject({ back: 1, duplicates: 1 });
    expect(meter.stats(5000).loop!.worst).toBe(2);
  });

  it('says what each message heard was, and leaves what is not a probe out of the loop', () => {
    const meter = new LinkMeter();
    expect(meter.heard([0x90, 60, 100], 10, 12)).toBe('other');
    expect(meter.heard(probeBytes(9), 20, 21)).toBe('foreign');
    const stats = meter.stats(1e6);
    expect(stats).toMatchObject({ sent: 0, back: 0, method: 'passive' });
    expect(stats.lag).toMatchObject({ count: 2, median: 1, worst: 2 });
  });
});

describe('LinkMeter, outliers', () => {
  it('counts the loops beyond the median plus 3 times the median absolute deviation', () => {
    const meter = new LinkMeter();
    // 17 loops of 1 or 2 ms (median 1, MAD 0 … made so: 9 of 1 ms, 8 of 2 ms), then 3 of 20 ms
    const loops = [...Array(9).fill(1), ...Array(8).fill(2), 20, 20, 20];
    run(meter, 20, { loop: (i) => loops[i] });
    const stats = meter.stats(1e6);
    expect(stats.loop!.median).toBe(2);
    expect(stats.outliers).toBe(3);
  });

  it('has none on a loop within the spread, and the limit itself is not beyond it', () => {
    const meter = new LinkMeter();
    // median 3, deviations 0 (×5) 1 (×4) 2 (×0) → MAD 1 → limit 6; 6 is on it, 7 beyond
    const loops = [1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 6];
    run(meter, loops.length, { loop: (i) => loops[i] });
    expect(meter.stats(1e6).outliers).toBe(0);
    const beyond = new LinkMeter();
    run(beyond, loops.length, { loop: (i) => (i === 11 ? 7 : loops[i]) });
    expect(beyond.stats(1e6).outliers).toBe(1);
  });
});

describe('LinkMeter, a long run', () => {
  it('matches 600 probes across the marker wrapping, counting its wraps, with nothing lost or mixed up', () => {
    const meter = new LinkMeter();
    run(meter, 600, { spacing: 100, loop: (i) => 1 + (i % 7) });
    const stats = meter.stats(1e7);
    expect(stats).toMatchObject({ sent: 600, back: 600, lost: 0, duplicates: 0, outOfOrder: 0, wraps: 4 });
    expect(stats.loop).toMatchObject({ count: 600, worst: 7 });
  });

  it('never matches a probe to a lost one a wrap before it', () => {
    const meter = new LinkMeter();
    run(meter, 300, { spacing: 100, loop: (i) => (i === 5 ? null : 2) });
    const stats = meter.stats(1e7);
    expect(stats).toMatchObject({ sent: 300, back: 299, lost: 1, wraps: 2, duplicates: 0 });
    expect(stats.loop).toMatchObject({ median: 2, worst: 2 });
  });

  it('measures the drift of a loop that grows 6 ms a minute, to within 0.01 ms a minute', () => {
    const meter = new LinkMeter();
    // 600 probes 100 ms apart: 60 s; a loop of 2 ms growing 0.1 ms a second
    run(meter, 600, { spacing: 100, loop: (i) => 2 + (i * 100) / 10000 });
    expect(Math.abs(meter.stats(1e7).drift! - 6)).toBeLessThan(0.01);
    const down = new LinkMeter();
    run(down, 600, { spacing: 100, loop: (i) => 9 - (i * 100) / 20000 });
    expect(Math.abs(down.stats(1e7).drift! + 3)).toBeLessThan(0.01);
    const flat = new LinkMeter();
    run(flat, 600, { spacing: 100, loop: () => 2 });
    expect(Math.abs(flat.stats(1e7).drift!)).toBeLessThan(0.01);
  });

  it('does not claim a drift over a run too short to tell one from jitter: the quick run says not measured', () => {
    const meter = new LinkMeter();
    run(meter, 100, { loop: (i) => 2 + i * 0.01 });
    expect(meter.stats(1e6).drift).toBeNull();
  });
});

describe('LinkMeter, are timestamps honoured', () => {
  const alternate = (i: number) => i % 2 === 0;

  it('says so when the scheduled probes take the lead longer than the ones sent at once', () => {
    const meter = new LinkMeter();
    run(meter, 100, { ahead: alternate, honoured: true, loop: () => 2 });
    const stats = meter.stats(1e6);
    expect(stats.timestampsHonoured).toBe(true);
    expect(stats.loop).toMatchObject({ median: 2, jitter: 0, count: 100 });
  });

  it('says not when the scheduled ones come back as soon as the others: the platform sent them at once', () => {
    const meter = new LinkMeter();
    run(meter, 100, { ahead: alternate, honoured: false, loop: () => 2 });
    const stats = meter.stats(1e6);
    expect(stats.timestampsHonoured).toBe(false);
    // the loop is then from the call, not from the time asked for
    expect(stats.loop).toMatchObject({ median: 2, jitter: 0, count: 100 });
  });

  it('says it is not known when a difference lies between (half the lead) or either kind is too few', () => {
    const half = new LinkMeter();
    for (let i = 0; i < 20; i++) {
      const called = 1000 + i * 20;
      const scheduled = i % 2 === 0;
      const { bytes } = half.sent(called, scheduled ? LINK_LEAD : 0);
      half.heard(bytes, called + 2 + (scheduled ? LINK_LEAD / 2 : 0), called + 3);
    }
    expect(half.stats(1e6).timestampsHonoured).toBeNull();
    const few = new LinkMeter();
    run(few, 6, { ahead: alternate, honoured: true });
    expect(few.stats(1e6).timestampsHonoured).toBeNull();
  });

  it('measures the loop from the probes sent at once alone when that is not known', () => {
    const meter = new LinkMeter();
    run(meter, 20, { ahead: alternate, honoured: true, loop: () => 2 });
    // too few to tell, and so the 10 scheduled are left out of the loop… 10 sent at once remain
    const few = new LinkMeter();
    run(few, 8, { ahead: alternate, honoured: true, loop: () => 2 });
    expect(few.stats(1e6).timestampsHonoured).toBeNull();
    expect(few.stats(1e6).loop).toMatchObject({ count: 4, median: 2 });
    expect(meter.stats(1e6).timestampsHonoured).toBe(true);
  });
});

describe('LinkMeter, passive', () => {
  it('keeps only the page lag of every message heard, and no probes', () => {
    const meter = new LinkMeter();
    for (let i = 1; i <= 100; i++) meter.heard([0x90, 60, 100], 1000 + i, 1000 + i + i / 10);
    const stats = meter.stats(1e6);
    expect(stats).toMatchObject({ method: 'passive', sent: 0, loop: null, drift: null });
    expect(stats.lag).toMatchObject({ count: 100, median: 5, p95: 9.5, worst: 10 });
  });
});

/** Measures that are all in the best tier, one changed. */
const best: LinkMeasures = { jitter: 0, loss: 0, drift: 0, oneWay: 1, lag: 1, timestampsHonoured: true };

describe('linkTier', () => {
  const tierNames: LinkTier[] = ['tight', 'good', 'loose', 'poor'];
  const rows = [
    ['jitter', 'scheduled'],
    ['loss', 'scheduled'],
    ['drift', 'scheduled'],
  ] as const;

  for (const [row] of rows) {
    it(`puts the ${row} in each tier at its limit and the next tier a hair above it`, () => {
      const limits = LINK_LIMITS[row];
      limits.forEach((limit, i) => {
        const at = linkTier({ ...best, [row]: limit }).scheduled!;
        expect(at.tier, `${row} ${limit}`).toBe(tierNames[i]);
        const above = linkTier({ ...best, [row]: limit + 1e-9 }).scheduled!;
        expect(above.tier, `${row} just above ${limit}`).toBe(tierNames[i + 1]);
      });
      expect(linkTier({ ...best, [row]: limits[2] * 100 }).scheduled!.tier).toBe('poor');
    });
  }

  it('reads the drift as its size, down as up', () => {
    expect(linkTier({ ...best, drift: -0.5 }).scheduled!.tier).toBe('tight');
    expect(linkTier({ ...best, drift: -2 }).scheduled!.tier).toBe('good');
    expect(linkTier({ ...best, drift: -5.1 }).scheduled!.tier).toBe('poor');
  });

  it('puts one way plus the page lag in each tier at its limit and the next just above, the jitter being tight', () => {
    LINK_LIMITS.played.forEach((limit, i) => {
      // the limit made of one way and the lag, in two parts
      const at = linkTier({ ...best, oneWay: limit - 0.5, lag: 0.5 }).played!;
      expect(at.tier, `played ${limit}`).toBe(tierNames[i]);
      const above = linkTier({ ...best, oneWay: limit - 0.5, lag: 0.5 + 1e-9 }).played!;
      expect(above.tier, `played above ${limit}`).toBe(tierNames[i + 1]);
    });
  });

  it('is the worst of its rows, in the scheduled tier', () => {
    expect(linkTier({ ...best, jitter: 2, loss: 0.005, drift: 0.1 }).scheduled!.tier).toBe('loose');
    expect(linkTier({ ...best, jitter: 9, loss: 0, drift: 0.1 }).scheduled!.tier).toBe('poor');
    expect(linkTier(best).scheduled!.tier).toBe('tight');
  });

  it('caps the played tier by the jitter’s: a fast loop that jumps is not tight in a hand', () => {
    expect(linkTier({ ...best, jitter: 2 }).played!.tier).toBe('good');
    expect(linkTier({ ...best, jitter: 5 }).played!.tier).toBe('loose');
    expect(linkTier({ ...best, jitter: 50 }).played!.tier).toBe('poor');
    // loss and drift do not cap it
    expect(linkTier({ ...best, loss: 0.5, drift: 50 }).played!.tier).toBe('tight');
  });

  it('puts timestamps that are not honoured at poor, and says nothing of them when it is not known', () => {
    const no = linkTier({ ...best, timestampsHonoured: false }).scheduled!;
    expect(no.tier).toBe('poor');
    expect(no.reason).toContain('timestamps');
    const unknown = linkTier({ ...best, timestampsHonoured: null }).scheduled!;
    expect(unknown.tier).toBe('tight');
    expect(unknown.reason).toContain('not measured');
  });

  it('gives the reason in words, with what caps it', () => {
    expect(linkTier({ ...best, jitter: 4.1 }).scheduled!.reason).toBe('loose: jitter 4.1 ms');
    expect(linkTier({ ...best, jitter: 4.1, loss: 0.008 }).scheduled!.reason).toBe('loose: jitter 4.1 ms, loss 0.8%');
    expect(linkTier({ ...best, jitter: 4.1, loss: 0.5 }).scheduled!.reason).toBe('poor: loss 50%');
    expect(linkTier({ ...best, jitter: 4.1, oneWay: 4, lag: 1 }).played!.reason).toBe('loose: capped by jitter 4.1 ms');
    expect(linkTier({ ...best, oneWay: 2, lag: 1.5, jitter: 0.4 }).played!.reason).toBe('tight: one way + page lag 3.5 ms, jitter 0.4 ms');
  });

  it('rates a connection only from what was measured: the page lag alone is a played tier, nothing a scheduled one', () => {
    const passive = linkTier({ jitter: null, loss: null, drift: null, oneWay: null, lag: 7, timestampsHonoured: null });
    expect(passive.scheduled).toBeNull();
    expect(passive.played).toEqual({ tier: 'good', reason: 'good: page lag 7 ms (the loop was not measured)' });
    expect(linkTier({ jitter: null, loss: null, drift: null, oneWay: null, lag: null, timestampsHonoured: null })).toEqual({ scheduled: null, played: null });
  });

  it('leaves the drift out of the tier when it was not measured (a short run)', () => {
    expect(linkTier({ ...best, drift: null, jitter: 4 }).scheduled!.reason).toBe('loose: jitter 4 ms');
    expect(linkTier({ ...best, drift: null }).scheduled!.tier).toBe('tight');
  });
});

describe('LinkReport', () => {
  const info = { at: '2026-11-16T12:00:00.000Z', output: 'Circuit', input: 'Circuit In', environment: 'Test/1.0 (Linux)' };

  it('carries what was measured, what was assumed, the tier and its reasons, and is the same after a trip through JSON', () => {
    const meter = new LinkMeter();
    run(meter, 600, { spacing: 100, ahead: (i) => i % 2 === 0, loop: (i) => 2 + (i % 3) * 0.5 });
    const report = linkReport(info, meter.stats(1e7));
    expect(report).toMatchObject({
      report: 'webmidi link',
      at: info.at,
      output: 'Circuit',
      input: 'Circuit In',
      environment: 'Test/1.0 (Linux)',
      method: 'loop',
      n: 600,
      timestampsHonoured: true,
      loss: { lost: 0, of: 600, share: 0 },
      wireMsPerByte: null,
      tiersSpeculative: true,
    });
    expect(report.oneWay).toEqual({ ms: report.loop!.median / 2, assumed: true });
    expect(report.assumes.join(' ')).toContain('one way');
    expect(report.tier.scheduled).not.toBeNull();
    expect(report.reasons.length).toBeGreaterThan(0);
    const again = JSON.parse(JSON.stringify(report)) as LinkReport;
    expect(again).toEqual(report);
  });

  it('round-trips a passive report, with no loop, as JSON', () => {
    const meter = new LinkMeter();
    meter.heard([0x90, 60, 90], 100, 103);
    const report = linkReport({ ...info, input: null }, meter.stats(1000));
    expect(report).toMatchObject({ method: 'passive', n: 0, loop: null, oneWay: null, drift: null, input: null });
    expect(report.lag).toMatchObject({ count: 1, median: 3 });
    expect(report.tier.scheduled).toBeNull();
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
