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
 * Which port plugged in each port kept is now, or null: not plugged in (or `'none'`, `'all'`, which are no port).
 *
 * A port kept with its name is that name's: first the port plugged in with its id and its name, else another of its
 * name. An id alone proves nothing once the name is known, since some systems number their ports by place
 * (`output-1`), and after a replug in another order the id is another device's. A port kept by id alone (a store from
 * before names were kept) is found by its id. One port plugged in serves one port kept at most, so two devices of one
 * name are two ports, in the order they are listed.
 */
export function matchPorts(kept: readonly PortOption[], plugged: readonly PortOption[]): (PortOption | null)[] {
  const found: (PortOption | null)[] = kept.map(() => null);
  const taken = new Set<PortOption>();
  const pass = (fits: (k: PortOption, p: PortOption) => boolean) =>
    kept.forEach((k, i) => {
      if (found[i] || k.id === 'none' || k.id === 'all') return;
      const port = plugged.find((p) => !taken.has(p) && fits(k, p));
      if (port) (taken.add(port), (found[i] = port));
    });
  pass((k, p) => p.id === k.id && (!k.name || p.name === k.name));
  pass((k, p) => !!k.name && p.name === k.name);
  return found;
}

/**
 * The inputs listened to: one by id, `'all'` or `'none'`, or several (a setup's `heard`, yggi/webmidi#27), each found by
 * its name where it has one (every port of that name: the book keeps an input by its name), else by its id.
 */
export type Listened = string | readonly PortOption[];

/** Whether an input (by id and name) is among those listened to. */
export function isListened(listened: Listened, id: string, name: string | null | undefined): boolean {
  if (typeof listened === 'string') return listened === 'all' || listened === id;
  return listened.some((p) => (p.name ? p.name === name : p.id === id));
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
