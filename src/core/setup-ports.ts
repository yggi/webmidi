// A setup's ports as they are plugged in now (yggi/webmidi#28): `adoptPorts` and `ChosenPorts` (routing.ts) keep one
// output and one input; a setup has several of each. Nothing here changes what a person chose, so nothing makes a
// custom variant (decision 002): a replug is not a change to the setup.

import type { MidiPort, PortAccess, PortOption } from './port';
import { outputNow } from './routing';
import { listenOf } from './plays';
import { inputRow, type Setup, type SetupBook } from './setups';

/** An output of a setup as it resolves now: its key, and its live port, or null (no device, or not plugged in). */
export interface LiveOutput {
  readonly key: string;
  readonly port: MidiPort | null;
}

/**
 * The live ports of a setup: each output by its id, else by its name (an id changes on replug on some systems, as
 * `outputNow` finds it), in the setup's order; and the inputs to listen to, heard or routed (`listenOf`), as
 * `MidiAccess.listen` takes them.
 * The book keeps the ids it has: the name finds the port, so a replug changes nothing kept.
 */
export function portsOf(setup: Setup, access: Pick<PortAccess, 'outputs' | 'outputPort'>): { outputs: LiveOutput[]; listen: 'all' | readonly PortOption[] } {
  return {
    outputs: setup.outputs.map((o) => ({ key: o.key, port: outputNow(access, o) })),
    listen: listenOf(setup),
  };
}

/** A port kept by id alone, named from the ports plugged in; as it was when its id isn't plugged in, or it has a name. */
const named = <P extends PortOption>(p: P, plugged: readonly PortOption[]): P => {
  if (p.name || p.id === 'none' || p.id === 'all') return p;
  const name = plugged.find((q) => q.id === p.id)?.name;
  return name ? { ...p, name } : p;
};

/** A record keyed by row with each renamed by `rename`, but not onto a key it has already; the same object when none is. */
function renamedRows<T>(rows: Readonly<Record<string, T>>, rename: ReadonlyMap<string, string>): Readonly<Record<string, T>> {
  const to = (row: string) => {
    const name = rename.get(row);
    return name !== undefined && !Object.hasOwn(rows, name) ? name : row;
  };
  if (Object.keys(rows).every((row) => to(row) === row)) return rows;
  return Object.fromEntries(Object.entries(rows).map(([row, c]) => [to(row), c]));
}

/**
 * The ports a book kept by id alone, named from the ports plugged in now (a store from before that kept no names, as
 * Jambot's: `fromJambot` runs before any port is seen), in every setup, a custom variant too: each output, and an
 * input's row (`in:<id>` becomes `in:<name>`) in what it plays and in the routes. No variant is made, since this is no change of the
 * person's. A device's profile needs no moving: it is kept by name, and a device with none takes the book's defaults.
 * The same book when nothing was named.
 */
export function namePorts(book: SetupBook, plugged: { readonly inputs: readonly PortOption[]; readonly outputs: readonly PortOption[] }): SetupBook {
  let changed = false;
  const setups = book.setups.map((s) => {
    const outputs = s.outputs.map((o) => named(o, plugged.outputs));
    // an input's row kept by id (`in:<id>`, its name unknown then) takes the input's name, in what it plays and in the routes
    const rename = new Map(plugged.inputs.filter((p) => p.name).map((p) => [inputRow({ id: p.id, name: '' }), inputRow(p)] as const));
    const plays = renamedRows(s.plays, rename);
    const routes = Object.fromEntries(Object.entries(s.routes).map(([context, r]) => [context, renamedRows(r, rename)]));
    const same = outputs.every((o, i) => o === s.outputs[i]) && plays === s.plays && Object.entries(routes).every(([c, r]) => r === s.routes[c]);
    if (same) return s;
    changed = true;
    return { ...s, outputs, plays, routes };
  });
  return changed ? { ...book, setups } : book;
}
