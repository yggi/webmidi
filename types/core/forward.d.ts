import type { PortOption } from './port';
import { type PlayableRow } from './plays';
import { type SetupBook } from './setups';
/** A message to send to one output of the setup in use, by its key. */
export interface Forward {
    readonly output: string;
    readonly data: readonly number[];
}
/**
 * The messages a raw message on `row` sends, by the setup in use's crossings of that row in `context`: a channel voice
 * message (status 0x80–0xEF) once to each output crossed, its channel replaced by the crossing's (1–16), or kept as it
 * came (`AS_PLAYED`). Nothing else is forwarded: a system message (0xF0–0xFF: SysEx, the clock, Start and Stop, which are
 * the clock row's and a device's own) and a message with no status byte (Web MIDI delivers whole messages).
 */
export declare function forwardsOf(book: SetupBook, context: string, row: string, data: ArrayLike<number>): Forward[];
/**
 * The messages a raw message from an input sends: by its own row (`in:<name>`), and by every input's (`ANY_INPUT`) if
 * the input is heard, as `ANY_INPUT` is every input heard (decision 003); the same bytes to one output sent once.
 */
export declare function forwardsOfInput(book: SetupBook, context: string, input: PortOption, data: ArrayLike<number>): Forward[];
/**
 * The messages a raw message from an input sends where the row it plays is sent (yggi/webmidi#29, decision 003): Cell
 * studio's keys thru, the keys heard on the voice they play. The row is what `playsOf` says among the frontend's `rows`;
 * playing the default, it is `defaultRow`, the frontend's (the open sheet's voice), or nothing without one; not heard,
 * nothing. Each message is re-channelled by that row's crossings, as `forwardsOf` does.
 */
export declare function forwardsAsPlayed(book: SetupBook, context: string, input: PortOption, rows: readonly PlayableRow[], data: ArrayLike<number>, defaultRow?: string): Forward[];
