// Lifted from yggi/cell-studio src/midi/access.ts @ 3813fbb (its interfaces MidiPort and PortOption; lifted there from
// yggi/jambot apps/web/src/midi/access.ts @ 8cdb6b8). The Web MIDI connection that makes them is `web`'s.

/** Where messages go: a Web MIDI output, or a fake in the tests. */
export interface MidiPort {
  send(data: readonly number[], timestamp?: number): void;
}

/** A port as a select lists it. */
export interface PortOption {
  readonly id: string;
  readonly name: string;
}

/**
 * The inputs listened to: one by id, `'all'` or `'none'`, or several (a setup's `heard`, yggi/webmidi#27), each found by
 * its id, else by its name (an id changes on replug on some systems).
 */
export type Listened = string | readonly PortOption[];

/** Whether an input (by id and name) is among those listened to. */
export function isListened(listened: Listened, id: string, name: string | null | undefined): boolean {
  if (typeof listened === 'string') return listened === 'all' || listened === id;
  return listened.some((p) => p.id === id || (!!p.name && p.name === name));
}

/**
 * A live connection, as far as adopting ports needs it: the ports plugged in, an output by id, and which inputs are
 * listened to (`Listened`). The Web MIDI adapter is one; a test's fake is another.
 */
export interface PortAccess {
  readonly inputs: readonly PortOption[];
  readonly outputs: readonly PortOption[];
  outputPort(id: string): MidiPort | null;
  listen(inputs: Listened): void;
}
