/**
 * The on-screen keyboard's layout (yggi/cell-studio#255): which keys a range of octaves shows, where each sits (percent
 * of the width over the white keys), its name, and how hard a key struck at a height is played. Pure: a frontend draws
 * it (Cell studio's `ui/PianoKeys.svelte`).
 */
export declare const isBlackKey: (note: number) => boolean;
export interface KeyLayout {
    readonly note: number;
    readonly black: boolean;
    /** Percent from the left. */
    readonly left: number;
    /** Percent wide. */
    readonly width: number;
}
/** The keys `low` to `high` (MIDI notes), as percent positions over the white keys' width; a black key straddles the line after its white. */
export declare function keyboardLayout(low: number, high: number): readonly KeyLayout[];
/** The octave a keyboard is centred on, lowest and highest (C-1 … C9: MIDI's 0 … 127 in whole octaves from C). */
export declare const OCTAVE_MIN = -1;
export declare const OCTAVE_MAX = 9;
/**
 * The keys shown for `octaves` octaves around `octave` (4: middle C's): from the C a little below it to the C that
 * closes the last octave, inside MIDI's 0 … 127 (the top G9 when it runs past).
 */
export declare function keyRange(octave: number, octaves: number): {
    readonly low: number;
    readonly high: number;
};
/** How many octaves fit a width (px): a white key no narrower than a finger, 1 to 4. */
export declare const octavesFor: (width: number) => number;
/** A key's name, scientific pitch (C4 middle C, sharps and flats as the theory names them): what a screen reader says. */
export declare const keyName: (note: number) => string;
/** The softest velocity a key gives when struck at its very top; its bottom gives 127 (lower is louder, as a piano's key). */
export declare const SOFTEST = 32;
/** The velocity (1 … 127) of a key struck `y` px down a key `height` px tall: lower is louder; outside the key, its edge. */
export declare function velocityAt(y: number, height: number): number;
