import { type Crossing } from '../core/setups';
/** The 16 MIDI channels, 1–16. */
export declare const CHANNELS: readonly number[];
/** A channel's hue in degrees: the 16 spread round the wheel, so a cable to channel 10 is the same colour in the matrix, the picker and the meter. */
export declare const channelHue: (channel: number) => number;
/** A number typed into a field, rounded into lo … hi (not a number: `fallback`), as core's `withProfile` keeps it. */
export declare const clamp: (v: number, lo: number, hi: number, fallback: number) => number;
/**
 * A crossing as its chip says it (decision 010): "=" as played, a channel's number, a set of 2 or 3 joined by "+" ("1+3"),
 * and from 4 channels their count ("×4"), which stays as wide as a chip is; `crossingWords` says every channel.
 * Ranges ("1–3") are not used: they read as a count of channels, and a set is seldom a run.
 */
export declare const crossingText: (c: Crossing) => string;
/** A crossing in words, for a label or a title: "as played", "channel 1", "channels 1 and 3", "channels 1, 3 and 5". */
export declare const crossingWords: (c: Crossing) => string;
