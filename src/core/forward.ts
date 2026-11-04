// What a crossing of an input's row sends (yggi/webmidi#32, decision 002: the inputs are rows of the matrix): one rule,
// where Cell studio and Jambot each wrote their own. Pure: the frontend sends the bytes to each output's port, with its
// own timestamp.

import type { PortOption } from './port';
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
 * The messages a raw message from an input sends: by its own row (`in:<name>`) and by every input's (`ANY_INPUT`), the
 * same bytes to one output sent once.
 */
export function forwardsOfInput(book: SetupBook, context: string, input: PortOption, data: ArrayLike<number>): Forward[] {
  const out: Forward[] = [];
  for (const f of [...forwardsOf(book, context, inputRow(input), data), ...forwardsOf(book, context, ANY_INPUT, data)])
    if (!out.some((o) => o.output === f.output && o.data.length === f.data.length && o.data.every((b, i) => b === f.data[i]))) out.push(f);
  return out;
}
