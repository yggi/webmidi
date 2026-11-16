import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLoop } from './loop';

type Heard = { data: number[]; timeStamp: number; handled: number };

/** A loop with a listener that keeps what it hears and when the handler ran. */
function listen(options: Parameters<typeof fakeLoop>[0] = {}) {
  const loop = fakeLoop(options);
  const heard: Heard[] = [];
  loop.input.addEventListener('midimessage', (e) => heard.push({ data: [...e.data!], timeStamp: e.timeStamp, handled: performance.now() }));
  return { loop, heard };
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
afterEach(() => vi.useRealTimers());

describe('fakeLoop', () => {
  it('delivers what an output sends to its input after the latency, stamped with when it arrived', () => {
    const { loop, heard } = listen({ latency: 3 });
    loop.output.send([0xb0, 1, 2]);
    vi.advanceTimersByTime(2);
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(heard).toEqual([{ data: [0xb0, 1, 2], timeStamp: 3, handled: 3 }]);
    expect(loop.output.sent).toEqual([[0xb0, 1, 2]]);
  });

  it('honours a timestamp by leaving at it, or leaves at once when the platform does not', () => {
    const honours = listen({ latency: 3 });
    honours.loop.output.send([1], 20);
    vi.advanceTimersByTime(30);
    expect(honours.heard[0]!.timeStamp).toBe(23);
    const ignores = listen({ latency: 3, honoursTimestamps: false });
    ignores.loop.output.send([1], 60);
    vi.advanceTimersByTime(30);
    expect(ignores.heard[0]!.timeStamp).toBe(33);
  });

  it('runs the handler a page lag after the message arrived', () => {
    const { loop, heard } = listen({ latency: 2, pageLag: 1 });
    loop.output.send([1]);
    vi.advanceTimersByTime(10);
    expect(heard[0]).toMatchObject({ timeStamp: 2, handled: 3 });
  });

  it('adds up to its jitter, the same each run of a seed and another run for another', () => {
    const run = (seed: number) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const { loop, heard } = listen({ latency: 2, jitter: 4, seed });
      for (let i = 0; i < 20; i++) loop.output.send([i], i * 100);
      vi.advanceTimersByTime(3000);
      return heard.map((h) => h.timeStamp - h.data[0]! * 100);
    };
    const a = run(1);
    expect(a.every((l) => l >= 2 && l <= 6)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(5);
    expect(run(1)).toEqual(a);
    expect(run(2)).not.toEqual(a);
  });

  it('drops a share of what is sent, the same share for a seed', () => {
    const { loop, heard } = listen({ loss: 0.2, seed: 7 });
    for (let i = 0; i < 1000; i++) loop.output.send([i % 128]);
    vi.advanceTimersByTime(100);
    expect(heard.length).toBeGreaterThan(740);
    expect(heard.length).toBeLessThan(860);
    expect(loop.dropped + loop.delivered).toBe(1000);
  });

  it('delivers some messages late, behind the ones after them, and some twice', () => {
    const { loop, heard } = listen({ latency: 1, reorder: 0.3, reorderBy: 30, duplicate: 0.1, seed: 3 });
    for (let i = 0; i < 200; i++) loop.output.send([i % 128], i * 10);
    vi.advanceTimersByTime(5000);
    const order = heard.map((h) => h.data[0]!);
    expect(order.some((n, i) => i > 0 && n < order[i - 1]! && n !== 0)).toBe(true);
    expect(heard.length).toBeGreaterThan(200);
  });

  it('drifts: a loop that grows by the made ms a minute', () => {
    const { loop, heard } = listen({ latency: 2, drift: 6 });
    for (let i = 0; i <= 60; i++) loop.output.send([i], i * 1000);
    vi.advanceTimersByTime(70_000);
    const loops = heard.map((h) => h.timeStamp - h.data[0]! * 1000);
    expect(loops[0]).toBeCloseTo(2, 9);
    expect(loops[60]).toBeCloseTo(8, 6);
  });

  it('passes SysEx unless told not to', () => {
    const passes = listen();
    passes.loop.output.send([0xf0, 1, 0xf7]);
    const stops = listen({ passesSysex: false });
    stops.loop.output.send([0xf0, 1, 0xf7]);
    stops.loop.output.send([0xb0, 1, 1]);
    vi.advanceTimersByTime(10);
    expect(passes.heard.length).toBe(1);
    expect(stops.heard.map((h) => h.data[0])).toEqual([0xb0]);
  });

  it('stops delivering to a listener removed', () => {
    const loop = fakeLoop();
    const listener = vi.fn();
    loop.input.addEventListener('midimessage', listener);
    loop.input.removeEventListener('midimessage', listener);
    loop.output.send([1]);
    vi.advanceTimersByTime(10);
    expect(listener).not.toHaveBeenCalled();
  });
});
