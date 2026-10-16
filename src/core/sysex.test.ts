// New, after yggi/ep133-sysex src/__tests__/frame.test.ts @ ca8d819 (its SysexAssembler cases, there over captures of
// the EP-133's own messages; here over short ones).
import { describe, expect, it } from 'vitest';
import { SysexAssembler } from './sysex';

const GREET = [0xf0, 0x00, 0x20, 0x76, 0x33, 0x40, 0x60, 0x01, 0x01, 0xf7];
const REPLY = [0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x00, 0x20, 0x76, 0x01, 0x00, 0xf7];
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

describe('SysexAssembler', () => {
  it('passes a whole message through', () => {
    const a = new SysexAssembler();
    expect(a.push(bytes(GREET))).toEqual([bytes(GREET)]);
    expect(a.pending).toBe(0);
  });

  it('rejoins a message split across delivery events, holding back what has no F7 yet', () => {
    const a = new SysexAssembler();
    expect(a.push(bytes(REPLY.slice(0, 5)))).toEqual([]);
    expect(a.pending).toBe(5);
    expect(a.push(bytes(REPLY.slice(5)))).toEqual([bytes(REPLY)]);
    expect(a.pending).toBe(0);
  });

  it('separates two messages arriving in one event', () => {
    expect(new SysexAssembler().push(bytes(GREET, REPLY))).toEqual([bytes(GREET), bytes(REPLY)]);
  });

  it('drops bytes outside a message, and starts again at an F0 before the F7', () => {
    const a = new SysexAssembler();
    expect(a.push(bytes([0x90, 60, 100], GREET.slice(0, 4), REPLY))).toEqual([bytes(REPLY)]);
    expect(a.push([0xf7])).toEqual([]);
  });
});
