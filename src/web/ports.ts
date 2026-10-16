// Lifted from yggi/KO-Multitool src/lib/transport/midi.ts @ 8b4b49e (PortInfo, listPorts, guessPort; its `describe` is
// `portInfo` here). guessPort takes the patterns it looks for, where KO-Multitool's held the EP-133's: webmidi knows no
// device.

/** A port in full, as a diagnostic lists it: unplugged ones too, with their state (`MidiAccess` lists only the plugged-in). */
export interface PortInfo {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  state: string;
  connection: string;
}

const portInfo = (p: MIDIPort): PortInfo => ({
  id: p.id,
  name: p.name ?? '(unnamed)',
  manufacturer: p.manufacturer ?? '',
  version: p.version ?? '',
  state: p.state,
  connection: p.connection,
});

/** Every port the browser lists, in its order, each in full. */
export function listPorts(access: Pick<MIDIAccess, 'inputs' | 'outputs'>): { inputs: PortInfo[]; outputs: PortInfo[] } {
  const inputs: PortInfo[] = [];
  const outputs: PortInfo[] = [];
  access.inputs.forEach((p) => inputs.push(portInfo(p)));
  access.outputs.forEach((p) => outputs.push(portInfo(p)));
  return { inputs, outputs };
}

/**
 * Guess which port belongs to a device: the first whose name or manufacturer matches the first pattern that matches
 * any, so the patterns go most certain first. Deliberately loose (a device's port is named differently on each system,
 * and some names nobody has reported yet): a miss must never block, and the page always offers the choice by hand.
 */
export function guessPort(ports: readonly PortInfo[], patterns: readonly RegExp[]): PortInfo | undefined {
  for (const re of patterns) {
    const hit = ports.find((p) => re.test(p.name) || re.test(p.manufacturer));
    if (hit) return hit;
  }
  return undefined;
}
