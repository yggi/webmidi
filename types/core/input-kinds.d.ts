import type { PortOption } from './port';
import type { PlayableRow } from './plays';
import { type SetupBook } from './setups';
/** What an input is, as far as assigning it goes. */
export type InputKind = 'keyboard' | 'pads' | 'controller';
/**
 * The kinds, by names a port of each has, tried in this order: a keyboard first, since a keyboard with pads (an MPK
 * mini, a Launchkey) plays notes from its keys, then pads, then a controller of knobs and faders. Taken from devices'
 * port names: Arturia KeyStep, KeyLab, MiniLab; Novation Launchkey, Launchpad, Launch Control; Akai MPK mini, MPD;
 * M-Audio Keystation, Oxygen; NI Komplete Kontrol, Maschine; Nektar Impact; Roland A-49; Arturia BeatStep; Korg
 * nanoKONTROL; Behringer X-Touch; Faderfox; DJ TechTools Midi Fighter.
 */
export declare const KIND_PATTERNS: readonly (readonly [InputKind, RegExp])[];
/** An input's kind from its port's name, or null: not one of the kinds. */
export declare function guessKind(name: string): InputKind | null;
/** A preset: a name, and for each kind it assigns, the role an input of that kind plays (a kind left out: nothing). */
export interface InputPreset {
    readonly name: string;
    readonly assign: readonly {
        readonly kind: InputKind;
        readonly role: string;
    }[];
}
/** The preset a frontend starts from: a keyboard plays the lead, pads the drums, a controller nothing. */
export declare const DEFAULT_PRESET: InputPreset;
/**
 * The preset applied to the inputs plugged in, in the setup in use: an input whose kind it assigns plays the frontend's
 * first row of that role, kept by its id and role. Only where the input has no choice of its own: never over a
 * person's, a "not heard" too. An input whose kind it doesn't assign, or whose role no row has, is left as it was. A
 * change to a named setup, as any; the same book when nothing was filled in.
 */
export declare function applyPreset(book: SetupBook, preset: InputPreset, inputs: readonly PortOption[], rows: readonly PlayableRow[]): SetupBook;
