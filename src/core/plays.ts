// What an input plays (yggi/webmidi#43, decision 003): one mechanism for whether an input is heard and what it drives,
// kept in the setup (`Setup.plays`, changed by `withPlays`). Read here against the frontend's rows, which webmidi doesn't
// know: a choice keeps its row and its role, so a setup moves between pieces and frontends.

import type { PortOption } from './port';
import { activeSetup, ANY_INPUT, inputRow, type PlaysChoice, type Setup, type SetupBook } from './setups';

/** A row an input can play, as the frontend has it: its id and, where it has one, its role (`'lead'`, `'drums'`). */
export interface PlayableRow {
  readonly id: string;
  readonly role?: string;
}

/** An input's row: as given, or a port's (`in:<name>`). */
const rowOf = (input: PortOption | string): string => (typeof input === 'string' ? input : inputRow(input));

/** The choice that holds for an input in a setup: its own, else every input's (`ANY_INPUT`), else not heard. */
export function choiceOf(setup: Setup, input: PortOption | string): PlaysChoice {
  const row = rowOf(input);
  if (Object.hasOwn(setup.plays, row)) return setup.plays[row]!;
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

/** A port to listen to from an input's row, matched by name, or by id where the row kept the id (no name then). */
const portOfRow = (row: string): PortOption => ({ id: row.slice(3), name: row.slice(3) });

/** The inputs heard in a setup, as `MidiAccess.listen` takes them: `'all'` when every input's choice is heard. */
export function heardOf(setup: Setup): 'all' | readonly PortOption[] {
  if (isHeard(setup, ANY_INPUT)) return 'all';
  return Object.keys(setup.plays)
    .filter((row) => row !== ANY_INPUT && isHeard(setup, row))
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
