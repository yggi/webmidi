// Lifted from yggi/cell-studio src/midi/surfaces.ts @ 3813fbb, which lifted it from yggi/jambot apps/web/src/midi/surfaces.ts
// @ 8cdb6b8 (parseMidiMessage, the computer keys, ignoreKeyEvent). ignoreKeyEvent's target is `unknown`, read by duck
// typing, so core needs no DOM types.

/** A note read off a raw MIDI message. */
export interface ParsedNote {
  readonly on: boolean;
  readonly note: number;
  readonly velocity: number;
  /** The status byte's low nibble, 0–15: channel 1 is 0, channel 10 is 9. */
  readonly channel: number;
  /** When the port saw it (the event's `timeStamp`, ms on the page's clock), not when the page got to it. */
  readonly timeStamp?: number;
}

/**
 * A note-on or note-off, or null for anything else. A note-on with velocity 0 is a note-off, as the spec allows.
 * No running status: Web MIDI delivers whole messages, and a message cut short is nothing (the hub's midi-rx contract).
 */
export function parseMidiMessage(data: ArrayLike<number>, timeStamp?: number): ParsedNote | null {
  const status = data[0];
  const note = data[1];
  const velocity = data[2];
  if (status === undefined || note === undefined || velocity === undefined) return null;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  if (command === 0x90 && velocity > 0) return { on: true, note, velocity, channel, timeStamp };
  if (command === 0x80 || command === 0x90) return { on: false, note, velocity: 0, channel, timeStamp };
  return null;
}

/** The sustain pedal (CC 64) read off a raw message: down (64 … 127) or up, its channel; null for anything else, a message cut short too. */
export function parseSustain(data: ArrayLike<number>): { readonly down: boolean; readonly channel: number } | null {
  const status = data[0];
  const value = data[2];
  if (status === undefined || (status & 0xf0) !== 0xb0 || data[1] !== 64 || value === undefined) return null;
  return { down: value >= 64, channel: status & 0x0f };
}

/** a–l for the white keys, w e t y u o for the black ones, C4 to D5. */
export const COMPUTER_KEY_MAP: Readonly<Record<string, number>> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
  o: 73,
  l: 74,
};

/** 1–7 for a kit, by General MIDI drum note: kick, snare, closed hat, open hat, pedal hat, rim, ride. */
export const DRUM_KEY_MAP: Readonly<Record<string, number>> = { '1': 36, '2': 38, '3': 42, '4': 46, '5': 44, '6': 37, '7': 51 };

/**
 * Whether a keyboard event is to be left alone: a repeat, a modifier chord, or typing into a field. A field is an input,
 * a select, a text area or anything editable (the code editor is a contenteditable, which Jambot's version missed).
 */
export function ignoreKeyEvent(target: unknown, repeat: boolean, modifier: boolean): boolean {
  if (repeat || modifier) return true;
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
}
