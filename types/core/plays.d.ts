import type { PortOption } from './port';
import { type PlaysChoice, type Setup, type SetupBook } from './setups';
/** A row an input can play, as the frontend has it: its id and, where it has one, its role (`'lead'`, `'drums'`). */
export interface PlayableRow {
    readonly id: string;
    readonly role?: string;
}
/** The choice that holds for an input in a setup: its own, else every input's (`ANY_INPUT`), else not heard. */
export declare function choiceOf(setup: Setup, input: PortOption | string): PlaysChoice;
/** Whether an input is heard in a setup: anything but `'none'`. */
export declare const isHeard: (setup: Setup, input: PortOption | string) => boolean;
/**
 * What an input plays now in the setup in use, among the frontend's `rows`: a row's id (its own, else the first row of
 * its role), `'default'` (chosen so, or its row and role both missing here), or null: not heard.
 */
export declare function playsOf(book: SetupBook, input: PortOption | string, rows: readonly PlayableRow[]): string | 'default' | null;
/** The inputs heard in a setup, as `MidiAccess.listen` takes them: `'all'` when every input's choice is heard. */
export declare function heardOf(setup: Setup): 'all' | readonly PortOption[];
/**
 * The inputs to listen to for a setup: those heard, and those whose row is routed in any context (forwarded, if not
 * heard); `'all'` when every input is heard or routed. Listened to is not heard: under `'all'` an input whose own choice
 * is `'none'` is still listened to (a port can't be left out of `'all'`), so a frontend asks `isHeard` of each message's
 * input before its instruments take it, and uses this only to open ports.
 */
export declare function listenOf(setup: Setup): 'all' | readonly PortOption[];
