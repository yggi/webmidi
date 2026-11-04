import type { PortOption } from './port';
import { type SetupBook } from './setups';
/**
 * Cell studio's store as a book of one setup, "Cell studio": its outputs and input; each piece's matrix as the context
 * `piece:<title>` (a channel 0, not sent there, dropped: 0 is `AS_PLAYED` in the book); the outputs whose device it sent
 * clock as the setup's clock; each device's drum map, bend range and rotation as its profile, and the ranges a device with none of its own took as the defaults.
 * The built-in sound (`internal`) stays Cell studio's.
 */
export declare function fromCellStudio(stored: unknown): SetupBook;
/** The row of what is played on Jambot's own keys (on screen and the computer's), which its thru passed on too. */
export declare const KEYS = "keys";
/**
 * Jambot's store as a book of one setup, "Jambot": its one output; the context `band`, each part a row on that output
 * at its channel; thru on, as the keys' row (`KEYS`) and the heard input's row (every input's, `ANY_INPUT`, when it
 * heard all), each sent there on the thru channel; clock on, as the output's clock; the drum map as the output device's profile.
 * Jambot keeps its ports by id alone, so `ports` (the ports plugged in now) gives their names; a device whose name isn't
 * found keeps its map as the defaults, for whichever device is chosen next. The built-in synth (`internal`) stays Jambot's.
 */
export declare function fromJambot(stored: unknown, ports: {
    readonly inputs: readonly PortOption[];
    readonly outputs: readonly PortOption[];
}): SetupBook;
