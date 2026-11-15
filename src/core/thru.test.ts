import { describe, expect, it } from 'vitest';
import { delayText, ThruMeter } from './thru';

describe('ThruMeter', () => {
  it('has nothing to say before a message is passed on', () => {
    expect(new ThruMeter().stats).toBeNull();
  });

  it('gives the median, what 95 in 100 are within, and the worst, of the delays from seen to sent', () => {
    const meter = new ThruMeter();
    // 100 messages: delays 1 … 100 ms
    for (let i = 1; i <= 100; i++) meter.add(1000, 1000 + i);
    expect(meter.stats).toEqual({ count: 100, total: 100, median: 50, p95: 95, worst: 100 });
    const one = new ThruMeter();
    one.add(10, 12.5);
    expect(one.stats).toEqual({ count: 1, total: 1, median: 2.5, p95: 2.5, worst: 2.5 });
  });

  it('is over the last messages only: an old spike goes out of it, and the total still counts', () => {
    const meter = new ThruMeter(4);
    meter.add(0, 500);
    for (let i = 0; i < 4; i++) meter.add(0, 2);
    expect(meter.stats).toEqual({ count: 4, total: 5, median: 2, p95: 2, worst: 2 });
  });

  it('leaves out a time that is no number, counts a message sent before it was seen as 0, and starts again on reset', () => {
    const meter = new ThruMeter();
    meter.add(NaN, 5);
    meter.add(5, Infinity);
    expect(meter.stats).toBeNull();
    meter.add(10, 9.9);
    expect(meter.stats!.worst).toBe(0);
    meter.reset();
    expect(meter.stats).toBeNull();
  });

  it('says a delay in tenths under 10 ms, whole from there', () => {
    expect([delayText(0.84), delayText(9.96), delayText(12.4), delayText(0)]).toEqual(['0.8 ms', '10 ms', '12 ms', '0 ms']);
  });
});
