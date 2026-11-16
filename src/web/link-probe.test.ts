import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LINK_LEAD, LINK_RUNS, LINK_TIMEOUT, probeMarker, type LinkReport } from '../core/link';
import { fakeLoop } from '../testing';
import { runLinkProbe } from './link-probe';

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] }));
afterEach(() => vi.useRealTimers());

/** A run on a loop made as given, the probes counted as they go out and as they come back. */
function setup(made: Parameters<typeof fakeLoop>[0] = { latency: 2, pageLag: 1 }) {
  const loop = fakeLoop(made);
  const log = { sent: [] as { at: number; stamp?: number; marker: number | null }[], back: 0, worstOut: 0, listeners: 0 };
  const output = {
    send(data: readonly number[], stamp?: number) {
      log.sent.push({ at: performance.now(), stamp, marker: probeMarker(data) });
      log.worstOut = Math.max(log.worstOut, log.sent.length - log.back);
      loop.output.send(data, stamp);
    },
  };
  const input = {
    addEventListener: (...a: Parameters<typeof loop.input.addEventListener>) => (log.listeners++, loop.input.addEventListener(...a)),
    removeEventListener: (...a: Parameters<typeof loop.input.removeEventListener>) => (log.listeners--, loop.input.removeEventListener(...a)),
  };
  input.addEventListener('midimessage', () => log.back++);
  return { loop, log, output, input };
}

const finish = async (run: Promise<LinkReport>, ms: number) => {
  const settled = run.then(
    (r) => r,
    (e: unknown) => e,
  );
  await vi.advanceTimersByTimeAsync(ms);
  return settled;
};

describe('runLinkProbe, a quick run', () => {
  it('sends 100 probes, scheduled and at once in turn, and reports the loop, as made', async () => {
    const { log, output, input } = setup();
    const report = (await finish(runLinkProbe({ output, input, outputName: 'Circuit', inputName: 'Circuit In', environment: 'Test' }), 5000)) as LinkReport;
    expect(log.sent.length).toBe(LINK_RUNS.quick.probes);
    expect(log.sent.map((s) => s.stamp !== undefined)).toEqual(Array.from({ length: 100 }, (_, i) => i % 2 === 0));
    log.sent.filter((s) => s.stamp !== undefined).forEach((s) => expect(s.stamp).toBe(s.at + LINK_LEAD));
    expect(report).toMatchObject({
      report: 'webmidi link',
      method: 'loop',
      n: 100,
      output: 'Circuit',
      input: 'Circuit In',
      environment: 'Test',
      timestampsHonoured: true,
      drift: null,
      wireMsPerByte: null,
    });
    expect(report.loop).toMatchObject({ count: 100, median: 2, jitter: 0 });
    expect(report.loss).toEqual({ lost: 0, of: 100, share: 0 });
    expect(report.lag).toMatchObject({ median: 1 });
    expect(Date.parse(report.at)).toBeLessThanOrEqual(Date.now());
    expect(report.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(report.tier.scheduled).toBe('tight');
    expect(report.tiersSpeculative).toBe(true);
  });

  it('never has two probes out at once, and keeps the run to about the quick run’s time', async () => {
    const { log, output, input } = setup();
    const start = performance.now();
    await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b' }), 5000);
    expect(log.worstOut).toBe(1);
    const last = log.sent.at(-1)!.at - start;
    expect(last).toBeGreaterThanOrEqual(99 * 20);
    expect(last).toBeLessThan(99 * 20 + 100 * 5);
  });

  it('listens only for the run and lets go after it', async () => {
    const { log, output, input } = setup();
    expect(log.listeners).toBe(1);
    await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b' }), 5000);
    expect(log.listeners).toBe(1);
  });

  it('reports the progress as the probes settle', async () => {
    const { output, input } = setup();
    const seen: number[] = [];
    await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b', onprogress: (p) => seen.push(p.sent) }), 5000);
    expect(seen).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('says timestamps are not honoured where the platform sends at once, and rates it poor', async () => {
    const { output, input } = setup({ latency: 2, pageLag: 1, honoursTimestamps: false });
    const report = (await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b' }), 5000)) as LinkReport;
    expect(report.timestampsHonoured).toBe(false);
    expect(report.tier.scheduled).toBe('poor');
  });

  it('counts a probe that does not come back as lost after the timeout, and waits for it before the next', async () => {
    const { log, output, input } = setup({ latency: 2, pageLag: 1, loss: 0.1, seed: 5 });
    const report = (await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b' }), 60_000)) as LinkReport;
    expect(report.n).toBe(100);
    expect(report.loss.lost).toBeGreaterThan(0);
    expect(report.loss.of).toBe(100);
    expect(report.loss.share).toBe(report.loss.lost / 100);
    // (a lost probe is never back, so it stays counted as out: one more than the lost is two at once)
    expect(log.worstOut).toBeLessThanOrEqual(report.loss.lost + 1);
    const gaps = log.sent.slice(1).map((s, i) => s.at - log.sent[i]!.at);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(LINK_TIMEOUT);
  });

  it('is not rated on a loop that came back with nothing', async () => {
    const { output, input } = setup({ loss: 1 });
    const report = (await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b' }), 60_000)) as LinkReport;
    expect(report).toMatchObject({ n: 100, loop: null, oneWay: null, loss: { lost: 100, of: 100, share: 1 } });
    expect(report.tier.scheduled).toBeNull();
  });
});

describe('runLinkProbe, a long run', () => {
  it('sends 600 probes 100 ms apart, counts the wraps, and measures a made drift', async () => {
    const { log, output, input } = setup({ latency: 2, pageLag: 1, drift: 6 });
    const report = (await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b', length: 'long' }), 90_000)) as LinkReport;
    expect(log.sent.length).toBe(LINK_RUNS.long.probes);
    expect(report).toMatchObject({ n: 600, wraps: 4, duplicates: 0, outOfOrder: 0, loss: { lost: 0 } });
    expect(Math.abs(report.drift! - 6)).toBeLessThan(0.1);
    expect(report.tier.scheduled).toBe('poor');
  });
});

describe('runLinkProbe, stopped', () => {
  it('stops sending when aborted, rejects, and lets go of the input', async () => {
    const { log, output, input } = setup();
    const controller = new AbortController();
    const run = runLinkProbe({ output, input, outputName: 'a', inputName: 'b', signal: controller.signal });
    const settled = run.then(
      () => 'done',
      (e: unknown) => (e as Error).name,
    );
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    const sentThen = log.sent.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(await settled).toBe('AbortError');
    expect(log.sent.length).toBe(sentThen);
    expect(sentThen).toBeGreaterThan(5);
    expect(sentThen).toBeLessThan(100);
    expect(log.listeners).toBe(1);
  });

  it('sends nothing when it is aborted already', async () => {
    const { log, output, input } = setup();
    const controller = new AbortController();
    controller.abort();
    const out = await finish(runLinkProbe({ output, input, outputName: 'a', inputName: 'b', signal: controller.signal }), 100);
    expect((out as Error).name).toBe('AbortError');
    expect(log.sent.length).toBe(0);
  });
});
