// What a crossing of an input's row sends (yggi/webmidi#32, decision 002: the inputs are rows of the matrix): one rule,
// where Cell studio and Jambot each wrote their own. Pure: the frontend sends the bytes to each output's port, with its
// own timestamp.

import type { PortOption } from './port';
import { isHeard, playsOf, type PlayableRow } from './plays';
import { activeSetup, ANY_INPUT, AS_PLAYED, inputRow, type SetupBook } from './setups';

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
export function forwardsOf(book: SetupBook, context: string, row: string, data: ArrayLike<number>): Forward[] {
  const status = data[0] ?? 0;
  if (status < 0x80 || status >= 0xf0) return [];
  const routes = activeSetup(book).routes;
  const crossings = Object.hasOwn(routes, context) && Object.hasOwn(routes[context]!, row) ? routes[context]![row]! : {};
  const bytes = Array.from(data);
  return Object.entries(crossings).map(([output, channel]) => ({
    output,
    data: channel === AS_PLAYED ? bytes : [(status & 0xf0) | (channel - 1), ...bytes.slice(1)],
  }));
}

/**
 * The messages a raw message from an input sends: by its own row (`in:<name>`), and by every input's (`ANY_INPUT`) if
 * the input is heard, as `ANY_INPUT` is every input heard (decision 003); the same bytes to one output sent once.
 */
export function forwardsOfInput(book: SetupBook, context: string, input: PortOption, data: ArrayLike<number>): Forward[] {
  const out: Forward[] = [];
  const every = isHeard(activeSetup(book), input) ? forwardsOf(book, context, ANY_INPUT, data) : [];
  for (const f of [...forwardsOf(book, context, inputRow(input), data), ...every])
    if (!out.some((o) => o.output === f.output && o.data.length === f.data.length && o.data.every((b, i) => b === f.data[i]))) out.push(f);
  return out;
}

/**
 * The messages a raw message from an input sends where the row it plays is sent (yggi/webmidi#29, decision 003): Cell
 * studio's keys thru, the keys heard on the voice they play. The row is what `playsOf` says among the frontend's `rows`;
 * playing the default, it is `defaultRow`, the frontend's (the open sheet's voice), or nothing without one; not heard,
 * nothing. Each message is re-channelled by that row's crossings, as `forwardsOf` does.
 */
export function forwardsAsPlayed(book: SetupBook, context: string, input: PortOption, rows: readonly PlayableRow[], data: ArrayLike<number>, defaultRow?: string): Forward[] {
  const played = playsOf(book, input, rows);
  const row = played === 'default' ? defaultRow : played;
  return row === undefined || row === null ? [] : forwardsOf(book, context, row, data);
}
