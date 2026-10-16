// Lifted from yggi/cells src/engine/midi.test.ts @ 41ef16b: the rotation's case, without `rotationChannels`' lines (it stays in cells).
import { describe, expect, it } from 'vitest';
import { Rotation } from './rotation';

describe('channels', () => {
  it('rotation takes a free channel, the one free longest, else the first to free', () => {
    const rot = new Rotation([2, 3, 4]);
    expect([rot.take(1), rot.take(1), rot.take(2)]).toEqual([2, 3, 4]);
    // (all busy: 2 frees first; then 3)
    expect(rot.take(3)).toBe(2);
    expect(rot.take(3)).toBe(3);
  });
});
