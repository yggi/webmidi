// Lifted from yggi/cell-studio src/midi/surfaces.test.ts @ 3813fbb (partly lifted there from yggi/jambot
// apps/web/src/midi/surfaces.test.ts @ 8cdb6b8), and the parser's cases of src/midi/access.test.ts there (the rest of that
// file is the Web MIDI adapter's, which comes with `web`).
import { describe, expect, it } from 'vitest';
import { COMPUTER_KEY_MAP, DRUM_KEY_MAP, ignoreKeyEvent, parseMidiMessage, parseSustain } from './surfaces';

const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe('ignoreKeyEvent: the editor and the fields keep their keys', () => {
  it('leaves typing in an input, a select, a text area or the code editor (a contenteditable) alone', () => {
    for (const t of [el('INPUT'), el('SELECT'), el('TEXTAREA'), el('DIV', true)]) expect(ignoreKeyEvent(t, false, false)).toBe(true);
  });
  it('leaves a held key repeating, and a chord with a modifier (a shortcut), alone', () => {
    expect(ignoreKeyEvent(el('BODY'), true, false)).toBe(true);
    expect(ignoreKeyEvent(el('BODY'), false, true)).toBe(true);
  });
  it('plays a key pressed anywhere else', () => {
    expect(ignoreKeyEvent(el('BODY'), false, false)).toBe(false);
    expect(ignoreKeyEvent(el('BUTTON'), false, false)).toBe(false);
    expect(ignoreKeyEvent(null, false, false)).toBe(false);
  });
});

describe('the computer keys', () => {
  it('a to l are the white keys and w e t y u o the black ones, C4 to D5, each a different note', () => {
    expect(Object.values(COMPUTER_KEY_MAP)).toEqual(Array.from({ length: 15 }, (_, i) => 60 + i));
    expect(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map((k) => COMPUTER_KEY_MAP[k] % 12)).toEqual([0, 2, 4, 5, 7, 9, 11, 0, 2]);
  });
  it('1 to 7 are General MIDI drums, each a different one', () => {
    expect(new Set(Object.values(DRUM_KEY_MAP)).size).toBe(7);
    expect(DRUM_KEY_MAP['1']).toBe(36);
  });
});

describe('parseSustain: CC 64', () => {
  it('down from 64, up below, with its channel', () => {
    for (let v = 0; v <= 127; v++) expect(parseSustain([0xb3, 64, v])).toEqual({ down: v >= 64, channel: 3 });
  });
  it('is nothing for another controller, a note or a short message', () => {
    expect(parseSustain([0xb0, 7, 100])).toBeNull();
    expect(parseSustain([0x90, 64, 100])).toBeNull();
    expect(parseSustain([0xb0])).toBeNull();
  });
});

describe('parseMidiMessage', () => {
  it('a note-on with velocity 0 is a note-off', () => {
    expect(parseMidiMessage([0x90, 60, 0])).toMatchObject({ on: false, note: 60 });
    expect(parseMidiMessage([0x99, 36, 90])).toMatchObject({ on: true, note: 36, velocity: 90, channel: 9 });
  });
});

// Lifted from yggi/cell-studio src/midi/access.test.ts @ 3813fbb: its parser's cases, but for a note-off's velocity,
// which is its own (64 here) where Cell studio's read 0: the hub's midi-rx contract.
describe('parseMidiMessage', () => {
  it('reads a note-on with velocity 0 as a note-off, on every channel', () => {
    for (let c = 0; c < 16; c++) {
      expect(parseMidiMessage([0x90 | c, 60, 100])).toMatchObject({ on: true, note: 60, velocity: 100, channel: c });
      expect(parseMidiMessage([0x90 | c, 60, 0])).toMatchObject({ on: false, note: 60, velocity: 0, channel: c });
      expect(parseMidiMessage([0x80 | c, 60, 64])).toMatchObject({ on: false, note: 60, velocity: 64, channel: c });
    }
  });

  it('reads nothing else as a note', () => {
    expect(parseMidiMessage([0xb0, 123, 0])).toBeNull();
    expect(parseMidiMessage([0xf8])).toBeNull();
    expect(parseMidiMessage([])).toBeNull();
  });
});

// New: the hub's midi-rx contract asks that a message cut short completes nothing (src/contracts.test.ts).
describe('a message cut short', () => {
  it('is nothing: no note, no pedal', () => {
    expect(parseMidiMessage([0x90, 60])).toBeNull();
    expect(parseMidiMessage([0x80, 60])).toBeNull();
    expect(parseSustain([0xb0, 64])).toBeNull();
  });
});
