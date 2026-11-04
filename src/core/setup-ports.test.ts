import { describe, expect, it } from 'vitest';
import { fakeAccess, fakeConnection, fakePort } from './fixtures';
import { namePorts, portsOf } from './setup-ports';
import { fromJambot } from './setups-from';
import { activeSetup, addOutput, chooseDevice, newBook, overwrite, removeOutput, renameSetup, saveAs, withCrossing, withHeard, type SetupBook } from './setups';

const circuit = fakePort('out-1', 'Circuit Tracks');
const mini = fakePort('out-2', 'Minilogue xd');

/** "Home", the Circuit (o1) and the Minilogue (o2), saved; "Venue", the Minilogue alone, saved. */
function book(): SetupBook {
  let b = renameSetup(newBook(), 's1', 'Home');
  b = chooseDevice(b, 'o1', { id: circuit.id, name: circuit.name });
  b = overwrite(addOutput(b, { id: mini.id, name: mini.name }).book);
  b = saveAs(b, 'Venue');
  return overwrite(removeOutput(chooseDevice(b, 'o1', { id: mini.id, name: mini.name }), 'o2'));
}

describe('portsOf (yggi/webmidi#28)', () => {
  it('resolves each output of a setup to its live port, by id, else by name after a replug, and changes nothing kept', () => {
    const b = book();
    const home = b.setups[0]!;
    const replugged = fakePort('out-9', 'Minilogue xd');
    const access = fakeConnection(fakeAccess([], [circuit, replugged]));
    const { outputs, listen } = portsOf(home, access);
    expect(outputs).toEqual([
      { key: 'o1', port: circuit },
      { key: 'o2', port: replugged },
    ]);
    expect(listen).toEqual([]);
    // in another setup too, with nothing made: the same book
    expect(portsOf(activeSetup(b), access).outputs).toEqual([{ key: 'o1', port: replugged }]);
    expect(b.setups.map((s) => s.name)).toEqual(['Home', 'Venue']);
  });

  it('gives no port for a slot with no device, or a device not plugged in, and the heard inputs to listen to', () => {
    let b = addOutput(book()).book;
    b = withHeard(b, [{ id: 'in-1', name: 'Keys' }]);
    const { outputs, listen } = portsOf(activeSetup(b), fakeConnection(fakeAccess([], [circuit])));
    expect(outputs.map((o) => o.port)).toEqual([null, null]);
    expect(listen).toEqual([{ id: 'in-1', name: 'Keys' }]);
  });
});

describe('namePorts (yggi/webmidi#28)', () => {
  const plugged = { inputs: [{ id: 'in-1', name: 'KeyStep 37' }], outputs: [{ id: 'out-1', name: 'Circuit Tracks' }] };
  const jambot = { channels: { lead: 1 }, thru: true, thruChannel: 5, outPortId: 'out-1', inPortId: 'in-1' };

  it('names the ports a store from before kept by id alone, its input rows too, and makes no custom variant', () => {
    const unnamed = fromJambot(jambot, { inputs: [], outputs: [] });
    expect(activeSetup(unnamed).routes.band!['in:in-1']).toEqual({ o1: 5 });
    const b = namePorts(unnamed, plugged);
    const known = fromJambot(jambot, plugged);
    expect(activeSetup(b).outputs).toEqual(activeSetup(known).outputs);
    expect(activeSetup(b).heard).toEqual(activeSetup(known).heard);
    expect(activeSetup(b).routes).toEqual(activeSetup(known).routes);
    expect(b.setups.map((s) => [s.id, s.base])).toEqual([['s1', undefined]]);
  });

  it('names a custom variant’s ports as its named setup’s', () => {
    const unnamed = withCrossing(fromJambot(jambot, { inputs: [], outputs: [] }), 'band', 'bass', 'o1', 2);
    const b = namePorts(unnamed, plugged);
    expect(b.setups.map((s) => s.outputs[0]!.name)).toEqual(['Circuit Tracks', 'Circuit Tracks']);
    expect(b.active).toBe(unnamed.active);
  });

  it('is the same book when there is nothing to name: named already, or the ports not plugged in', () => {
    const b = book();
    expect(namePorts(b, plugged)).toBe(b);
    const unnamed = fromJambot(jambot, { inputs: [], outputs: [] });
    expect(namePorts(unnamed, { inputs: [], outputs: [] })).toBe(unnamed);
  });

  it('does not rename an input row onto one the routes have already', () => {
    let unnamed = fromJambot(jambot, { inputs: [], outputs: [] });
    unnamed = overwrite(withCrossing(unnamed, 'band', 'in:KeyStep 37', 'o1', 9));
    const routes = activeSetup(namePorts(unnamed, plugged)).routes.band!;
    expect([routes['in:in-1'], routes['in:KeyStep 37']]).toEqual([{ o1: 5 }, { o1: 9 }]);
  });
});
