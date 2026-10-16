// Lifted from yggi/cell-studio src/layout/keyboard.test.ts @ 3813fbb.
import { describe, expect, it } from 'vitest';
import { isBlackKey, keyboardLayout, keyName, keyRange, octavesFor, OCTAVE_MAX, OCTAVE_MIN, SOFTEST, velocityAt } from './keyboard';

describe('isBlackKey', () => {
  it('C♯ D♯ F♯ G♯ B♭ are black, in every octave of MIDI 0 … 127', () => {
    for (let note = 0; note <= 127; note++) expect(isBlackKey(note), `${note}`).toBe([1, 3, 6, 8, 10].includes(note % 12));
  });
});

describe('keyboardLayout over a range of octaves', () => {
  for (const [octave, octaves] of [
    [4, 1],
    [4, 2],
    [3, 3],
    [4, 4],
    [OCTAVE_MIN, 1],
    [OCTAVE_MAX, 4],
  ] as const)
    it(`${octaves} octave(s) around octave ${octave}: every key once, whites edge to edge over 100 %, each black across the line after its white`, () => {
      const { low, high } = keyRange(octave, octaves);
      const keys = keyboardLayout(low, high);
      expect(keys.map((k) => k.note)).toEqual(Array.from({ length: high - low + 1 }, (_, i) => low + i));
      const whites = keys.filter((k) => !k.black);
      whites.forEach((w, i) => {
        expect(w.left).toBeCloseTo((100 / whites.length) * i, 9);
        expect(w.width).toBeCloseTo(100 / whites.length, 9);
      });
      expect(whites.at(-1)!.left + whites.at(-1)!.width).toBeCloseTo(100, 9);
      for (const b of keys.filter((k) => k.black)) {
        const below = whites.find((w) => w.note === b.note - 1)!;
        const line = below.left + below.width;
        expect(b.left).toBeLessThan(line);
        expect(b.left + b.width).toBeGreaterThan(line);
        expect(b.left + b.width / 2).toBeCloseTo(line, 9);
      }
    });

  it('one octave from C4: 8 whites (C4 … C5) and 5 blacks', () => {
    const keys = keyboardLayout(60, 72);
    expect(keys.filter((k) => !k.black).map((k) => keyName(k.note))).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(keys.filter((k) => k.black).map((k) => keyName(k.note))).toEqual(['C♯4', 'E♭4', 'F♯4', 'A♭4', 'B♭4']);
  });
});

describe('keyRange', () => {
  it('centres on the octave asked, from a C to the C that closes the last octave', () => {
    expect(keyRange(4, 1)).toEqual({ low: 60, high: 72 });
    expect(keyRange(4, 2)).toEqual({ low: 60, high: 84 });
    expect(keyRange(4, 3)).toEqual({ low: 48, high: 84 });
    expect(keyRange(4, 4)).toEqual({ low: 48, high: 96 });
  });

  it('stays inside MIDI 0 … 127 at every octave and width', () => {
    for (let octave = OCTAVE_MIN - 3; octave <= OCTAVE_MAX + 3; octave++)
      for (let n = 1; n <= 4; n++) {
        const { low, high } = keyRange(octave, n);
        expect(low % 12).toBe(0);
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(127);
        expect(high).toBeGreaterThan(low);
      }
    expect(keyRange(OCTAVE_MIN, 1)).toEqual({ low: 0, high: 12 });
    expect(keyRange(OCTAVE_MAX, 1)).toEqual({ low: 120, high: 127 });
  });
});

describe('octavesFor a width', () => {
  it('one on a phone, more on wider screens, never more than four', () => {
    expect(octavesFor(0)).toBe(1);
    expect(octavesFor(390)).toBe(1);
    expect(octavesFor(800)).toBe(3);
    expect(octavesFor(1400)).toBe(4);
    expect(octavesFor(5000)).toBe(4);
  });
});

describe('keyName', () => {
  it('scientific pitch, middle C = C4, every key 0 … 127', () => {
    expect(keyName(0)).toBe('C-1');
    expect(keyName(60)).toBe('C4');
    expect(keyName(69)).toBe('A4');
    expect(keyName(127)).toBe('G9');
    const names = new Set(Array.from({ length: 128 }, (_, n) => keyName(n)));
    expect(names.size).toBe(128);
  });
});

describe('velocityAt: lower is louder', () => {
  it('the top SOFTEST, the bottom 127, rising every step down; off the key, its edge', () => {
    expect(velocityAt(0, 100)).toBe(SOFTEST);
    expect(velocityAt(100, 100)).toBe(127);
    for (let y = 1; y <= 100; y++) expect(velocityAt(y, 100)).toBeGreaterThanOrEqual(velocityAt(y - 1, 100));
    expect(velocityAt(-20, 100)).toBe(SOFTEST);
    expect(velocityAt(500, 100)).toBe(127);
    expect(velocityAt(NaN, 100)).toBe(127);
    expect(velocityAt(10, 0)).toBe(127);
  });
});
