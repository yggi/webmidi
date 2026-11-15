// Lifted from yggi/cell-studio src/midi/routing.ts @ 3813fbb, which lifted it from yggi/jambot apps/web/src/midi/routing.ts
// @ 8cdb6b8 (adoptPorts, connectMidi, portsMessage). The connection is structural (`PortAccess`), not Web MIDI's class.

import { matchPorts, type MidiPort, type PortAccess, type PortOption } from './port';
import { isBuiltIn } from './setups';

/** The ports chosen, as the settings keep them (by id and name; `'none'`, or for the input `'all'`), and the live output they resolve to. */
export interface ChosenPorts {
  outPortId: string;
  outPortName: string;
  inPortId: string;
  inPortName: string;
  outPort: MidiPort | null;
}

/**
 * The live output a port chosen resolves to now (`matchPorts`), or null: none chosen, the built-in (no port:
 * `BUILT_IN`), or not plugged in. A port plugged in under the chosen one's id and another name is not it. For several
 * outputs at once, `portsOf`: two of one name are then two ports.
 */
export function outputNow(access: Pick<PortAccess, 'outputs' | 'outputPort'>, chosen: PortOption): MidiPort | null {
  if (chosen.id === 'none' || isBuiltIn(chosen)) return null;
  const port = matchPorts([chosen], access.outputs)[0];
  return port ? access.outputPort(port.id) : null;
}

/**
 * Adopt the ports chosen from the connection as it is now: the output by its id (or its name: see `idNow`), none if it
 * is gone or was never chosen, and the input listened to. A port unplugged and plugged in again is a new object, so this
 * runs whenever the ports may have changed.
 */
export function adoptPorts(access: PortAccess, chosen: ChosenPorts): void {
  const out = matchPorts([{ id: chosen.outPortId, name: chosen.outPortName }], access.outputs)[0];
  if (out && out.id !== chosen.outPortId) chosen.outPortId = out.id;
  chosen.outPort = out ? access.outputPort(out.id) : null;
  const special = chosen.inPortId === 'all' || chosen.inPortId === 'none';
  const inp = special ? null : matchPorts([{ id: chosen.inPortId, name: chosen.inPortName }], access.inputs)[0];
  if (inp && inp.id !== chosen.inPortId) chosen.inPortId = inp.id;
  // (an input not plugged in whose id is another device's now: nothing is listened to; one whose id is nowhere is kept, for when it comes)
  const others = !special && !inp && access.inputs.some((p) => p.id === chosen.inPortId);
  access.listen(others ? 'none' : (inp?.id ?? chosen.inPortId));
}

/** What was found, in a line: "MIDI connected: 1 input, 2 outputs." */
export function portsMessage(ports: { readonly inputs: readonly unknown[]; readonly outputs: readonly unknown[] }): string {
  const count = (list: readonly unknown[], noun: string) => `${list.length} ${noun}${list.length === 1 ? '' : 's'}`;
  return `MIDI connected: ${count(ports.inputs, 'input')}, ${count(ports.outputs, 'output')}.`;
}

/**
 * Connect, then adopt the ports already chosen: the connection and what was found, or why it couldn't connect. `alive`
 * false once the connection comes (its owner gone while asking): nothing is adopted, the caller closes it.
 */
export async function connectMidi<A extends PortAccess>(
  connect: () => Promise<A | string>,
  chosen: ChosenPorts,
  alive: () => boolean = () => true,
): Promise<{ access: A | null; message: string }> {
  const result = await connect();
  if (typeof result === 'string') return { access: null, message: result };
  if (alive()) adoptPorts(result, chosen);
  return { access: result, message: portsMessage(result) };
}
