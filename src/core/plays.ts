// What an input plays (yggi/webmidi#43, decision 003): one mechanism for whether an input is heard and what it drives,
// kept in the setup (`Setup.plays`, changed by `withPlays`). Read here against the frontend's rows, which webmidi doesn't
// know: a choice keeps its row and its role, so a setup moves between pieces and frontends.

import type { PortOption } from './port';
import { activeSetup, ANY_INPUT, inputRow, isPanelKey, panelKey, type PlaysChoice, type Setup, type SetupBook } from './setups';

/** A row an input can play, as the frontend has it: its id and, where it has one, its role (`'lead'`, `'drums'`). */
export interface PlayableRow {
  readonly id: string;
  readonly role?: string;
}

/** An input's row: as given, or a port's (`in:<name>`). */
const rowOf = (input: PortOption | string): string => (typeof input === 'string' ? input : inputRow(input));

/**
 * The choice that holds for an input in a setup: its own, else every input's (`ANY_INPUT`), else not heard. A panel's
 * row (`panelKey(id)`, yggi/webmidi#71) is the same but for the middle: its own, else not heard, since what every
 * input plays is not a panel's to follow.
 */
export function choiceOf(setup: Setup, input: PortOption | string): PlaysChoice {
  const row = rowOf(input);
  if (Object.hasOwn(setup.plays, row)) return setup.plays[row]!;
  if (isPanelKey(row)) return 'none';
  return Object.hasOwn(setup.plays, ANY_INPUT) ? setup.plays[ANY_INPUT]! : 'none';
}

/** Whether an input is heard in a setup: anything but `'none'`. */
export const isHeard = (setup: Setup, input: PortOption | string): boolean => choiceOf(setup, input) !== 'none';

/**
 * What an input plays now in the setup in use, among the frontend's `rows`: a row's id (its own, else the first row of
 * its role), `'default'` (chosen so, or its row and role both missing here), or null: not heard.
 */
export function playsOf(book: SetupBook, input: PortOption | string, rows: readonly PlayableRow[]): string | 'default' | null {
  const choice = choiceOf(activeSetup(book), input);
  if (choice === 'none') return null;
  if (choice === 'default') return 'default';
  if (rows.some((r) => r.id === choice.row)) return choice.row;
  return (choice.role !== undefined && rows.find((r) => r.role === choice.role)?.id) || 'default';
}

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
export function playedBy(book: SetupBook, source: PortOption | string, rows: readonly PlayableRow[], data: ArrayLike<number>): PlayedMessage | null {
  const status = data[0] ?? 0;
  if (status < 0x80 || status >= 0xf0) return null;
  const plays = playsOf(book, source, rows);
  return plays === null ? null : { plays, data: Array.from(data) };
}

/**
 * What a message a panel sends plays among the frontend's `rows` (yggi/webmidi#71, decision 007): for a frontend's
 * adapter, one call per message the panel's runtime hands out (`PanelForward.panel` is the id). A panel's `note` and
 * `cc` bindings play what an input's do; a message a panel is sent (feedback) is not here, nothing plays it.
 */
export const panelPlays = (book: SetupBook, panel: string, rows: readonly PlayableRow[], data: ArrayLike<number>): PlayedMessage | null =>
  playedBy(book, panelKey(panel), rows, data);

/** A port to listen to from an input's row, matched by name, or by id where the row kept the id (no name then). */
const portOfRow = (row: string): PortOption => ({ id: row.slice(3), name: row.slice(3) });

/** The inputs heard in a setup, as `MidiAccess.listen` takes them: `'all'` when every input's choice is heard. */
export function heardOf(setup: Setup): 'all' | readonly PortOption[] {
  if (isHeard(setup, ANY_INPUT)) return 'all';
  return Object.keys(setup.plays)
    .filter((row) => row.startsWith('in:') && row !== ANY_INPUT && isHeard(setup, row))
    .map(portOfRow);
}

/**
 * The inputs to listen to for a setup: those heard, and those whose row is routed in any context (forwarded, if not
 * heard); `'all'` when every input is heard or routed. Listened to is not heard: under `'all'` an input whose own choice
 * is `'none'` is still listened to (a port can't be left out of `'all'`), so a frontend asks `isHeard` of each message's
 * input before its instruments take it, and uses this only to open ports.
 */
export function listenOf(setup: Setup): 'all' | readonly PortOption[] {
  const heard = heardOf(setup);
  if (heard === 'all') return 'all';
  const routed = new Set<string>();
  for (const routes of Object.values(setup.routes))
    for (const [row, crossings] of Object.entries(routes)) if (row.startsWith('in:') && Object.keys(crossings).length) routed.add(row);
  if (routed.has(ANY_INPUT)) return 'all';
  const rows = new Set([...heard.map((p) => inputRow(p)), ...routed]);
  return [...rows].map(portOfRow);
}
