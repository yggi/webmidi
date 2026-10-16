// Lifted from yggi/cell-studio src/midi/routing.ts @ 3813fbb, which lifted it from yggi/jambot apps/web/src/midi/routing.ts
// @ 8cdb6b8 (adoptPorts, connectMidi, portsMessage). The connection is structural (`PortAccess`), not Web MIDI's class.

import type { MidiPort, PortAccess, PortOption } from './port';

/** The ports chosen, as the settings keep them (by id and name; `'none'`, or for the input `'all'`), and the live output they resolve to. */
export interface ChosenPorts {
  outPortId: string;
  outPortName: string;
  inPortId: string;
  inPortName: string;
  outPort: MidiPort | null;
}

/** The id a chosen port has now: its own if it is there, else that of a port with the same name (ids change on replug on some systems), else its own. */
const idNow = (ports: readonly PortOption[], id: string, name: string): string =>
  id === 'none' || id === 'all' || ports.some((p) => p.id === id) ? id : (ports.find((p) => name && p.name === name)?.id ?? id);

/** The live output a port chosen resolves to now (by id, else by name: see `idNow`), or null: none chosen, or not plugged in. */
export function outputNow(access: Pick<PortAccess, 'outputs' | 'outputPort'>, chosen: PortOption): MidiPort | null {
  if (chosen.id === 'none') return null;
  return access.outputPort(idNow(access.outputs, chosen.id, chosen.name));
}

/**
 * Adopt the ports chosen from the connection as it is now: the output by its id (or its name: see `idNow`), none if it
 * is gone or was never chosen, and the input listened to. A port unplugged and plugged in again is a new object, so this
 * runs whenever the ports may have changed.
 */
export function adoptPorts(access: PortAccess, chosen: ChosenPorts): void {
  const out = idNow(access.outputs, chosen.outPortId, chosen.outPortName);
  if (out !== chosen.outPortId) chosen.outPortId = out;
  chosen.outPort = out === 'none' ? null : access.outputPort(out);
  const inp = idNow(access.inputs, chosen.inPortId, chosen.inPortName);
  if (inp !== chosen.inPortId) chosen.inPortId = inp;
  access.listen(inp);
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
