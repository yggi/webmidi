import { describe, expect, it } from 'vitest';
import { controlChange14, NO_PARAMETER, ParameterReader, parameterMessages, readChannelMessage, writeChannelMessage, type ChannelMessage, type ParameterChange } from './messages';

/** One of each type, with the bytes it is on the wire. */
const EACH: readonly (readonly [ChannelMessage, readonly number[]])[] = [
  [{ type: 'note_off', channel: 0, note: 60, velocity: 64 }, [0x80, 60, 64]],
  [{ type: 'note_on', channel: 9, note: 38, velocity: 90 }, [0x99, 38, 90]],
  [{ type: 'poly_aftertouch', channel: 1, note: 61, pressure: 33 }, [0xa1, 61, 33]],
  [{ type: 'control_change', channel: 15, code: 74, value: 127 }, [0xbf, 74, 127]],
  [{ type: 'program_change', channel: 2, program: 5 }, [0xc2, 5]],
  [{ type: 'channel_aftertouch', channel: 3, pressure: 77 }, [0xd3, 77]],
  [{ type: 'pitch_bend', channel: 4, bend: 8192 }, [0xe4, 0, 64]],
  [{ type: 'pitch_bend', channel: 0, bend: 16383 }, [0xe0, 127, 127]],
  [{ type: 'pitch_bend', channel: 0, bend: 1 }, [0xe0, 1, 0]],
];

describe('readChannelMessage and writeChannelMessage', () => {
  it.each(EACH)('%o is %o, written and read back', (message, bytes) => {
    expect(writeChannelMessage(message)).toEqual(bytes);
    expect(readChannelMessage(bytes)).toEqual(message);
  });

  it('reads a Uint8Array as the browser hands one over, and ignores bytes after the message', () => {
    expect(readChannelMessage(new Uint8Array([0xb0, 7, 100]))).toEqual({ type: 'control_change', channel: 0, code: 7, value: 100 });
    expect(readChannelMessage([0xc0, 5, 99])).toEqual({ type: 'program_change', channel: 0, program: 5 });
  });

  it('keeps a note-on at velocity 0 a note-on: the wire, not what a player hears', () => {
    expect(readChannelMessage([0x90, 60, 0])).toEqual({ type: 'note_on', channel: 0, note: 60, velocity: 0 });
  });

  it('reads nothing from a system message, a message cut short, no status, or a data byte with its high bit set', () => {
    for (const bytes of [[], [0xf8], [0xf0, 1, 2, 0xf7], [0x90], [0x90, 60], [0xc0], [60, 100], [0x90, 0x80, 1], [0xb0, 1, 200]])
      expect(readChannelMessage(bytes), String(bytes)).toBeNull();
  });

  it('holds what it writes to the range, so no data byte is a status byte', () => {
    expect(writeChannelMessage({ type: 'control_change', channel: 16, code: 200, value: -3 })).toEqual([0xbf, 127, 0]);
    expect(writeChannelMessage({ type: 'control_change', channel: 0, code: 7, value: 63.6 })).toEqual([0xb0, 7, 64]);
    expect(writeChannelMessage({ type: 'pitch_bend', channel: 0, bend: 99999 })).toEqual([0xe0, 127, 127]);
    expect(writeChannelMessage({ type: 'program_change', channel: 0, program: NaN })).toEqual([0xc0, 0]);
  });
});

describe('controlChange14', () => {
  it('is the coarse half on the controller, then the fine half 32 above', () => {
    expect(controlChange14(0, 1, 8192)).toEqual([
      [0xb0, 1, 64],
      [0xb0, 33, 0],
    ]);
    expect(controlChange14(2, 7, 16383)).toEqual([
      [0xb2, 7, 127],
      [0xb2, 39, 127],
    ]);
  });

  it('holds the controller to those that have a fine half (0–31)', () => {
    expect(controlChange14(0, 40, 129)).toEqual([
      [0xb0, 31, 1],
      [0xb0, 63, 1],
    ]);
  });
});

const read = (reader: ParameterReader, messages: readonly (readonly number[])[]): ParameterChange[] =>
  messages.flatMap((m) => {
    const change = reader.read(readChannelMessage(m));
    return change ? [change] : [];
  });

describe('parameterMessages and ParameterReader', () => {
  it('an NRPN is four control changes: 99, 98, then Data Entry 6 and 38', () => {
    expect(parameterMessages({ type: 'nrpn', channel: 0, parameter: 300, value: 1000 })).toEqual([
      [0xb0, 99, 2],
      [0xb0, 98, 44],
      [0xb0, 6, 7],
      [0xb0, 38, 104],
    ]);
  });

  it('an RPN selects with 101 and 100 (the bend range, RPN 0, at 12 semitones)', () => {
    expect(parameterMessages({ type: 'rpn', channel: 1, parameter: 0, value: 12 << 7 })).toEqual([
      [0xb1, 101, 0],
      [0xb1, 100, 0],
      [0xb1, 6, 12],
      [0xb1, 38, 0],
    ]);
  });

  it('what is written is read back: once coarse, then in full', () => {
    const change: ParameterChange = { type: 'nrpn', channel: 5, parameter: 300, value: 1000 };
    expect(read(new ParameterReader(), parameterMessages(change))).toEqual([{ ...change, value: 7 << 7 }, change]);
  });

  it('a selection is kept: Data Entry again changes the same parameter, and a device sending 7 bits is read at once', () => {
    const reader = new ParameterReader();
    const got = read(reader, [
      [0xb0, 99, 0],
      [0xb0, 98, 9],
      [0xb0, 6, 10],
      [0xb0, 6, 11],
    ]);
    expect(got.map((c) => [c.parameter, c.value >> 7])).toEqual([
      [9, 10],
      [9, 11],
    ]);
  });

  it('channels are apart, and the kinds: an RPN selected after an NRPN starts anew', () => {
    const reader = new ParameterReader();
    read(reader, [
      [0xb0, 99, 1],
      [0xb0, 98, 2],
      [0xb1, 6, 50],
    ]);
    expect(read(reader, [[0xb1, 6, 50]])).toEqual([]);
    expect(read(reader, [[0xb0, 6, 50]])).toEqual([{ type: 'nrpn', channel: 0, parameter: 130, value: 50 << 7 }]);
    expect(
      read(reader, [
        [0xb0, 100, 1],
        [0xb0, 6, 2],
      ]),
    ).toEqual([{ type: 'rpn', channel: 0, parameter: 1, value: 2 << 7 }]);
  });

  it('gives nothing for Data Entry with nothing selected, after the null parameter, after a reset, or from another message', () => {
    const reader = new ParameterReader();
    expect(read(reader, [[0xb0, 6, 1]])).toEqual([]);
    expect(
      read(reader, [
        [0xb0, 101, 127],
        [0xb0, 100, 127],
        [0xb0, 6, 1],
      ]),
    ).toEqual([]);
    expect(NO_PARAMETER).toBe((127 << 7) | 127);
    read(reader, [
      [0xb0, 99, 0],
      [0xb0, 98, 1],
    ]);
    reader.reset();
    expect(read(reader, [[0xb0, 6, 1]])).toEqual([]);
    expect(reader.read(null)).toBeNull();
    expect(reader.read({ type: 'note_on', channel: 0, note: 6, velocity: 1 })).toBeNull();
  });
});
