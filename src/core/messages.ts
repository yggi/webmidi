/**
 * Every channel message, read and written: where `surfaces.ts` reads a note and the sustain pedal for a player, this is
 * the wire itself, both ways, for anything bound to a message (a control of a panel, MIDI learn). The names and fields
 * are the hub's `midi-rx` contract's (`type`, `code`, `bend`, `pressure`, `program`; a channel 0–15, the status byte's
 * low nibble), so the contract's vectors run against `readChannelMessage` as they are (`src/contracts.test.ts`).
 *
 * A parameter (an NRPN, an RPN) and a 14-bit controller are several control changes; they are written whole
 * (`parameterMessages`, `controlChange14`) and read by a `ParameterReader`, which keeps what a channel has selected.
 */
import { bendMessage } from './bend';

export type ChannelMessage =
  | { readonly type: 'note_off'; readonly channel: number; readonly note: number; readonly velocity: number }
  /** As on the wire: a note-on at velocity 0 is a note-on here, and a release to `parseMidiMessage`. */
  | { readonly type: 'note_on'; readonly channel: number; readonly note: number; readonly velocity: number }
  | { readonly type: 'poly_aftertouch'; readonly channel: number; readonly note: number; readonly pressure: number }
  | { readonly type: 'control_change'; readonly channel: number; readonly code: number; readonly value: number }
  | { readonly type: 'program_change'; readonly channel: number; readonly program: number }
  | { readonly type: 'channel_aftertouch'; readonly channel: number; readonly pressure: number }
  /** 14 bits, 0 … 16383, 8192 the centre (`BEND_CENTRE`). */
  | { readonly type: 'pitch_bend'; readonly channel: number; readonly bend: number };

export type ChannelMessageType = ChannelMessage['type'];

/**
 * A whole channel message (status 0x80–0xEF) read, or null: a system message, a message cut short, a data byte with its
 * high bit set. Bytes after the message's own are ignored. No running status: Web MIDI delivers whole messages.
 */
export function readChannelMessage(data: ArrayLike<number>): ChannelMessage | null {
  const status = data[0];
  const a = data[1];
  if (status === undefined || status < 0x80 || status >= 0xf0 || a === undefined || a > 127) return null;
  const channel = status & 0x0f;
  const command = status & 0xf0;
  if (command === 0xc0) return { type: 'program_change', channel, program: a };
  if (command === 0xd0) return { type: 'channel_aftertouch', channel, pressure: a };
  const b = data[2];
  if (b === undefined || b > 127) return null;
  switch (command) {
    case 0x80:
      return { type: 'note_off', channel, note: a, velocity: b };
    case 0x90:
      return { type: 'note_on', channel, note: a, velocity: b };
    case 0xa0:
      return { type: 'poly_aftertouch', channel, note: a, pressure: b };
    case 0xb0:
      return { type: 'control_change', channel, code: a, value: b };
    default:
      return { type: 'pitch_bend', channel, bend: a | (b << 7) };
  }
}

/** A number as a whole one in a range: rounded, held to its ends; the low end for what is no number. */
const within = (v: number, max: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
const data7 = (v: number): number => within(v, 127);

/** A channel message's bytes. A value past its range is held to it (a data byte never has its high bit set); the channel is 0–15. */
export function writeChannelMessage(m: ChannelMessage): number[] {
  const channel = within(m.channel, 15);
  switch (m.type) {
    case 'note_off':
      return [0x80 | channel, data7(m.note), data7(m.velocity)];
    case 'note_on':
      return [0x90 | channel, data7(m.note), data7(m.velocity)];
    case 'poly_aftertouch':
      return [0xa0 | channel, data7(m.note), data7(m.pressure)];
    case 'control_change':
      return [0xb0 | channel, data7(m.code), data7(m.value)];
    case 'program_change':
      return [0xc0 | channel, data7(m.program)];
    case 'channel_aftertouch':
      return [0xd0 | channel, data7(m.pressure)];
    case 'pitch_bend':
      return bendMessage(channel + 1, within(m.bend, 16383));
  }
}

/** The controllers a parameter is spoken in: the two that select it, by kind, and Data Entry's two halves. */
const SELECT = { nrpn: { msb: 99, lsb: 98 }, rpn: { msb: 101, lsb: 100 } } as const;
const DATA_MSB = 6;
const DATA_LSB = 38;
/** The first controller that is the fine half (LSB) of another: 32 is 0's, … 63 is 31's. */
const FINE = 32;
/** The parameter that selects none (MSB and LSB both 127): what follows a Data Entry meant for no parameter. */
export const NO_PARAMETER = 16383;

/**
 * A 14-bit controller (0 … 16383) as its two control changes: `code` (0–31) the coarse half, `code + 32` the fine, the
 * coarse first, so a receiver that reads 7 bits is already right.
 */
export function controlChange14(channel: number, code: number, value: number): number[][] {
  const c = within(code, 31);
  const v = within(value, 16383);
  return [
    writeChannelMessage({ type: 'control_change', channel, code: c, value: v >> 7 }),
    writeChannelMessage({ type: 'control_change', channel, code: c + FINE, value: v & 0x7f }),
  ];
}

/** A parameter of a channel set: which kind, its number (0 … 16383), its value (0 … 16383; a 7-bit device reads the top 7). */
export interface ParameterChange {
  readonly type: 'nrpn' | 'rpn';
  readonly channel: number;
  readonly parameter: number;
  readonly value: number;
}

/**
 * A parameter change as its four control changes, always all four: the parameter selected (MSB, LSB), then Data Entry
 * (MSB, LSB). A device that takes 7 bits is sent `value << 7`, and ignores the last.
 */
export function parameterMessages(change: ParameterChange): number[][] {
  const { msb, lsb } = SELECT[change.type];
  const parameter = within(change.parameter, 16383);
  const value = within(change.value, 16383);
  const cc = (code: number, v: number) => writeChannelMessage({ type: 'control_change', channel: change.channel, code, value: v });
  return [cc(msb, parameter >> 7), cc(lsb, parameter & 0x7f), cc(DATA_MSB, value >> 7), cc(DATA_LSB, value & 0x7f)];
}

interface Selected {
  type: 'nrpn' | 'rpn';
  msb: number;
  lsb: number;
  value: number;
}

/**
 * Parameter changes out of a stream of control changes, channel by channel. A channel's selection is kept (a device
 * selects once and sends Data Entry many times). Each Data Entry gives a change: the coarse half the value with its
 * fine half 0, the fine half after it the value in full, so a device that sends 7 bits is read at once and one that
 * sends 14 is read twice, the second exact. Data Entry with nothing selected, or after `NO_PARAMETER`, gives nothing.
 */
export class ParameterReader {
  private readonly channels = new Map<number, Selected>();

  /** The parameter change this message completes, or null: any message may be passed, and only control changes are read. */
  read(m: ChannelMessage | null): ParameterChange | null {
    if (m?.type !== 'control_change') return null;
    for (const type of ['nrpn', 'rpn'] as const) {
      const half = m.code === SELECT[type].msb ? 'msb' : m.code === SELECT[type].lsb ? 'lsb' : null;
      if (!half) continue;
      const was = this.channels.get(m.channel);
      // (the other half is kept only within one kind: an RPN's MSB after an NRPN's LSB selects anew)
      this.channels.set(m.channel, { type, msb: 0, lsb: 0, ...(was?.type === type ? was : {}), [half]: m.value, value: 0 });
      return null;
    }
    if (m.code !== DATA_MSB && m.code !== DATA_LSB) return null;
    const selected = this.channels.get(m.channel);
    if (!selected) return null;
    const parameter = (selected.msb << 7) | selected.lsb;
    if (parameter === NO_PARAMETER) return null;
    selected.value = m.code === DATA_MSB ? m.value << 7 : (selected.value & ~0x7f) | m.value;
    return { type: selected.type, channel: m.channel, parameter, value: selected.value };
  }

  /** Forget what every channel has selected (a port unplugged, a device restarted). */
  reset(): void {
    this.channels.clear();
  }
}
