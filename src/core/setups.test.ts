import { describe, expect, it } from 'vitest';
import {
  activeSetup,
  addOutput,
  AS_PLAYED,
  changedFrom,
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
  renameSetup,
  saveAs,
  suggestSetup,
  useSetup,
  withClock,
  withCrossing,
  withHeard,
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

  it('the last stays', () => {
    const book = newBook();
    expect(removeOutput(book, 'o1')).toEqual(book);
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

  it('removing the one in use puts the first left in use; the last stays', () => {
    let book = saveAs(home(), 'Venue');
    book = removeSetup(book, 's2');
    expect([book.setups.length, book.active]).toEqual([1, 's1']);
    expect(removeSetup(book, 's1')).toBe(book);
  });

  it('hear none, some or all inputs', () => {
    expect(activeSetup(withHeard(home(), [keystep])).heard).toEqual([keystep]);
    expect(activeSetup(withHeard(home(), 'all')).heard).toBe('all');
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
    expect(importSetup(newBook(), '{"format":"webmidi-setup","version":2}')).toMatch(/newer version/);
    expect(importSetup(newBook(), '{"format":"webmidi-setup","version":1}')).toMatch(/damaged/);
  });
});

describe('reading what was kept', () => {
  it('reads back what was saved', () => {
    const book = withProfile(withCrossing(withHeard(saveAs(home(), 'Venue'), [keystep]), 'band', inputRow(keystep), 'o2', AS_PLAYED), circuit.name, { mpe: { from: 2, to: 5 } });
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
    expect(activeSetup(book)).toEqual({ id: 'a', name: 'a', outputs: [{ key: 'o1', id: 'p', name: 'X' }], heard: [keystep], routes: { band: { lead: { o1: 3 } } }, clock: [] });
  });

  it('loads what a store keeps; with nothing kept, migrates once and saves it', () => {
    const store = memoryStore();
    const migrated = saveAs(home(), 'From before');
    expect(loadBook(store, () => migrated)).toEqual(migrated);
    expect(loadBook(store, () => newBook())).toEqual(migrated);
    expect(loadBook(memoryStore())).toEqual(newBook());
  });
});
