// Lifted from yggi/cell-studio src/midi/routing.test.ts @ 3813fbb (lifted there from yggi/jambot
// apps/web/src/midi/routing.test.ts @ 8cdb6b8, with the name fallback). Where it connected through Web MIDI's adapter
// (`MidiAccess.connect` over a fake `navigator.requestMIDIAccess`), it connects through `fakeConnection`, which plays
// the adapter's part over the same fake ports: the adapter is `web`'s, a later pull request.
import { describe, expect, it } from 'vitest';
import { fakeAccess, fakeConnection, fakeInput, fakePort } from './fixtures';
import type { PortAccess } from './port';
import { adoptPorts, connectMidi, portsMessage, type ChosenPorts } from './routing';

const chosen = (out = 'none', outName = '', inp = 'none', inName = ''): ChosenPorts => ({ outPortId: out, outPortName: outName, inPortId: inp, inPortName: inName, outPort: null });

/** A connection over `access` that adopts `settings` on every change, as `Midi` does. */
async function connect(access: ReturnType<typeof fakeAccess>, settings: ChosenPorts) {
  let live: PortAccess | null = null;
  const result = await connectMidi(async () => fakeConnection(access, { onChange: () => live && adoptPorts(live, settings) }), settings);
  live = result.access;
  return result;
}

describe('adoptPorts: a port replugged under another id', () => {
  it('goes by name, and with two ports of one name the first listed is taken', () => {
    const [a, b] = [fakePort('out-2', 'Synth'), fakePort('out-3', 'Synth')];
    const settings = chosen('out-1', 'Synth');
    const ports = [a, b].map((p) => ({ id: p.id, name: p.name }));
    adoptPorts({ inputs: [], outputs: ports, outputPort: (id) => [a, b].find((p) => p.id === id) ?? null, listen: () => {} }, settings);
    expect([settings.outPortId, settings.outPort]).toEqual(['out-2', a]);
  });
});

describe('connectMidi', () => {
  it('passes on the words when there is no connection', async () => {
    expect(await connectMidi(async () => 'This browser has no Web MIDI.', chosen())).toEqual({ access: null, message: 'This browser has no Web MIDI.' });
  });

  it('adopts the output and listens to the input chosen before, and says what it found', async () => {
    const out = fakePort('out-1', 'Synth');
    const keys = fakeInput('in-1', 'Keys');
    const settings = chosen('out-1', 'Synth', 'in-1', 'Keys');
    const { message } = await connect(fakeAccess([keys], [out]), settings);
    expect(settings.outPort).toBe(out);
    expect(keys.onmidimessage).not.toBeNull();
    expect(message).toBe('MIDI connected: 1 input, 1 output.');
  });

  it('adopts nothing when its owner is gone by the time the connection comes', async () => {
    const out = fakePort('out-1', 'Synth');
    const keys = fakeInput('in-1', 'Keys');
    const settings = chosen('out-1', 'Synth', 'in-1', 'Keys');
    const { access } = await connectMidi(
      async () => fakeConnection(fakeAccess([keys], [out])),
      settings,
      () => false,
    );
    expect(access).not.toBeNull();
    expect(settings.outPort).toBeNull();
    expect(keys.onmidimessage).toBeNull();
  });

  it('has no output where none is chosen', async () => {
    const settings = chosen();
    await connect(fakeAccess([], [fakePort('out-1', 'Synth')]), settings);
    expect(settings.outPort).toBeNull();
  });
});

describe('unplugging and plugging in again', () => {
  it('lets go of an output that is gone, and picks it up again plugged in with the same id', async () => {
    const access = fakeAccess([], [fakePort('out-1', 'Synth')]);
    const settings = chosen('out-1', 'Synth');
    await connect(access, settings);
    access.outputs.clear();
    access.change();
    expect(settings.outPort).toBeNull();
    expect(settings.outPortId).toBe('out-1'); // still chosen: shown as "Not connected"
    const back = fakePort('out-1', 'Synth');
    access.outputs.set('out-1', back);
    access.change();
    expect(settings.outPort).toBe(back);
  });

  it('listens to an input plugged in again (a fresh object with the same id)', async () => {
    const access = fakeAccess([fakeInput('in-1', 'Keys')]);
    await connect(access, chosen('none', '', 'in-1', 'Keys'));
    const back = fakeInput('in-1', 'Keys');
    access.inputs.set('in-1', back);
    access.change();
    expect(back.onmidimessage).not.toBeNull();
  });

  it('finds a port plugged in again under a new id by its name, and keeps the new id', async () => {
    const access = fakeAccess([fakeInput('in-1', 'Keys')], [fakePort('out-1', 'Synth')]);
    const settings = chosen('out-1', 'Synth', 'in-1', 'Keys');
    await connect(access, settings);
    access.inputs.clear();
    access.outputs.clear();
    access.change();
    const out = fakePort('out-7', 'Synth');
    const keys = fakeInput('in-7', 'Keys');
    access.outputs.set('out-7', out);
    access.outputs.set('out-8', fakePort('out-8', 'Other'));
    access.inputs.set('in-7', keys);
    access.change();
    expect(settings.outPort).toBe(out);
    expect(settings.outPortId).toBe('out-7');
    expect(settings.inPortId).toBe('in-7');
    expect(keys.onmidimessage).not.toBeNull();
  });

  it('takes no port by an empty name', () => {
    const settings = chosen('gone', '');
    adoptPorts({ inputs: [], outputs: [{ id: 'x', name: '' }], outputPort: (id) => (id === 'x' ? fakePort('x', '') : null), listen: () => {} }, settings);
    expect(settings.outPortId).toBe('gone');
    expect(settings.outPort).toBeNull();
  });
});

describe('portsMessage', () => {
  it('counts in the plural', () => {
    expect(portsMessage({ inputs: [1, 2], outputs: [] })).toBe('MIDI connected: 2 inputs, 0 outputs.');
  });
});
