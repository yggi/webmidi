/** The 16 MIDI channels, 1–16. */
export declare const CHANNELS: readonly number[];
/** A channel's hue in degrees: the 16 spread round the wheel, so a cable to channel 10 is the same colour in the matrix, the picker and the meter. */
export declare const channelHue: (channel: number) => number;
/** A number typed into a field, rounded into lo … hi (not a number: `fallback`), as core's `withProfile` keeps it. */
export declare const clamp: (v: number, lo: number, hi: number, fallback: number) => number;
