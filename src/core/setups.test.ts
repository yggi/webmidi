import { describe, expect, it } from 'vitest';
import {
  activeSetup,
  addOutput,
  BUILT_IN,
  builtInHears,
  hasBuiltIn,
  HEARD,
  hardwareOutputs,
  withBuiltIn,
  ANY_INPUT,
  AS_PLAYED,
  changedFrom,
  channelsOf,
  crossingFrom,
  chooseDevice,
  crossingOf,
  DEFAULT_PROFILE,
  discard,
  exportSetup,
  fit,
  importSetup,
  inputRow,
  loadBook,
  memoryStore,
  newBook,
  overwrite,
  profileOf,
  readBook,
  removeOutput,
  sendsClock,
  removeSetup,
  forgetDevice,
  renameSetup,
  saveAs,
  suggestSetup,
  useSetup,
  withClock,
  withCrossing,
  withPlays,
  withProfile,
  type SetupBook,
} from './setups';

const circuit = { id: 'out-1', name: 'Circuit Tracks' };
const minilogue = { id: 'out-2', name: 'Minilogue xd' };
const keystep = { id: 'in-1', name: 'KeyStep 37' };

/** A book with one named setup, "Home", sending to the Circuit (o1) and the Minilogue (o2), as saved. */
function home(): SetupBook {
  let book = renameSetup(newBook(), 's1', 'Home');
  book = chooseDevice(book, 'o1', circuit);
  book = addOutput(book, minilogue).book;
  return overwrite(book);
}

describe('a change to a named setup', () => {
  it('is kept as its custom variant, put in use, and the named setup stays as saved', () => {
    const book = withCrossing(home(), 'band', 'lead', 'o2', 1);
    expect(book.setups.map((s) => [s.id, s.name, s.base])).toEqual([
      ['s1', 'Home', undefined],
      ['s1~', 'Home - custom', 's1'],
    ]);
    expect([book.active, changedFrom(book)?.name]).toEqual(['s1~', 'Home']);
    expect(crossingOf(useSetup(book, 's1'), 'band', 'lead', 'o2')).toBeUndefined();
    expect(changedFrom(home())).toBeNull();
  });

  it('a further change goes to the variant in use; one to the named setup again starts from what was saved', () => {
    let book = withCrossing(home(), 'band', 'lead', 'o2', 1);
    book = withCrossing(book, 'band', 'bass', 'o1', 2);
    expect(activeSetup(book).routes.band).toEqual({ lead: { o2: 1 }, bass: { o1: 2 } });
    book = withCrossing(useSetup(book, 's1'), 'band', 'pad', 'o1', 3);
    expect(book.setups.length).toBe(2);
    expect(activeSetup(book).routes.band).toEqual({ pad: { o1: 3 } });
  });

  it('overwrites the named setup, or is saved under a new name, or discarded: each leaves no variant', () => {
    const changed = withCrossing(home(), 'band', 'lead', 'o2', 1);
    const over = overwrite(changed);
    expect([over.setups.map((s) => s.name), over.active, crossingOf(over, 'band', 'lead', 'o2')]).toEqual([['Home'], 's1', 1]);
    const saved = saveAs(changed, 'Venue');
    expect([saved.setups.map((s) => [s.id, s.name]), crossingOf(saved, 'band', 'lead', 'o2')]).toEqual([
      [
        ['s1', 'Home'],
        ['s2', 'Venue'],
      ],
      1,
    ]);
    expect(crossingOf(useSetup(saved, 's1'), 'band', 'lead', 'o2')).toBeUndefined();
    expect(discard(changed)).toEqual(home());
    expect([overwrite(home()), discard(home())]).toEqual([home(), home()]);
  });

  it('changes nothing when the change changes nothing, nor for a device’s profile, shared by every setup', () => {
    const book = home();
    expect(removeOutput(book, 'o9')).toBe(book);
    expect(withProfile(book, circuit.name, { bend: 12 }).setups).toBe(book.setups);
  });

  it('is renamed with its named setup, and removed with it; it can’t be renamed itself', () => {
    let book = saveAs(home(), 'Venue');
    book = withCrossing(useSetup(book, 's1'), 'band', 'lead', 'o2', 1);
    book = renameSetup(book, 's1', 'Studio');
    expect(book.setups.map((s) => s.name)).toEqual(['Studio', 'Studio - custom', 'Venue']);
    expect(renameSetup(book, 's1~', 'Mine')).toBe(book);
    book = removeSetup(book, 's1');
    expect([book.setups.map((s) => s.id), book.active]).toEqual([['s2'], 's2']);
  });

  it('is read back as a variant only with its named setup there, one to a named setup', () => {
    const kept = {
      version: 1,
      active: 'x',
      setups: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', base: 'a' },
        { id: 'c', name: 'C', base: 'a' },
        { id: 'd', name: 'D', base: 'gone' },
      ],
    };
    expect(readBook(kept).setups.map((s) => [s.id, s.base])).toEqual([
      ['a', undefined],
      ['b', 'a'],
      ['c', undefined],
      ['d', undefined],
    ]);
    expect(readBook({ version: 1, setups: [{ id: 'b', base: 'b' }] }).setups.map((s) => s.base)).toEqual([undefined]);
  });
});

describe('crossings', () => {
  it('are set, read and cleared by context, row and output', () => {
    let book = withCrossing(home(), 'band', 'lead', 'o2', 1);
    book = withCrossing(book, 'band', 'drums', 'o1', 10);
    expect([crossingOf(book, 'band', 'lead', 'o2'), crossingOf(book, 'band', 'drums', 'o1'), crossingOf(book, 'piece:x', 'lead', 'o2')]).toEqual([1, 10, undefined]);
    book = withCrossing(book, 'band', 'lead', 'o2', undefined);
    expect(activeSetup(book).routes.band).toEqual({ drums: { o1: 10 } });
  });

  it('take a channel 1–16 or as played, and nothing else', () => {
    const row = inputRow(keystep);
    expect(row).toBe('in:KeyStep 37');
    let book = withCrossing(home(), 'band', row, 'o1', AS_PLAYED);
    expect(crossingOf(book, 'band', row, 'o1')).toBe(0);
    for (const bad of [17, -1, 1.5, NaN]) book = withCrossing(book, 'band', row, 'o1', bad);
    expect(crossingOf(book, 'band', row, 'o1')).toBeUndefined();
  });

  it('read no crossing a key of the object has (a row named __proto__)', () => {
    expect(crossingOf(home(), 'band', '__proto__', 'o1')).toBeUndefined();
    expect(crossingOf(withCrossing(home(), 'band', '__proto__', 'o1', 3), 'band', '__proto__', 'o1')).toBe(3);
  });
});

describe('outputs', () => {
  it('a new one takes a key no output has, after one was removed', () => {
    let book = addOutput(home()).book; // o3
    book = removeOutput(book, 'o2');
    const { key } = addOutput(book);
    expect(activeSetup(book).outputs.map((o) => o.key)).toEqual(['o1', 'o3']);
    expect(key).toBe('o4');
  });

  it('given another device, keeps its routes; removed, takes its crossings in every context with it', () => {
    let book = withCrossing(home(), 'band', 'lead', 'o2', 1);
    book = withCrossing(book, 'piece:a', 'bass', 'o2', 2);
    book = withCrossing(book, 'piece:a', 'bass', 'o1', 3);
    book = chooseDevice(book, 'o2', { id: 'out-9', name: 'MicroFreak' });
    expect(crossingOf(book, 'band', 'lead', 'o2')).toBe(1);
    book = removeOutput(book, 'o2');
    expect(activeSetup(book).routes).toEqual({ band: {}, 'piece:a': { bass: { o1: 3 } } });
  });

  it('the last is left with no device, its routes kept for the next device chosen; with none already, as it was', () => {
    const book = newBook();
    expect(removeOutput(book, 'o1')).toEqual(book);
    let one = withCrossing(chooseDevice(newBook(), 'o1', { id: 'out-9', name: 'MicroFreak' }), 'band', 'lead', 'o1', 1);
    one = removeOutput(one, 'o1');
    expect(activeSetup(one).outputs).toEqual([{ key: 'o1', id: 'none', name: '' }]);
    expect(crossingOf(one, 'band', 'lead', 'o1')).toBe(1);
  });
});

describe('the clock row', () => {
  it('sends clock to the outputs of the setup in use, in every context, a change to a named setup kept as its custom variant', () => {
    let book = withClock(home(), 'o1', true);
    expect([sendsClock(book, 'o1'), sendsClock(book, 'o2'), changedFrom(book)?.name]).toEqual([true, false, 'Home']);
    expect(sendsClock(useSetup(book, 's1'), 'o1')).toBe(false);
    book = withClock(book, 'o2', true);
    expect(activeSetup(book).clock).toEqual(['o1', 'o2']);
    expect(activeSetup(withClock(book, 'o1', false)).clock).toEqual(['o2']);
  });

  it('changes nothing for an output it has none of, or one already so; an output removed takes its clock with it', () => {
    const book = withClock(home(), 'o1', true);
    expect(withClock(book, 'o1', true)).toBe(book);
    expect(withClock(book, 'o9', true)).toBe(book);
    expect(activeSetup(removeOutput(book, 'o1')).clock).toEqual([]);
  });

  it('is read back keeping only outputs the setup has, once each', () => {
    const kept = { version: 1, setups: [{ id: 'a', name: 'A', outputs: [{ key: 'o1', id: 'p', name: 'X' }], clock: ['o1', 'o1', 'o7', 3] }] };
    expect(activeSetup(readBook(kept)).clock).toEqual(['o1']);
  });
});

describe('device profiles', () => {
  it('are kept by port name and shared by every setup', () => {
    let book = withProfile(home(), circuit.name, { bend: 12, drums: { 36: 60 } });
    book = saveAs(book, 'Venue');
    expect(profileOf(book, circuit.name)).toMatchObject({ bend: 12, drums: { 36: 60 } });
    expect(profileOf(book, 'Unknown synth')).toEqual(DEFAULT_PROFILE);
  });

  it('clamp what is typed', () => {
    const book = withProfile(newBook(), 'X', { bend: 400, latency: -3, mpe: { from: 0, to: 99 } });
    expect(profileOf(book, 'X')).toMatchObject({ bend: 96, latency: 0, mpe: { from: 1, to: 16 } });
  });
});

describe('setups', () => {
  it('save as copies the one in use, under a free name, and puts it in use; a variant saved so leaves its named setup as it was', () => {
    let book = withCrossing(home(), 'band', 'lead', 'o2', 1);
    book = saveAs(book, 'Home');
    expect(book.setups.map((s) => [s.id, s.name])).toEqual([
      ['s1', 'Home'],
      ['s2', 'Home 2'],
    ]);
    expect(book.active).toBe('s2');
    book = withCrossing(book, 'band', 'lead', 'o2', 5);
    expect([crossingOf(useSetup(book, 's1'), 'band', 'lead', 'o2'), crossingOf(book, 'band', 'lead', 'o2')]).toEqual([undefined, 5]);
  });

  it('removing the one in use puts the first left in use; the last named leaves a blank one, the devices’ profiles kept', () => {
    let book = saveAs(home(), 'Venue');
    book = removeSetup(book, 's2');
    expect([book.setups.length, book.active]).toEqual([1, 's1']);
    expect(removeSetup(book, 's9')).toBe(book);
    const last = removeSetup(withCrossing(book, 'band', 'lead', 'o2', 5), 's1');
    expect(last.setups.map((s) => [s.id, s.name, s.base])).toEqual([['s1', 'Setup 1', undefined]]);
    expect(activeSetup(last)).toEqual(activeSetup(newBook()));
    expect(last.devices).toEqual(book.devices);
  });

  it('a device’s profile forgotten follows the defaults again', () => {
    const book = withProfile(home(), 'Synth', { latency: 20 });
    expect(profileOf(book, 'Synth').latency).toBe(20);
    const forgotten = forgetDevice(book, 'Synth');
    expect(profileOf(forgotten, 'Synth')).toEqual(book.defaults);
    expect(forgetDevice(forgotten, 'Synth')).toBe(forgotten);
  });

  it('say what an input plays, every input’s too, and drop a choice to follow every input’s (decision 003)', () => {
    let book = withPlays(home(), inputRow(keystep), { row: 'lead', role: 'lead' });
    book = withPlays(book, ANY_INPUT, 'default');
    expect(activeSetup(book).plays).toEqual({ 'in:KeyStep 37': { row: 'lead', role: 'lead' }, 'in:*': 'default' });
    expect(activeSetup(book).name).toBe('Home - custom');
    expect(withPlays(book, ANY_INPUT, 'default')).toBe(book);
    expect(activeSetup(withPlays(book, inputRow(keystep), undefined)).plays).toEqual({ 'in:*': 'default' });
  });
});

describe('fit and the setup suggested', () => {
  const venue = () => {
    let book = saveAs(home(), 'Venue');
    book = chooseDevice(book, 'o2', { id: 'out-7', name: 'TD-3' });
    return overwrite(book); // in use: Venue (Circuit, TD-3)
  };

  it('counts a setup’s devices plugged in, by id or by name, slots with no device left out', () => {
    const setup = activeSetup(addOutput(home()).book);
    expect(fit(setup, [circuit])).toEqual({ plugged: 1, of: 2 });
    expect(fit(setup, [{ id: 'out-5', name: 'Minilogue xd' }, circuit])).toEqual({ plugged: 2, of: 2 });
  });

  it('suggests another setup with every device plugged in when the one in use misses one', () => {
    expect(suggestSetup(venue(), [circuit, minilogue])?.name).toBe('Home');
    expect(suggestSetup(venue(), [circuit, { id: 'out-7', name: 'TD-3' }])).toBeNull();
    expect(suggestSetup(venue(), [circuit])).toBeNull();
  });
});

describe('a setup as a file', () => {
  it('goes out and comes back in, with its devices’ profiles, under a free name', () => {
    let book = withProfile(home(), circuit.name, { drums: { 36: 60 } });
    book = overwrite(withCrossing(book, 'band', 'drums', 'o1', 10));
    const text = exportSetup(book);
    const other = importSetup(newBook(), text);
    if (typeof other === 'string') throw new Error(other);
    expect(activeSetup(other)).toMatchObject({ id: 's2', name: 'Home', routes: { band: { drums: { o1: 10 } } } });
    expect(profileOf(other, circuit.name).drums).toEqual({ 36: 60 });
    const again = importSetup(book, text);
    if (typeof again === 'string') throw new Error(again);
    expect(activeSetup(again).name).toBe('Home 2');
  });

  it('keeps the book’s own profile of a device over the file’s', () => {
    const text = exportSetup(withProfile(home(), circuit.name, { bend: 12 }));
    const book = importSetup(withProfile(newBook(), circuit.name, { bend: 2 }), text);
    expect(typeof book !== 'string' && profileOf(book, circuit.name).bend).toBe(2);
  });

  it('says in words what is wrong with a file that isn’t one', () => {
    expect(importSetup(newBook(), 'not json')).toMatch(/isn’t JSON/);
    expect(importSetup(newBook(), '{"format":"other"}')).toMatch(/isn’t a MIDI setup/);
    expect(importSetup(newBook(), '{"format":"webmidi-setup","version":4}')).toMatch(/newer version/);
    expect(importSetup(newBook(), '{"format":"webmidi-setup","version":1}')).toMatch(/damaged/);
    expect(importSetup(newBook(), '{"format":"webmidi-setup","version":2}')).toMatch(/damaged/);
  });

  it('is version 2 since what an input plays (decision 003), so a reader before it says to update, and reads a version 1 file by what it heard', () => {
    expect(JSON.parse(exportSetup(home()))).toMatchObject({ format: 'webmidi-setup', version: 2 });
    const old = JSON.stringify({ format: 'webmidi-setup', version: 1, setup: { id: 'x', name: 'Old', heard: [{ id: 'in-1', name: 'Keys' }] } });
    const book = importSetup(newBook(), old);
    if (typeof book === 'string') throw new Error(book);
    expect(activeSetup(book).plays).toEqual({ 'in:Keys': 'default' });
  });
});

describe('what an input plays, read back (decision 003)', () => {
  it('keeps the three forms by input row, junk dropped, and reads a setup from before plays by what it heard', () => {
    const kept = (plays: unknown, heard?: unknown) => activeSetup(readBook({ version: 1, setups: [{ id: 'a', name: 'A', plays, heard }] })).plays;
    expect(
      kept({ 'in:A': 'none', 'in:B': 'default', 'in:C': { row: 'lead', role: 'lead' }, 'in:D': { row: 'pad' }, lead: 'default', 'in:E': 'loud', 'in:F': { role: 'x' } }),
    ).toEqual({
      'in:A': 'none',
      'in:B': 'default',
      'in:C': { row: 'lead', role: 'lead' },
      'in:D': { row: 'pad' },
    });
    expect(kept(undefined, 'all')).toEqual({ 'in:*': 'default' });
    expect(kept(undefined, [keystep, 'k'])).toEqual({ 'in:KeyStep 37': 'default' });
    expect(kept(undefined, undefined)).toEqual({});
  });
});

describe('reading what was kept', () => {
  it('reads back what was saved', () => {
    const book = withProfile(
      withCrossing(withPlays(saveAs(home(), 'Venue'), inputRow(keystep), { row: 'lead', role: 'lead' }), 'band', inputRow(keystep), 'o2', AS_PLAYED),
      circuit.name,
      { mpe: { from: 2, to: 5 } },
    );
    const store = memoryStore();
    store.save(book);
    expect(readBook(store.load())).toEqual(book);
  });

  it('drops junk field by field, and makes a new book of nothing usable', () => {
    for (const junk of [null, 3, 'x', [], {}, { version: 2 }, { version: 1, setups: [] }, { version: 1, setups: [{ name: 'no id' }] }]) expect(readBook(junk)).toEqual(newBook());
    const book = readBook({
      version: 1,
      active: 'gone',
      devices: { X: { bend: 'twelve', latency: 9, drums: { 36: 60, 300: 1, a: 2 } } },
      setups: [
        {
          id: 'a',
          name: ' ',
          outputs: [{ key: 'o1', id: 'p', name: 'X' }, { key: 'o1', id: 'q', name: 'Y' }, 5],
          heard: [keystep, 'k'],
          routes: { band: { lead: { o1: 3, o2: 40 }, x: 'y' } },
        },
      ],
    });
    expect(book.active).toBe('a');
    expect(profileOf(book, 'X')).toEqual({ ...DEFAULT_PROFILE, latency: 9, drums: { 36: 60 } });
    expect(activeSetup(book)).toEqual({
      id: 'a',
      name: 'a',
      outputs: [{ key: 'o1', id: 'p', name: 'X' }],
      plays: { 'in:KeyStep 37': 'default' },
      routes: { band: { lead: { o1: 3 } } },
      clock: [],
    });
  });

  it('loads what a store keeps; with nothing kept, migrates once and saves it', () => {
    const store = memoryStore();
    const migrated = saveAs(home(), 'From before');
    expect(loadBook(store, () => migrated)).toEqual(migrated);
    expect(loadBook(store, () => newBook())).toEqual(migrated);
    expect(loadBook(memoryStore())).toEqual(newBook());
  });
});

describe('hardening (yggi/webmidi#15)', () => {
  it('a file’s device named __proto__ is a device, not the book’s prototype', () => {
    const text = JSON.stringify({ format: 'webmidi-setup', version: 1, setup: { id: 'x', name: 'X' } }).replace('}}', '},"devices":{"__proto__":{"bend":12}}}');
    const book = importSetup(newBook(), text);
    if (typeof book === 'string') throw new Error(book);
    expect([Object.hasOwn(book.devices, '__proto__'), Object.getPrototypeOf(book.devices), profileOf(book, '__proto__').bend]).toEqual([true, Object.prototype, 12]);
    expect(({} as Record<string, unknown>).bend).toBeUndefined();
  });

  it('a row named __proto__ read back is a row, not the routes’ prototype', () => {
    const kept = JSON.parse('{"version":1,"setups":[{"id":"a","name":"A","outputs":[{"key":"o1","id":"p","name":"X"}],"routes":{"band":{"__proto__":{"o1":3}}}}]}');
    const routes = activeSetup(readBook(kept)).routes.band!;
    expect([Object.hasOwn(routes, '__proto__'), Object.getPrototypeOf(routes)]).toEqual([true, Object.prototype]);
  });

  it('a variant takes an id no setup has, when one kept as named already has <id>~', () => {
    const kept = {
      version: 1,
      setups: [
        { id: 's1', name: 'Home' },
        { id: 's1~', name: 'Home - custom', base: 'gone' },
      ],
    };
    const book = withCrossing(readBook(kept), 'band', 'lead', 'o1', 1);
    expect(book.setups.map((s) => [s.id, s.base])).toEqual([
      ['s1', undefined],
      ['s1~2', 's1'],
      ['s1~', undefined],
    ]);
    expect(changedFrom(book)?.id).toBe('s1');
  });
});

describe('the built-in (this device’s own sound) as an output', () => {
  it('is added first, under its own key, hearing the rows asked for in each context; off, it goes with its crossings', () => {
    const book = withBuiltIn(home(), true, { band: ['lead', 'drums'] });
    const setup = activeSetup(book);
    expect(setup.outputs.map((o) => o.key)).toEqual(['builtin', 'o1', 'o2']);
    expect(hasBuiltIn(setup)).toBe(true);
    expect([builtInHears(book, 'band', 'lead'), builtInHears(book, 'band', 'bass'), crossingOf(book, 'band', 'drums', BUILT_IN.key)]).toEqual([true, false, HEARD]);
    expect(withBuiltIn(book, true)).toBe(book);
    const off = withBuiltIn(book, false);
    expect([hasBuiltIn(activeSetup(off)), activeSetup(off).routes]).toEqual([false, { band: {} }]);
    expect(withBuiltIn(off, false)).toBe(off);
  });

  it('changes no key an output added takes: they are numbered among the outputs that send MIDI', () => {
    const { key } = addOutput(withBuiltIn(home(), true), { id: 'out-3', name: 'TD-3' });
    expect(key).toBe('o3');
    expect(addOutput(withBuiltIn(newBook(), true)).key).toBe('o1');
  });

  it('is no device: not counted in a setup’s fit, never sent clock, never given a port, and not among the outputs that send MIDI', () => {
    const book = withBuiltIn(home(), true);
    const setup = activeSetup(book);
    expect(fit(setup, [circuit])).toEqual({ plugged: 1, of: 2 });
    expect(withClock(book, BUILT_IN.key, true)).toBe(book);
    expect(chooseDevice(book, BUILT_IN.key, circuit)).toBe(book);
    expect(hardwareOutputs(setup).map((o) => o.key)).toEqual(['o1', 'o2']);
  });

  it('removed as an output like any other; a setup of the built-in alone, its hardware removed, keeps it', () => {
    let book = withBuiltIn(home(), true, { band: ['lead'] });
    expect(hasBuiltIn(activeSetup(removeOutput(book, BUILT_IN.key)))).toBe(false);
    book = removeOutput(removeOutput(book, 'o2'), 'o1');
    expect(activeSetup(book).outputs.map((o) => o.key)).toEqual(['builtin']);
    // the last output removed, the built-in itself: a setup keeps one output, so one with no device takes its place
    expect(activeSetup(removeOutput(book, BUILT_IN.key)).outputs).toEqual([{ key: 'o1', id: 'none', name: '' }]);
  });

  it('takes the place of a lone output with no device and no routes, as a first visit’s; one routed stays beside it', () => {
    expect(activeSetup(withBuiltIn(newBook(), true)).outputs).toEqual([BUILT_IN]);
    const routed = withCrossing(newBook(), 'band', 'lead', 'o1', 1);
    expect(activeSetup(withBuiltIn(routed, true)).outputs.map((o) => o.key)).toEqual(['builtin', 'o1']);
  });

  it('is read back once, first, under its key, however it was kept', () => {
    const kept = {
      version: 1,
      setups: [
        {
          id: 's1',
          name: 'A',
          outputs: [
            { key: 'o1', id: 'out-1', name: 'X' },
            { key: 'b', id: 'builtin', name: '' },
            { key: 'b2', id: 'builtin', name: '' },
          ],
          routes: { band: { lead: { b: 1 } } },
        },
      ],
      active: 's1',
    };
    const setup = activeSetup(readBook(kept));
    expect(setup.outputs).toEqual([BUILT_IN, { key: 'o1', id: 'out-1', name: 'X' }]);
    expect(setup.routes).toEqual({ band: { lead: { builtin: 1 } } });
  });
});

describe('a crossing of several channels (yggi/webmidi#25, decision 010)', () => {
  const pairs = Array.from({ length: 16 }, (_, a) => Array.from({ length: 16 - a - 1 }, (_, i) => [a + 1, a + i + 2] as const)).flat();
  const all16 = Array.from({ length: 16 }, (_, i) => i + 1);
  /** A book with `value` as the lead’s crossing to o2, saved. */
  const sending = (value: number | readonly number[]) => overwrite(withCrossing(home(), 'band', 'lead', 'o2', value));
  /** Through the text a frontend keeps, as `localBookStore` does. */
  const kept = (book: SetupBook) => readBook(JSON.parse(JSON.stringify(book)));

  it('is a channel, as played, or a set of 2 or more channels ascending; a set of one is the bare number', () => {
    expect(pairs.length).toBe(120);
    expect([crossingFrom(5), crossingFrom(0), crossingFrom([5]), crossingFrom([3, 1]), crossingFrom(all16)]).toEqual([5, 0, 5, [1, 3], all16]);
    expect([channelsOf(0), channelsOf(5), channelsOf([1, 3])]).toEqual([[], [5], [1, 3]]);
  });

  it('is normalised, by withCrossing and by reading: sorted, deduped, out-of-range dropped, one element a number, none no crossing, as played not mixed in', () => {
    const cases: readonly (readonly [unknown, number | readonly number[] | undefined])[] = [
      [
        [3, 1, 3],
        [1, 3],
      ],
      [[1, 1], 1],
      [
        [16, 1, 9],
        [1, 9, 16],
      ],
      [[0, 5], 5],
      [
        [0, 1, 3],
        [1, 3],
      ],
      [[0], undefined],
      [[17, 3, -1, 1.5, NaN], 3],
      [[17], undefined],
      [[], undefined],
      [['1', null, 2], 2],
      [7, 7],
      [0, 0],
      [17, undefined],
      [-1, undefined],
      [1.5, undefined],
      ['1', undefined],
      [null, undefined],
      [undefined, undefined],
      [{ 0: 1 }, undefined],
    ];
    for (const [given, want] of cases) {
      expect(crossingFrom(given), JSON.stringify(given)).toEqual(want);
      expect(crossingOf(withCrossing(home(), 'band', 'lead', 'o2', given as never), 'band', 'lead', 'o2'), JSON.stringify(given)).toEqual(want);
      // (read from what was kept: the same answer, and no row left for no crossing)
      const text = JSON.parse(JSON.stringify(home()));
      text.setups[0].routes = { band: { lead: { o2: given } } };
      expect(crossingOf(readBook(text), 'band', 'lead', 'o2'), JSON.stringify(given)).toEqual(want);
    }
    expect(activeSetup(withCrossing(home(), 'band', 'lead', 'o2', [])).routes.band).toEqual({});
  });

  it('round-trips each of the 16 single channels, as played, each of the 120 pairs, a set of 3 and the set of 16, through the book and through the file', () => {
    const values: (number | readonly number[])[] = [AS_PLAYED, ...all16, ...pairs.map((p) => [...p]), [2, 9, 16], all16];
    expect(values.length).toBe(1 + 16 + 120 + 2);
    for (const value of values) {
      const book = sending(value);
      expect(crossingOf(book, 'band', 'lead', 'o2')).toEqual(value);
      expect(crossingOf(kept(book), 'band', 'lead', 'o2')).toEqual(value);
      const imported = importSetup(newBook(), exportSetup(book));
      if (typeof imported === 'string') throw new Error(imported);
      expect(crossingOf(imported, 'band', 'lead', 'o2')).toEqual(value);
    }
  });

  it('keeps a set through every edit of the book that moves routes: an output given another device, a variant, an input renamed', () => {
    const book = withCrossing(sending([1, 3]), 'band', inputRow(keystep), 'o1', [2, 4]);
    expect(crossingOf(chooseDevice(book, 'o2', { id: 'out-9', name: 'MicroFreak' }), 'band', 'lead', 'o2')).toEqual([1, 3]);
    expect(crossingOf(removeOutput(book, 'o1'), 'band', 'lead', 'o2')).toEqual([1, 3]);
    expect(activeSetup(removeOutput(book, 'o1')).routes.band).toEqual({ lead: { o2: [1, 3] } });
    expect(crossingOf(withCrossing(book, 'band', 'pad', 'o1', 3), 'band', 'lead', 'o2')).toEqual([1, 3]);
  });

  it('is written to a file as version 3 only when the file holds a set: every other file stays version 2 for a reader before, and a version 4 is refused in words', () => {
    for (const value of [AS_PLAYED, 1, 16]) expect(JSON.parse(exportSetup(sending(value))).version).toBe(2);
    expect(JSON.parse(exportSetup(home())).version).toBe(2);
    expect(JSON.parse(exportSetup(sending([1, 3]))).version).toBe(3);
    // (another setup of the book holding a set doesn't make this one's file version 3)
    const other = withCrossing(saveAs(home(), 'Venue'), 'band', 'lead', 'o2', [1, 3]);
    expect(JSON.parse(exportSetup(other, 's1')).version).toBe(2);
    expect(JSON.parse(exportSetup(other)).version).toBe(3);
    expect(importSetup(newBook(), JSON.stringify({ format: 'webmidi-setup', version: 4, setup: { id: 'x' } }))).toMatch(/newer version/);
  });

  it('reads books and files kept by v0.9.0 as they were: every crossing a number, the same bytes written back', () => {
    // as `localBookStore` kept it at v0.9.0
    const stored = {
      version: 1,
      devices: { 'Circuit Tracks': { drums: { 36: 60 }, bend: 12, mpe: null, latency: 5 } },
      defaults: { drums: {}, bend: 2, mpe: null, latency: 0 },
      active: 's1',
      setups: [
        {
          id: 's1',
          name: 'Home',
          outputs: [
            { key: 'o1', id: 'out-1', name: 'Circuit Tracks' },
            { key: 'o2', id: 'out-2', name: 'Minilogue xd' },
          ],
          plays: { 'in:KeyStep 37': 'default' },
          routes: { band: { lead: { o2: 1 }, drums: { o1: 10 }, 'in:KeyStep 37': { o1: 0, o2: 16 } }, 'piece:a': { pad: { o2: 3 } } },
          clock: ['o1'],
        },
      ],
    };
    const book = readBook(stored);
    expect(activeSetup(book).routes).toEqual(stored.setups[0]!.routes);
    expect(JSON.parse(JSON.stringify(book))).toEqual(JSON.parse(JSON.stringify(readBook(JSON.parse(JSON.stringify(book))))));
    expect(JSON.parse(JSON.stringify(activeSetup(book).routes))).toEqual(stored.setups[0]!.routes);
    // as `exportSetup` wrote it at v0.9.0 (version 2)
    const file = JSON.stringify({ format: 'webmidi-setup', version: 2, setup: stored.setups[0], devices: {} });
    const imported = importSetup(newBook(), file);
    if (typeof imported === 'string') throw new Error(imported);
    expect(activeSetup(imported).routes).toEqual(stored.setups[0]!.routes);
    expect(JSON.parse(exportSetup(imported)).version).toBe(2);
  });
});
