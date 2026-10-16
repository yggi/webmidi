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
 * A live connection, as far as adopting ports needs it: the ports plugged in, an output by id, and which input is
 * listened to (an id, `'all'` or `'none'`). The Web MIDI adapter is one; a test's fake is another.
 */
export interface PortAccess {
  readonly inputs: readonly PortOption[];
  readonly outputs: readonly PortOption[];
  outputPort(id: string): MidiPort | null;
  listen(id: string): void;
}
