import type { PortOption } from './port';
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
 * The messages a raw message from an input sends: by its own row (`in:<name>`) and by every input's (`ANY_INPUT`), the
 * same bytes to one output sent once.
 */
export declare function forwardsOfInput(book: SetupBook, context: string, input: PortOption, data: ArrayLike<number>): Forward[];
