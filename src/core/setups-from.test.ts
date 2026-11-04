import { describe, expect, it } from 'vitest';
import { fromCellStudio, fromJambot, KEYS } from './setups-from';
import { activeSetup, ANY_INPUT, crossingOf, DEFAULT_PROFILE, profileOf, readBook } from './setups';

/** A store as Cell studio keeps it (`cell-studio:midi`, src/ui/state/midi.svelte.ts @ 55c6a93): two outputs, one piece routed. */
const cellStudio = {
  outputs: [
    { key: 'o1', id: 'out-1', name: 'Circuit Tracks' },
    { key: 'o3', id: 'out-2', name: 'Minilogue xd' },
  ],
  in: { id: 'in-1', name: 'KeyStep 37' },
  routes: { electroswing: { o1: { bass: 2, pad: 0, '*': 10 }, o3: { lead: 1 } }, empty: { o1: { lead: 0 } } },
  drums: { 'Circuit Tracks': { 36: 60, 38: 62 } },
  internal: false,
  bendRange: 12,
  rotate: null,
  bends: { 'Minilogue xd': 24 },
  rotates: { 'Minilogue xd': { from: 2, to: 5 } },
  clock: { 'Circuit Tracks': true, 'Minilogue xd': false },
};

describe('fromCellStudio', () => {
  const book = fromCellStudio(cellStudio);

  it('keeps the outputs and the input, as one setup', () => {
    expect(activeSetup(book)).toMatchObject({ name: 'Cell studio', outputs: cellStudio.outputs, heard: [cellStudio.in] });
  });

  it('turns each piece’s matrix into its context, row by output, with a channel 0 (not sent) dropped', () => {
    expect(activeSetup(book).routes).toEqual({ 'piece:electroswing': { bass: { o1: 2 }, '*': { o1: 10 }, lead: { o3: 1 } } });
    expect(crossingOf(book, 'piece:electroswing', 'pad', 'o1')).toBeUndefined();
  });

  it('turns each device’s drums, bend and rotation into its profile, the ranges for any other into the defaults, and the devices sent clock into the clock row', () => {
    expect(activeSetup(book).clock).toEqual(['o1']);
    expect(profileOf(book, 'Circuit Tracks')).toEqual({ ...DEFAULT_PROFILE, bend: 12, drums: { 36: 60, 38: 62 } });
    expect(profileOf(book, 'Minilogue xd')).toEqual({ ...DEFAULT_PROFILE, bend: 24, mpe: { from: 2, to: 5 } });
    expect(book.defaults).toEqual({ ...DEFAULT_PROFILE, bend: 12 });
  });

  it('reads back as itself, and makes a setup of a store with nothing in it', () => {
    expect(readBook(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(activeSetup(fromCellStudio(null))).toMatchObject({ outputs: [{ key: 'o1', id: 'none', name: '' }], heard: [], routes: {} });
    expect(activeSetup(fromCellStudio({ in: { id: 'all', name: '' } })).heard).toBe('all');
  });
});

/** A store as Jambot keeps it (`jambot-midi-v1`, apps/web/src/midi/settings.svelte.ts @ 7113d55): by port id alone. */
const jambot = {
  internal: true,
  channels: { lead: 1, bass: 2, pad: 3, stab: 3, drums: 10 },
  drumMap: { 36: 60 },
  clock: true,
  thru: true,
  thruChannel: 5,
  outPortId: 'out-1',
  inPortId: 'in-1',
};
const ports = { inputs: [{ id: 'in-1', name: 'KeyStep 37' }], outputs: [{ id: 'out-1', name: 'Circuit Tracks' }] };

describe('fromJambot', () => {
  it('turns the parts’ channels into the band’s rows on the one output, the ports named from the ports plugged in', () => {
    const book = fromJambot(jambot, ports);
    expect(activeSetup(book).outputs).toEqual([{ key: 'o1', id: 'out-1', name: 'Circuit Tracks' }]);
    expect(activeSetup(book).heard).toEqual([{ id: 'in-1', name: 'KeyStep 37' }]);
    expect(activeSetup(book).routes.band).toMatchObject({ lead: { o1: 1 }, bass: { o1: 2 }, pad: { o1: 3 }, stab: { o1: 3 }, drums: { o1: 10 } });
  });

  it('turns thru into the keys’ and the heard input’s crossings on the thru channel', () => {
    const routes = activeSetup(fromJambot(jambot, ports)).routes.band!;
    expect([routes[KEYS], routes['in:KeyStep 37']]).toEqual([{ o1: 5 }, { o1: 5 }]);
    expect(activeSetup(fromJambot({ ...jambot, inPortId: 'all' }, ports)).routes.band![ANY_INPUT]).toEqual({ o1: 5 });
    const off = activeSetup(fromJambot({ ...jambot, thru: false }, ports)).routes.band!;
    expect([off[KEYS], off['in:KeyStep 37']]).toEqual([undefined, undefined]);
  });

  it('keeps the drum map as the device’s profile, or as the defaults when its name isn’t found, and the clock as the output’s', () => {
    const book = fromJambot(jambot, ports);
    expect([profileOf(book, 'Circuit Tracks'), book.defaults]).toEqual([{ ...DEFAULT_PROFILE, drums: { 36: 60 } }, DEFAULT_PROFILE]);
    expect([activeSetup(book).clock, activeSetup(fromJambot({ ...jambot, clock: false }, ports)).clock]).toEqual([['o1'], []]);
    const unplugged = fromJambot(jambot, { inputs: [], outputs: [] });
    expect(activeSetup(unplugged).outputs).toEqual([{ key: 'o1', id: 'out-1', name: '' }]);
    expect([unplugged.devices, unplugged.defaults]).toEqual([{}, { ...DEFAULT_PROFILE, drums: { 36: 60 } }]);
  });

  it('reads back as itself, and makes a setup of a store with nothing in it', () => {
    const book = fromJambot(jambot, ports);
    expect(readBook(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(activeSetup(fromJambot(undefined, ports))).toMatchObject({ outputs: [{ key: 'o1', id: 'none', name: '' }], heard: [], routes: { band: {} } });
  });
});

describe('a key named __proto__ (yggi/webmidi#15)', () => {
  it('is a row and a device of its own, and Object.prototype stays as it was', () => {
    const stored = JSON.parse('{"outputs":[{"key":"o1","id":"p","name":"X"}],"routes":{"t":{"o1":{"__proto__":2}}},"drums":{"__proto__":{"36":60}}}');
    const book = fromCellStudio(stored);
    expect(({} as Record<string, unknown>).o1).toBeUndefined();
    const routes = activeSetup(book).routes['piece:t']!;
    expect([Object.hasOwn(routes, '__proto__'), Object.getPrototypeOf(routes)]).toEqual([true, Object.prototype]);
    expect(crossingOf(book, 'piece:t', '__proto__', 'o1')).toBe(2);
    expect([Object.hasOwn(book.devices, '__proto__'), Object.getPrototypeOf(book.devices)]).toEqual([true, Object.prototype]);
    expect(profileOf(book, '__proto__').drums).toEqual({ 36: 60 });
  });
});
