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
 * message (status 0x80–0xEF) once to each output crossed, once on each channel of the crossing (1–16, ascending: a
 * crossing may hold several, decision 010), its channel replaced, or kept as it came (`AS_PLAYED`); the built-in, which takes no MIDI, none, and a panel's column none here (`panelForwardsOf`: a panel is no port). Nothing else is forwarded: a system message (0xF0–0xFF: SysEx, the clock, Start and Stop, which are
 * the clock row's and a device's own) and a message with no status byte (Web MIDI delivers whole messages).
 */
export declare function forwardsOf(book: SetupBook, context: string, row: string, data: ArrayLike<number>): Forward[];
/** A message to hand to one panel active in the setup in use, by its id: its controls move by it (`PanelRuntime.receive`). */
export interface PanelForward {
    readonly panel: string;
    readonly data: readonly number[];
}
/**
 * The messages a raw message on `row` sends to panels (decision 007): once to each panel active in the setup in use
 * whose column the row crosses in `context`, re-channelled as `forwardsOf` does; never to the row's own panel, and
 * only channel voice messages. For an input, its own row and every input's (`ANY_INPUT`, where it is heard), a panel
 * sent the same bytes once.
 */
export declare function panelForwardsOf(book: SetupBook, context: string, row: string | PortOption, data: ArrayLike<number>): PanelForward[];
/**
 * The messages a raw message from an input sends: by its own row (`in:<name>`), and by every input's (`ANY_INPUT`) if
 * the input is heard, as `ANY_INPUT` is every input heard (decision 003); the same bytes to one output sent once.
 */
export declare function forwardsOfInput(book: SetupBook, context: string, input: PortOption, data: ArrayLike<number>): Forward[];
/**
 * The messages a raw message from an input sends where the row it plays is sent (yggi/webmidi#29, decision 003): Cell
 * studio's keys thru, the keys heard on the voice they play; `input` may be a panel's row (`panelKey(id)`, #71). The row is what `playsOf` says among the frontend's `rows`;
 * playing the default, it is `defaultRow`, the frontend's (the open sheet's voice), or nothing without one; not heard,
 * nothing. Each message is re-channelled by that row's crossings, as `forwardsOf` does.
 */
export declare function forwardsAsPlayed(book: SetupBook, context: string, input: PortOption | string, rows: readonly PlayableRow[], data: ArrayLike<number>, defaultRow?: string): Forward[];
