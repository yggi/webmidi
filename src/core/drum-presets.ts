// Lifted from yggi/cell-studio src/midi/drum-presets.ts @ 3813fbb, which adapted it from yggi/jambot
// apps/web/src/midi/drum-presets.ts @ 8cdb6b8: keyed by General MIDI note, not by Jambot's drum sounds.

/**
 * Drum maps a person can start from, since a hardware drum machine's pads often don't speak General MIDI. A frontend
 * writes General MIDI (cells' `engine/midi.ts` gives a kit member's note by its name); a device's map is applied only
 * here, at the output (`out.ts`). A map sends a General MIDI note as another; a note it doesn't list goes out as it is.
 *
 * 'GM' sends every note as it is. 'Novation Circuit': the original Circuit and Circuit Tracks have four drum tracks on
 * channel 10, answering only notes 60, 62, 64 and 65 (Novation's Programmer's Reference Guides). Each pad plays whatever
 * sample is on it, so the sounds are grouped by the nearest gesture, a start to edit from: the kick alone; rim, snare,
 * clap and the toms; the closed and pedal hats; the open hat, ride and crash.
 */
export type DrumMap = Readonly<Record<number, number>>;

export const DRUM_PRESETS: Readonly<Record<string, DrumMap>> = {
  GM: {},
  'Novation Circuit': { 36: 60, 37: 62, 38: 62, 39: 62, 41: 62, 45: 62, 48: 62, 42: 64, 44: 64, 46: 65, 51: 65, 49: 65 },
};

/** The note a General MIDI drum note goes out as, under a map. */
export const deviceNote = (map: DrumMap, gm: number): number => map[gm] ?? gm;

/** Which preset a map is, note for note (a note not listed counts as sent as it is), or 'Custom' for one edited by hand. */
export function presetNameOf(map: DrumMap): string {
  for (const [name, preset] of Object.entries(DRUM_PRESETS)) {
    const notes = new Set([...Object.keys(preset), ...Object.keys(map)].map(Number));
    if ([...notes].every((n) => deviceNote(preset, n) === deviceNote(map, n))) return name;
  }
  return 'Custom';
}

/**
 * The General MIDI drum notes a device's note stands for under a map, the other way round from `deviceNote`: every
 * note the map sends as it, in order (a Circuit's 62 is the rim, the snare, the clap and the toms). A note the device
 * sends that nothing is mapped onto, and that isn't itself mapped elsewhere, is General MIDI already.
 */
export function gmNotesFor(map: DrumMap, note: number): number[] {
  const out: number[] = [];
  for (let gm = 0; gm <= 127; gm++) if (deviceNote(map, gm) === note) out.push(gm);
  return out;
}
