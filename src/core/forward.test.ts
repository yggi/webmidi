import { describe, expect, it } from 'vitest';
import { forwardsOf, forwardsOfInput } from './forward';
import { addOutput, ANY_INPUT, AS_PLAYED, chooseDevice, inputRow, newBook, withCrossing, type SetupBook } from './setups';

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

  it('takes the bytes as Web MIDI gives them (a Uint8Array)', () => {
    expect(forwardsOf(book(), 'band', row, new Uint8Array([0x93, 60, 0]))).toEqual([
      { output: 'o1', data: [0x94, 60, 0] },
      { output: 'o2', data: [0x93, 60, 0] },
    ]);
  });
});

describe('forwardsOfInput', () => {
  it('sends by the input’s own row and by every input’s, the same bytes to one output once', () => {
    let b = book();
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
});
