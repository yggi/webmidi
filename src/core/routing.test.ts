// Lifted from yggi/cell-studio src/midi/routing.test.ts @ 3813fbb (lifted there from yggi/jambot
// apps/web/src/midi/routing.test.ts @ 8cdb6b8, with the name fallback). Where it connected through Web MIDI's adapter
// (`MidiAccess.connect` over a fake `navigator.requestMIDIAccess`), it connects through `fakeConnection`, which plays
// the adapter's part over the same fake ports: the adapter is `web`'s, a later pull request.
import { describe, expect, it } from 'vitest';
import { fakeAccess, fakeConnection, fakeInput, fakePort } from './fixtures';
import { isListened, matchPorts, type PortAccess } from './port';
import { adoptPorts, connectMidi, outputNow, portsMessage, type ChosenPorts } from './routing';
import { portsOf } from './setup-ports';
import { activeSetup, addOutput, BUILT_IN, chooseDevice, fit, newBook, spareOf } from './setups';

const chosen = (out = 'none', outName = '', inp = 'none', inName = ''): ChosenPorts => ({ outPortId: out, outPortName: outName, inPortId: inp, inPortName: inName, outPort: null });

/** A connection over `access` that adopts `settings` on every change, as `Midi` does. */
async function connect(access: ReturnType<typeof fakeAccess>, settings: ChosenPorts) {
  let live: PortAccess | null = null;
  const result = await connectMidi(async () => fakeConnection(access, { onChange: () => live && adoptPorts(live, settings) }), settings);
  live = result.access;
  return result;
}

describe('outputNow', () => {
  it('gives the built-in no port, even where a port bears its id', () => {
    const access = fakeConnection(fakeAccess([], [fakePort('builtin', 'Builtin')]));
    expect(outputNow(access, BUILT_IN)).toBeNull();
    expect(outputNow(access, { id: 'builtin', name: 'Builtin' })).toBeNull();
  });
});

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

describe('PortAccess.listen takes several inputs (yggi/webmidi#27)', () => {
  it('still takes a frontend’s own fake that listens by one id, as before', () => {
    const heard: string[] = [];
    const fake: PortAccess = { inputs: [], outputs: [], outputPort: () => null, listen: (id: string) => void heard.push(id) };
    adoptPorts(fake, chosen('none', '', 'in-1', 'Keys'));
    expect(heard).toEqual(['in-1']);
  });
});

describe('matchPorts: a port kept is its name’s, one port to one kept', () => {
  const kept = (id: string, name: string) => ({ id, name });

  it('finds a port by its id and name, else by its name: a replug under another id changes nothing', () => {
    const plugged = [kept('b', 'Circuit'), kept('a', 'Minilogue')];
    expect(matchPorts([kept('a', 'Minilogue'), kept('x', 'Circuit'), kept('y', 'TD-3')], plugged)).toEqual([plugged[1], plugged[0], null]);
  });

  it('does not take an id for a device once its name is known: ports numbered by place swap on a replug', () => {
    // before the replug: output-0 the Circuit, output-1 the Minilogue; after: the other way round
    const plugged = [kept('output-0', 'Minilogue'), kept('output-1', 'Circuit')];
    expect(matchPorts([kept('output-0', 'Circuit'), kept('output-1', 'Minilogue')], plugged)).toEqual([plugged[1], plugged[0]]);
    // and with the Circuit unplugged, its id is the Minilogue's: not the Circuit
    expect(matchPorts([kept('output-0', 'Circuit')], [kept('output-0', 'Minilogue')])).toEqual([null]);
  });

  it('gives two devices of one name two ports, each its own id first, then in order; a third gets none', () => {
    const plugged = [kept('1', 'TD-3'), kept('2', 'TD-3')];
    expect(matchPorts([kept('2', 'TD-3'), kept('9', 'TD-3'), kept('8', 'TD-3')], plugged)).toEqual([plugged[1], plugged[0], null]);
  });

  it('finds a port kept by id alone by its id; `none` and `all` are no port', () => {
    const plugged = [kept('a', 'Keys'), kept('none', 'odd')];
    expect(matchPorts([kept('a', ''), kept('none', ''), kept('all', '')], plugged)).toEqual([plugged[0], null, null]);
  });

  it('is what outputNow, portsOf, fit and spareOf read: two TD-3s kept, one plugged in, is one of two, on one port', () => {
    const book = addOutput(addOutput(chooseDevice(newBook(), 'o1', kept('1', 'TD-3')), kept('2', 'TD-3')).book, kept('3', 'Circuit')).book;
    const setup = activeSetup(book);
    const access = fakeConnection(fakeAccess([], [fakePort('2', 'TD-3'), fakePort('7', 'Minilogue')]));
    expect(fit(setup, access.outputs)).toEqual({ plugged: 1, of: 3 });
    expect(portsOf(setup, access).outputs.map((o) => o.port && (o.port as unknown as { id: string }).id)).toEqual([null, '2', null]);
    expect(spareOf(setup, access.outputs).map((p) => p.name)).toEqual(['Minilogue']);
    expect(outputNow(access, kept('2', 'Circuit'))).toBeNull();
    expect(isListened([kept('in-0', 'Keys')], 'in-0', 'Pads')).toBe(false);
    expect(isListened([kept('in-0', 'Keys')], 'in-5', 'Keys')).toBe(true);
    expect(isListened([kept('in-0', '')], 'in-0', 'Pads')).toBe(true);
  });

  it('adoptPorts sends to no output, and listens to no input, plugged in under the kept id by another name', () => {
    const heard: unknown[] = [];
    const live = fakeConnection(fakeAccess([fakeInput('in-0', 'Pads')], [fakePort('out-0', 'Minilogue')]));
    const access: PortAccess = { inputs: live.inputs, outputs: live.outputs, outputPort: live.outputPort, listen: (l) => void heard.push(l) };
    const ports = chosen('out-0', 'Circuit', 'in-0', 'Keys');
    adoptPorts(access, ports);
    expect(ports.outPort).toBeNull();
    expect(heard).toEqual(['none']);
  });
});
