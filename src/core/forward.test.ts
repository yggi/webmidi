import { describe, expect, it } from 'vitest';
import { forwardsAsPlayed, forwardsOf, forwardsOfInput } from './forward';
import { addOutput, ANY_INPUT, AS_PLAYED, BUILT_IN, chooseDevice, HEARD, inputRow, newBook, withBuiltIn, withCrossing, withPlays, type SetupBook } from './setups';

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
