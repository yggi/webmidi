// Lifted from yggi/cells src/engine/midi.ts @ 41ef16b: the bend constants, `bendValue`, `bendMessage`, and the part of
// `midiNote` that turns a note's cents and bends into bend values (`bendsOf` here). Cells keeps its own copy for MIDI
// files; the duplication is accepted, and the hub's contract holds the two to one encoding.

/** The bend range most synths start with, in semitones each way; an MPE synth takes 48. */
export const DEFAULT_BEND_RANGE = 2;
/** A pitch bend's centre: no bend. */
export const BEND_CENTRE = 8192;
/** How finely a glide (a ramped bend) is sampled into bend messages, in seconds. */
const BEND_STEP = 0.02;
/** Cents off a key that count as on it (a frequency's rounding): no bend is sent for less. */
const IN_TUNE = 0.5;

/** Cents of bend as a 14-bit pitch-bend value (0 … 16383, 8192 the centre) on a synth bending `range` semitones each way. */
export function bendValue(cents: number, range = DEFAULT_BEND_RANGE): number {
  if (!Number.isFinite(cents)) return BEND_CENTRE;
  const v = Math.round(BEND_CENTRE + (cents / (100 * range)) * BEND_CENTRE);
  return Math.max(0, Math.min(16383, v));
}

/** A pitch-bend message on a channel (1–16). */
export const bendMessage = (channel: number, value: number): number[] => [0xe0 | ((channel - 1) & 15), value & 0x7f, (value >> 7) & 0x7f];

/** A bend while a note sounds: at a moment, in cents from the pitch the note starts on; a ramp glides there from the point before. */
export interface Bend {
  readonly at: number;
  readonly cents: number;
  readonly ramp?: boolean;
}

/**
 * A note's pitch as bend values on a synth bending `range` semitones: the value it starts on (its `cents` off its key;
 * the centre for a note on its key) and its bends as values at moments, each a change from the one before, a ramp
 * sampled every BEND_STEP from the point before; a bend at or after the note's end is dropped.
 */
export function bendsOf(
  note: { readonly at: number; readonly end: number; readonly cents?: number; readonly bends?: readonly Bend[] },
  range = DEFAULT_BEND_RANGE,
): { bend: number; bends: { at: number; value: number }[] } {
  const cents = note.cents ?? 0;
  const off = Math.abs(cents) < IN_TUNE ? 0 : cents;
  const value = (c: number) => (Math.abs(off + c) < IN_TUNE ? BEND_CENTRE : bendValue(off + c, range));
  const bends: { at: number; value: number }[] = [];
  let last = { at: note.at, cents: 0 };
  const push = (at: number, v: number) => {
    if (v !== (bends.at(-1)?.value ?? value(0))) bends.push({ at, value: v });
  };
  for (const b of note.bends ?? []) {
    if (b.at >= note.end) break;
    if (b.ramp && b.at > last.at) {
      for (let t = last.at + BEND_STEP; t < b.at - 1e-9; t += BEND_STEP) push(t, value(last.cents + ((b.cents - last.cents) * (t - last.at)) / (b.at - last.at)));
    }
    const at = Math.max(note.at, b.at);
    push(at, value(b.cents));
    last = { at, cents: b.cents };
  }
  return { bend: value(0), bends };
}
