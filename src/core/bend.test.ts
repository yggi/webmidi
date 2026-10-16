// Lifted from yggi/cells src/engine/midi.test.ts @ 41ef16b: its bend cases, on webmidi's note (`bendsOf` in place of
// `midiNote`, which reads the language's played note); the case of a note no key reaches is out.test.ts's here.
import { describe, expect, it } from 'vitest';
import { BEND_CENTRE, bendMessage, bendsOf, bendValue } from './bend';

describe('bends', () => {
  it('a 14-bit value: the centre for none, the ends at the bend range, clamped past it', () => {
    expect(bendValue(0)).toBe(BEND_CENTRE);
    expect(bendValue(200)).toBe(16383);
    expect(bendValue(-200)).toBe(0);
    expect(bendValue(100)).toBe(12288);
    expect(bendValue(100, 48)).toBe(Math.round(8192 + 8192 / 48));
    expect(bendValue(5000)).toBe(16383);
    expect([bendValue(NaN), bendValue(Infinity)]).toEqual([BEND_CENTRE, BEND_CENTRE]);
  });

  it('a 12-EDO note starts on the centre and sends no bend; a microtonal one starts on its cents', () => {
    expect(bendsOf({ at: 0, end: 0.5 })).toEqual({ bend: BEND_CENTRE, bends: [] });
    const cents = (69 + 12 / 19 - 70) * 100;
    expect(bendsOf({ at: 0, end: 0.5, cents }).bend).toBe(bendValue(cents));
  });

  it("a note's bends become bend messages; a ramp is sampled from the point before, a step jumps", () => {
    const n = bendsOf({
      at: 0,
      end: 1,
      bends: [
        { at: 0.2, cents: 100 },
        { at: 0.3, cents: 0, ramp: true },
        { at: 2, cents: 50 },
      ],
    });
    expect(n.bends[0]).toEqual({ at: 0.2, value: 12288 });
    // (the ramp back to 0 between 0.2 and 0.3, every 20 ms, then 0 at 0.3; the bend after the note's end is dropped)
    expect(n.bends.map((b) => +b.at.toFixed(3))).toEqual([0.2, 0.22, 0.24, 0.26, 0.28, 0.3]);
    expect(n.bends.at(-1)!.value).toBe(BEND_CENTRE);
    for (let i = 2; i < n.bends.length; i++) expect(n.bends[i].value).toBeLessThan(n.bends[i - 1].value);
  });
});

describe('bendMessage', () => {
  it('is 0xE0 and the channel nibble, then the 14 bits LSB first: the centre is 0 64, the top 127 127', () => {
    expect(bendMessage(1, BEND_CENTRE)).toEqual([0xe0, 0, 64]);
    expect(bendMessage(16, 16383)).toEqual([0xef, 127, 127]);
    expect(bendMessage(3, 0)).toEqual([0xe2, 0, 0]);
    for (let v = 0; v <= 16383; v += 127) {
      const [, lsb, msb] = bendMessage(1, v);
      expect(lsb! | (msb! << 7)).toBe(v);
    }
  });
});
