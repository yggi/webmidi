// A setup's ports as they are plugged in now (yggi/webmidi#28): `adoptPorts` and `ChosenPorts` (routing.ts) keep one
// output and one input; a setup has several of each. Nothing here changes what a person chose, so nothing makes a
// custom variant (decision 002): a replug is not a change to the setup.

import type { MidiPort, PortAccess, PortOption } from './port';
import { outputNow } from './routing';
import { inputRow, type Routes, type Setup, type SetupBook } from './setups';

/** An output of a setup as it resolves now: its key, and its live port, or null (no device, or not plugged in). */
export interface LiveOutput {
  readonly key: string;
  readonly port: MidiPort | null;
}

/**
 * The live ports of a setup: each output by its id, else by its name (an id changes on replug on some systems, as
 * `outputNow` finds it), in the setup's order; and the inputs to listen to, its `heard` as `MidiAccess.listen` takes it.
 * The book keeps the ids it has: the name finds the port, so a replug changes nothing kept.
 */
export function portsOf(setup: Setup, access: Pick<PortAccess, 'outputs' | 'outputPort'>): { outputs: LiveOutput[]; listen: 'all' | readonly PortOption[] } {
  return {
    outputs: setup.outputs.map((o) => ({ key: o.key, port: outputNow(access, o) })),
    listen: setup.heard,
  };
}

/** A port kept by id alone, named from the ports plugged in; as it was when its id isn't plugged in, or it has a name. */
const named = <P extends PortOption>(p: P, plugged: readonly PortOption[]): P => {
  if (p.name || p.id === 'none' || p.id === 'all') return p;
  const name = plugged.find((q) => q.id === p.id)?.name;
  return name ? { ...p, name } : p;
};

/** Routes with each row renamed by `rename`, but not onto a row they have already; the same object when none is. */
function renamedRows(routes: Routes, rename: ReadonlyMap<string, string>): Routes {
  const to = (row: string) => {
    const name = rename.get(row);
    return name !== undefined && !Object.hasOwn(routes, name) ? name : row;
  };
  if (Object.keys(routes).every((row) => to(row) === row)) return routes;
  return Object.fromEntries(Object.entries(routes).map(([row, c]) => [to(row), c]));
}

/**
 * The ports a book kept by id alone, named from the ports plugged in now (a store from before that kept no names, as
 * Jambot's: `fromJambot` runs before any port is seen), in every setup, a custom variant too: each output and heard
 * input, and an input's row (`in:<id>` becomes `in:<name>`). No variant is made, since this is no change of the
 * person's. A device's profile needs no moving: it is kept by name, and a device with none takes the book's defaults.
 * The same book when nothing was named.
 */
export function namePorts(book: SetupBook, plugged: { readonly inputs: readonly PortOption[]; readonly outputs: readonly PortOption[] }): SetupBook {
  let changed = false;
  const setups = book.setups.map((s) => {
    const outputs = s.outputs.map((o) => named(o, plugged.outputs));
    const heard = s.heard === 'all' ? s.heard : s.heard.map((p) => named(p, plugged.inputs));
    // an input's row kept by id (`in:<id>`, its name unknown then) takes the input's name
    const rename = new Map(plugged.inputs.filter((p) => p.name).map((p) => [inputRow({ id: p.id, name: '' }), inputRow(p)] as const));
    const routes = Object.fromEntries(Object.entries(s.routes).map(([context, r]) => [context, renamedRows(r, rename)]));
    const same =
      outputs.every((o, i) => o === s.outputs[i]) &&
      (heard === s.heard || (heard as PortOption[]).every((p, i) => p === (s.heard as readonly PortOption[])[i])) &&
      Object.entries(routes).every(([c, r]) => r === s.routes[c]);
    if (same) return s;
    changed = true;
    return { ...s, outputs, heard, routes };
  });
  return changed ? { ...book, setups } : book;
}
