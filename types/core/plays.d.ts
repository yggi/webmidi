import type { PortOption } from './port';
import { type PlaysChoice, type Setup, type SetupBook } from './setups';
/** A row an input can play, as the frontend has it: its id and, where it has one, its role (`'lead'`, `'drums'`). */
export interface PlayableRow {
    readonly id: string;
    readonly role?: string;
}
/**
 * The choice that holds for an input in a setup: its own, else every input's (`ANY_INPUT`), else not heard. A panel's
 * row (`panelKey(id)`, yggi/webmidi#71) is the same but for the middle: its own, else not heard, since what every
 * input plays is not a panel's to follow.
 */
export declare function choiceOf(setup: Setup, input: PortOption | string): PlaysChoice;
/** Whether an input is heard in a setup: anything but `'none'`. */
export declare const isHeard: (setup: Setup, input: PortOption | string) => boolean;
/**
 * What an input plays now in the setup in use, among the frontend's `rows`: a row's id (its own, else the first row of
 * its role), `'default'` (chosen so, or its row and role both missing here), or null: not heard.
 */
export declare function playsOf(book: SetupBook, input: PortOption | string, rows: readonly PlayableRow[]): string | 'default' | null;
/** A message a source's row plays: the frontend's row it plays (or `'default'`), and the bytes, as they came. */
export interface PlayedMessage {
    readonly plays: string | 'default';
    readonly data: readonly number[];
}
/**
 * What a raw message from an input, or from a panel's row (`panelKey(id)`), plays among the frontend's `rows`, or null:
 * not heard, or not a channel voice message (status 0x80–0xEF: the clock, SysEx and the rest are not notes, as
 * `forwardsOf` forwards none). One rule for both, so a panel plays what an input with the same choice plays.
 */
export declare function playedBy(book: SetupBook, source: PortOption | string, rows: readonly PlayableRow[], data: ArrayLike<number>): PlayedMessage | null;
/**
 * What a message a panel sends plays among the frontend's `rows` (yggi/webmidi#71, decision 007): for a frontend's
 * adapter, one call per message the panel's runtime hands out (`PanelForward.panel` is the id). A panel's `note` and
 * `cc` bindings play what an input's do; a message a panel is sent (feedback) is not here, nothing plays it.
 */
export declare const panelPlays: (book: SetupBook, panel: string, rows: readonly PlayableRow[], data: ArrayLike<number>) => PlayedMessage | null;
/** The inputs heard in a setup, as `MidiAccess.listen` takes them: `'all'` when every input's choice is heard. */
export declare function heardOf(setup: Setup): 'all' | readonly PortOption[];
/**
 * The inputs to listen to for a setup: those heard, and those whose row is routed in any context (forwarded, if not
 * heard); `'all'` when every input is heard or routed. Listened to is not heard: under `'all'` an input whose own choice
 * is `'none'` is still listened to (a port can't be left out of `'all'`), so a frontend asks `isHeard` of each message's
 * input before its instruments take it, and uses this only to open ports.
 */
export declare function listenOf(setup: Setup): 'all' | readonly PortOption[];
