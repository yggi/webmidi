// Lifted from yggi/cell-studio src/layout/keyboard.ts @ 3813fbb (keyboardLayout and isBlackKey lifted there from yggi/jambot
// apps/web/src/midi/surfaces.ts @ 8cdb6b8); NOTE_NAMES lifted from yggi/cells src/theory/modes.ts @ 41ef16b.
/**
 * The on-screen keyboard's layout (yggi/cell-studio#255): which keys a range of octaves shows, where each sits (percent
 * of the width over the white keys), its name, and how hard a key struck at a height is played. Pure: a frontend draws
 * it (Cell studio's `ui/PianoKeys.svelte`).
 */

/** The pitch classes' names, C = 0, sharps and flats as the theory names them (cells' `NOTE_NAMES`). */
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

export const isBlackKey = (note: number): boolean => [1, 3, 6, 8, 10].includes(((note % 12) + 12) % 12);

export interface KeyLayout {
  readonly note: number;
  readonly black: boolean;
  /** Percent from the left. */
  readonly left: number;
  /** Percent wide. */
  readonly width: number;
}

/** The keys `low` to `high` (MIDI notes), as percent positions over the white keys' width; a black key straddles the line after its white. */
export function keyboardLayout(low: number, high: number): readonly KeyLayout[] {
  const whites: number[] = [];
  for (let note = low; note <= high; note++) if (!isBlackKey(note)) whites.push(note);
  const width = 100 / whites.length;
  const layout: KeyLayout[] = [];
  for (let note = low; note <= high; note++) {
    if (!isBlackKey(note)) {
      layout.push({ note, black: false, left: whites.indexOf(note) * width, width });
    } else {
      const below = whites.indexOf(note - 1);
      layout.push({ note, black: true, left: (below + 1) * width - width * 0.3, width: width * 0.6 });
    }
  }
  return layout;
}

/** The octave a keyboard is centred on, lowest and highest (C-1 … C9: MIDI's 0 … 127 in whole octaves from C). */
export const OCTAVE_MIN = -1;
export const OCTAVE_MAX = 9;

/**
 * The keys shown for `octaves` octaves around `octave` (4: middle C's): from the C a little below it to the C that
 * closes the last octave, inside MIDI's 0 … 127 (the top G9 when it runs past).
 */
export function keyRange(octave: number, octaves: number): { readonly low: number; readonly high: number } {
  const n = Math.max(1, Math.round(octaves));
  const first = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX - n + 1, Math.round(octave) - Math.floor((n - 1) / 2)));
  const low = 12 * (first + 1);
  return { low, high: Math.min(127, low + 12 * n) };
}

/** How many octaves fit a width (px): a white key no narrower than a finger, 1 to 4. */
export const octavesFor = (width: number): number => Math.max(1, Math.min(4, Math.floor(width / 260)));

/** A key's name, scientific pitch (C4 middle C, sharps and flats as the theory names them): what a screen reader says. */
export const keyName = (note: number): string => `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;

/** The softest velocity a key gives when struck at its very top; its bottom gives 127 (lower is louder, as a piano's key). */
export const SOFTEST = 32;

/** The velocity (1 … 127) of a key struck `y` px down a key `height` px tall: lower is louder; outside the key, its edge. */
export function velocityAt(y: number, height: number): number {
  const t = height > 0 && Number.isFinite(y) ? Math.max(0, Math.min(1, y / height)) : 1;
  return Math.round(SOFTEST + (127 - SOFTEST) * t);
}
