/** The bend range most synths start with, in semitones each way; an MPE synth takes 48. */
export declare const DEFAULT_BEND_RANGE = 2;
/** A pitch bend's centre: no bend. */
export declare const BEND_CENTRE = 8192;
/** Cents of bend as a 14-bit pitch-bend value (0 … 16383, 8192 the centre) on a synth bending `range` semitones each way. */
export declare function bendValue(cents: number, range?: number): number;
/** A pitch-bend message on a channel (1–16). */
export declare const bendMessage: (channel: number, value: number) => number[];
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
export declare function bendsOf(note: {
    readonly at: number;
    readonly end: number;
    readonly cents?: number;
    readonly bends?: readonly Bend[];
}, range?: number): {
    bend: number;
    bends: {
        at: number;
        value: number;
    }[];
};
