import { describe, expect, it } from 'vitest';
import { forwardsAsPlayed, forwardsOf, forwardsOfInput, panelForwardsOf } from './forward';
import {
  activeSetup,
  addOutput,
  ANY_INPUT,
  AS_PLAYED,
  BUILT_IN,
  chooseDevice,
  HEARD,
  inputRow,
  isPanelKey,
  newBook,
  panelKey,
  panelsOf,
  readBook,
  withBuiltIn,
  withCrossing,
  withPanelActive,
  withPlays,
  type SetupBook,
} from './setups';

const keys = { id: 'in-1', name: 'Keys' };
const row = inputRow(keys);

/** Two outputs; the keys' row to o1 on channel 5 and to o2 as played. */
function book(): SetupBook {
  let b = chooseDevice(newBook(), 'o1', { id: 'out-1', name: 'Synth' });
  b = addOutput(b, { id: 'out-2', name: 'Drums' }).book;
  b = withCrossing(b, 'band', row, 'o1', 5);
  return withCrossing(b, 'band', row, 'o2', AS_PLAYED);
}

describe('forwardsOf (yggi/webmidi#32)', () => {
  it('sends every channel voice message, 0x80–0xEF on each channel, to each output crossed, its channel replaced or kept', () => {
    const b = book();
    for (let status = 0x80; status <= 0xef; status++) {
      const data = (status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0 ? [status, 7] : [status, 60, 100];
      expect(forwardsOf(b, 'band', row, data)).toEqual([
        { output: 'o1', data: [(status & 0xf0) | 4, ...data.slice(1)] },
        { output: 'o2', data },
      ]);
    }
  });

  it('forwards no system message, 0xF0–0xFF (SysEx, the clock, Start, Stop), and no message without a status byte', () => {
    const b = book();
    for (let status = 0xf0; status <= 0xff; status++) expect(forwardsOf(b, 'band', row, status === 0xf0 ? [0xf0, 0x7e, 0xf7] : [status])).toEqual([]);
    for (const data of [[], [60, 100], [0x7f]]) expect(forwardsOf(b, 'band', row, data)).toEqual([]);
  });

  it('sends nothing for a row or a context not routed, or a row named __proto__', () => {
    const b = book();
    expect(forwardsOf(b, 'band', 'in:Pads', [0x90, 60, 100])).toEqual([]);
    expect(forwardsOf(b, 'piece:a', row, [0x90, 60, 100])).toEqual([]);
    expect(forwardsOf(b, 'band', '__proto__', [0x90, 60, 100])).toEqual([]);
  });

  it('sends nothing to the built-in, which plays a row but takes no MIDI', () => {
    const b = withCrossing(withBuiltIn(book(), true), 'band', row, BUILT_IN.key, HEARD);
    expect(forwardsOf(b, 'band', row, [0x90, 60, 100]).map((f) => f.output)).toEqual(['o1', 'o2']);
  });

  it('takes the bytes as Web MIDI gives them (a Uint8Array)', () => {
    expect(forwardsOf(book(), 'band', row, new Uint8Array([0x93, 60, 0]))).toEqual([
      { output: 'o1', data: [0x94, 60, 0] },
      { output: 'o2', data: [0x93, 60, 0] },
    ]);
  });
});

describe('forwardsOfInput', () => {
  it('sends by the input’s own row and, heard, by every input’s, the same bytes to one output once', () => {
    let b = withPlays(book(), ANY_INPUT, 'default');
    b = withCrossing(b, 'band', ANY_INPUT, 'o1', 5);
    b = withCrossing(b, 'band', ANY_INPUT, 'o2', 2);
    expect(forwardsOfInput(b, 'band', keys, [0x90, 60, 100])).toEqual([
      { output: 'o1', data: [0x94, 60, 100] },
      { output: 'o2', data: [0x90, 60, 100] },
      { output: 'o2', data: [0x91, 60, 100] },
    ]);
    expect(forwardsOfInput(b, 'band', { id: 'in-2', name: 'Pads' }, [0x90, 60, 100])).toEqual([
      { output: 'o1', data: [0x94, 60, 100] },
      { output: 'o2', data: [0x91, 60, 100] },
    ]);
  });

  it('sends an input not heard by its own row only: every input’s row is every input heard (yggi/webmidi#43)', () => {
    let b = withCrossing(book(), 'band', ANY_INPUT, 'o2', 2);
    expect(forwardsOfInput(b, 'band', keys, [0x90, 60, 100])).toEqual([
      { output: 'o1', data: [0x94, 60, 100] },
      { output: 'o2', data: [0x90, 60, 100] },
    ]);
    b = withPlays(withPlays(b, ANY_INPUT, 'default'), row, 'none');
    expect(forwardsOfInput(b, 'band', keys, [0x90, 60, 100]).length).toBe(2);
    expect(forwardsOfInput(b, 'band', { id: 'in-2', name: 'Pads' }, [0x90, 60, 100])).toEqual([{ output: 'o2', data: [0x91, 60, 100] }]);
  });
});

describe('forwardsAsPlayed (yggi/webmidi#29)', () => {
  const rows = [
    { id: 'lead', role: 'lead' },
    { id: 'bass', role: 'bass' },
  ];
  it('sends an input’s message where the row it plays is sent, on that row’s channels; the default row, or nothing', () => {
    let b = withCrossing(book(), 'band', 'lead', 'o1', 3);
    b = withCrossing(b, 'band', 'bass', 'o2', 9);
    expect(forwardsAsPlayed(b, 'band', keys, rows, [0x90, 60, 100])).toEqual([]);
    b = withPlays(b, row, { row: 'lead', role: 'lead' });
    expect(forwardsAsPlayed(b, 'band', keys, rows, [0x91, 60, 100])).toEqual([{ output: 'o1', data: [0x92, 60, 100] }]);
    b = withPlays(b, row, 'default');
    expect(forwardsAsPlayed(b, 'band', keys, rows, [0x90, 60, 100])).toEqual([]);
    expect(forwardsAsPlayed(b, 'band', keys, rows, [0x90, 60, 100], 'bass')).toEqual([{ output: 'o2', data: [0x98, 60, 100] }]);
  });
});

describe('panels in the patch (decision 007)', () => {
  const keys = { id: 'in-1', name: 'Keys' };
  /** One output, two panels active; the mixer's row to the output on channel 5, the keys to the mixer as played and to the pads on 10. */
  function patched(): SetupBook {
    let book = chooseDevice(newBook(), 'o1', { id: 'out-1', name: 'Synth' });
    book = withPanelActive(withPanelActive(book, 'mixer', true), 'pads', true);
    book = withCrossing(book, 'bay', panelKey('mixer'), 'o1', 5);
    book = withCrossing(book, 'bay', inputRow(keys), panelKey('mixer'), AS_PLAYED);
    return withCrossing(book, 'bay', inputRow(keys), panelKey('pads'), 10);
  }

  it('a setup names its active panels, in order, once each; taking one out takes its row and its column’s crossings with it', () => {
    const book = patched();
    expect(panelsOf(activeSetup(book))).toEqual(['mixer', 'pads']);
    expect(withPanelActive(book, 'mixer', true)).toBe(book);
    expect(withPanelActive(book, 'none', false)).toBe(book);
    const without = withPanelActive(book, 'mixer', false);
    expect(panelsOf(activeSetup(without))).toEqual(['pads']);
    expect(activeSetup(without).routes.bay).toEqual({ 'in:Keys': { 'panel:pads': 10 } });
    expect('panels' in activeSetup(withPanelActive(without, 'pads', false))).toBe(false);
  });

  it('is kept and read back, junk dropped; a setup from before has none', () => {
    const read = readBook(JSON.parse(JSON.stringify(patched())));
    expect(panelsOf(activeSetup(read))).toEqual(['mixer', 'pads']);
    const setup = { id: 's1', name: 'S', outputs: [], plays: {}, routes: {}, clock: [] };
    expect(panelsOf(readBook({ version: 1, setups: [{ ...setup, panels: ['a', 7, '', 'a', 'b'] }], active: 's1' }).setups[0]!)).toEqual(['a', 'b']);
    expect('panels' in readBook({ version: 1, setups: [setup], active: 's1' }).setups[0]!).toBe(false);
    expect([isPanelKey('panel:a'), isPanelKey('in:a'), isPanelKey('o1')]).toEqual([true, false, false]);
  });

  it('a panel’s row is sent to outputs as any row is, and forwardsOf sends nothing to a panel’s column: a panel is no port', () => {
    const book = patched();
    expect(forwardsOf(book, 'bay', panelKey('mixer'), [0xb0, 7, 100])).toEqual([{ output: 'o1', data: [0xb4, 7, 100] }]);
    expect(forwardsOfInput(book, 'bay', keys, [0x90, 60, 100])).toEqual([]);
  });

  it('panelForwardsOf hands a row’s message to each active panel its column crosses, as it came or on the crossing’s channel', () => {
    const book = patched();
    expect(panelForwardsOf(book, 'bay', keys, [0x90, 60, 100])).toEqual([
      { panel: 'mixer', data: [0x90, 60, 100] },
      { panel: 'pads', data: [0x99, 60, 100] },
    ]);
    expect(panelForwardsOf(book, 'bay', inputRow(keys), [0xf8])).toEqual([]);
    expect(panelForwardsOf(book, 'other', keys, [0x90, 60, 100])).toEqual([]);
    expect(panelForwardsOf(book, 'bay', panelKey('mixer'), [0xb0, 7, 1])).toEqual([]);
  });

  it('never hands a panel what it sent itself, hands another panel’s, and every input’s row once', () => {
    let book = withCrossing(patched(), 'bay', panelKey('mixer'), panelKey('mixer'), AS_PLAYED);
    book = withCrossing(book, 'bay', panelKey('mixer'), panelKey('pads'), AS_PLAYED);
    expect(panelForwardsOf(book, 'bay', panelKey('mixer'), [0xb0, 7, 1])).toEqual([{ panel: 'pads', data: [0xb0, 7, 1] }]);
    book = withPlays(withCrossing(book, 'bay', ANY_INPUT, panelKey('mixer'), AS_PLAYED), ANY_INPUT, 'default');
    expect(panelForwardsOf(book, 'bay', keys, [0xb0, 1, 2]).filter((f) => f.panel === 'mixer')).toEqual([{ panel: 'mixer', data: [0xb0, 1, 2] }]);
    // (a crossing kept for a panel that is no longer active sends nothing)
    expect(panelForwardsOf({ ...book, setups: book.setups.map((s) => ({ ...s, panels: ['pads'] })) }, 'bay', keys, [0xb0, 1, 2]).map((f) => f.panel)).toEqual(['pads']);
  });
});

describe('a crossing of several channels (yggi/webmidi#25, decision 010)', () => {
  /** The seven channel voice messages webmidi reads, each as status nibble and its data bytes. */
  const kinds: readonly (readonly [string, number, readonly number[]])[] = [
    ['note off', 0x80, [60, 64]],
    ['note on', 0x90, [60, 100]],
    ['poly aftertouch', 0xa0, [60, 33]],
    ['control change', 0xb0, [7, 99]],
    ['program change', 0xc0, [12]],
    ['channel aftertouch', 0xd0, [44]],
    ['pitch bend', 0xe0, [1, 100]],
  ];
  const sets: readonly (readonly number[])[] = [[5], [1, 3], [2, 9, 16], Array.from({ length: 16 }, (_, i) => i + 1)];
  /** A book whose row sends to o1 on `channels` (a bare number for a set of one: the crossing is the same either way). */
  const sending = (channels: readonly number[]) =>
    withCrossing(chooseDevice(newBook(), 'o1', { id: 'out-1', name: 'Synth' }), 'band', row, 'o1', channels.length === 1 ? channels[0]! : channels);

  it('sends a channel voice message once per channel, ascending, each re-channelled, for each of the 7 kinds and set sizes 1, 2, 3 and 16', () => {
    for (const [, status, rest] of kinds)
      for (const channels of sets) {
        // (a set given unsorted comes out ascending: the book keeps it so)
        const given = [...channels].reverse();
        const b = withCrossing(sending([1]), 'band', row, 'o1', given.length === 1 ? given[0]! : given);
        expect(forwardsOf(b, 'band', row, [status | 7, ...rest])).toEqual(channels.map((c) => ({ output: 'o1', data: [status | (c - 1), ...rest] })));
      }
  });

  it('sends a system message or one with no status once: not at all, as before, whatever the set', () => {
    const b = sending([1, 3, 5]);
    for (const status of [0xf0, 0xf1, 0xf2, 0xf8, 0xfa, 0xfb, 0xfc, 0xfe, 0xff]) expect(forwardsOf(b, 'band', row, status === 0xf0 ? [0xf0, 0x7e, 0xf7] : [status])).toEqual([]);
    expect(forwardsOf(b, 'band', row, [60, 100])).toEqual([]);
  });

  it('sends a set beside another output’s crossing, in the order of the outputs, each output’s channels ascending', () => {
    const b = withCrossing(addOutput(sending([3, 1]), { id: 'out-2', name: 'Drums' }).book, 'band', row, 'o2', AS_PLAYED);
    expect(forwardsOf(b, 'band', row, [0x95, 60, 100])).toEqual([
      { output: 'o1', data: [0x90, 60, 100] },
      { output: 'o1', data: [0x92, 60, 100] },
      { output: 'o2', data: [0x95, 60, 100] },
    ]);
  });

  it('sends nothing to the built-in even where a set is routed there, and nothing for an empty set', () => {
    const b = withCrossing(withBuiltIn(sending([1, 3]), true), 'band', row, BUILT_IN.key, [1, 3]);
    expect(forwardsOf(b, 'band', row, [0x90, 60, 100]).map((f) => f.output)).toEqual(['o1', 'o1']);
    expect(forwardsOf(withCrossing(sending([1, 3]), 'band', row, 'o1', []), 'band', row, [0x90, 60, 100])).toEqual([]);
  });

  it('forwardsOfInput sends the set by the input’s row, and once the same bytes that every input’s row also sends', () => {
    let b = withPlays(sending([1, 3]), ANY_INPUT, 'default');
    b = withCrossing(b, 'band', ANY_INPUT, 'o1', [3, 4]);
    expect(forwardsOfInput(b, 'band', keys, [0x90, 60, 100])).toEqual([
      { output: 'o1', data: [0x90, 60, 100] },
      { output: 'o1', data: [0x92, 60, 100] },
      { output: 'o1', data: [0x93, 60, 100] },
    ]);
  });

  it('forwardsAsPlayed sends the set of the row an input plays: a voice on 1 and 3 of one output', () => {
    const b = withPlays(sending([1, 3]), row, { row: 'band-lead' });
    const voice = withCrossing(b, 'band', 'band-lead', 'o1', [1, 3]);
    expect(forwardsAsPlayed(voice, 'band', keys, [{ id: 'band-lead' }], [0x90, 64, 90])).toEqual([
      { output: 'o1', data: [0x90, 64, 90] },
      { output: 'o1', data: [0x92, 64, 90] },
    ]);
  });

  it('panelForwardsOf hands a panel the message once per channel of the set, and once the same bytes from two rows', () => {
    let b = withCrossing(
      withPanelActive(withPanelActive(chooseDevice(newBook(), 'o1', { id: 'out-1', name: 'Synth' }), 'mixer', true), 'pads', true),
      'bay',
      row,
      panelKey('mixer'),
      [2, 4],
    );
    expect(panelForwardsOf(b, 'bay', keys, [0xb0, 7, 100]).filter((f) => f.panel === 'mixer')).toEqual([
      { panel: 'mixer', data: [0xb1, 7, 100] },
      { panel: 'mixer', data: [0xb3, 7, 100] },
    ]);
    b = withPlays(withCrossing(b, 'bay', ANY_INPUT, panelKey('mixer'), [4, 2]), ANY_INPUT, 'default');
    expect(
      panelForwardsOf(b, 'bay', keys, [0xb0, 7, 100])
        .filter((f) => f.panel === 'mixer')
        .map((f) => f.data[0]),
    ).toEqual([0xb1, 0xb3]);
  });

  it('sends a setup with no set exactly the messages v0.9.0 sent: the same bytes, outputs and order for every channel voice status', () => {
    // (a book as v0.9.0 kept it, read as it is read now: o1 on channel 5, o2 as played)
    const stored = {
      version: 1,
      devices: {},
      defaults: {},
      active: 's1',
      setups: [
        {
          id: 's1',
          name: 'Home',
          outputs: [
            { key: 'o1', id: 'out-1', name: 'Synth' },
            { key: 'o2', id: 'out-2', name: 'Drums' },
          ],
          plays: {},
          routes: { band: { [row]: { o1: 5, o2: 0 } } },
          clock: [],
        },
      ],
    };
    const b = readBook(JSON.parse(JSON.stringify(stored)));
    for (let status = 0x80; status <= 0xef; status++) {
      const data = (status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0 ? [status, 7] : [status, 60, 100];
      expect(forwardsOf(b, 'band', row, data)).toEqual([
        { output: 'o1', data: [(status & 0xf0) | 4, ...data.slice(1)] },
        { output: 'o2', data },
      ]);
    }
  });
});
