/**
 * The family's contracts (yggi/music-commons `contracts/`) run against core: `midi-rx`, what a receiver must deliver
 * from a byte stream. The form is lifted from yggi/cells src/contracts.test.ts @ 41ef16b: the vectors are copied into
 * `fixtures/contracts/`, with a `lifted` line naming the hub and the commit they came from, and the hub's README for
 * the contract is the rule. A vector core doesn't meet is recorded here, with what core does, not changed to fit.
 *
 * Core reads the layer above the bytes: Web MIDI frames the stream and hands over whole messages, and core reads each
 * (`parseMidiMessage`: notes; `parseSustain`: the sustain pedal); and beside them the wire itself
 * (`readChannelMessage`: every channel message, as the contract names it). So a
 * vector runs here as a browser delivers it, its bytes cut into messages at each status byte. Each vector is run and
 * passes, or is recorded as outside that layer, or as differing, with the reason; what core does with the ones it
 * doesn't run is asserted too, so a change in core shows here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bendMessage } from './core/bend';
import { ClockOut } from './core/clock-out';
import { fakePort } from './core/fixtures';
import { readChannelMessage } from './core/messages';
import { parseMidiMessage, parseSustain } from './core/surfaces';

interface Message {
  readonly type: string;
  readonly [field: string]: unknown;
}
interface RxVector {
  readonly name: string;
  readonly bytes: readonly number[];
  readonly expect: readonly Message[];
}
const midiRx: { lifted: string; version: number; vectors: readonly RxVector[] } = JSON.parse(readFileSync(new URL('../fixtures/contracts/midi-rx.json', import.meta.url), 'utf8'));
const vector = (name: string) => midiRx.vectors.find((v) => v.name === name)!;

/** A stream cut into messages as Web MIDI delivers them: a status byte (0x80 and up) starts one. Only for a stream of whole messages. */
const messages = (bytes: readonly number[]): number[][] => bytes.reduce<number[][]>((out, b) => (b >= 0x80 || !out.length ? [...out, [b]] : (out.at(-1)!.push(b), out)), []);

/** What core delivers from a stream, in the contract's terms: its notes and sustain pedal, in order. */
const delivered = (bytes: readonly number[]): Message[] =>
  messages(bytes).flatMap((m): Message[] => {
    const note = parseMidiMessage(m);
    if (note) return [{ type: note.on ? 'note_on' : 'note_off', channel: note.channel, note: note.note, velocity: note.velocity }];
    const pedal = parseSustain(m);
    return pedal ? [{ type: 'control_change', channel: pedal.channel, code: 64 }] : [];
  });

/** Run, and passed. */
const RUN = ['note_on', 'note_off', 'note_below_the_piano_range', 'channel_is_the_low_nibble', 'three_note_chord_in_one_drain', 'a_truncated_message_completes_nothing'];

/** Run through the wire's reader alone (`readChannelMessage`), and passed: what a player's reader (`delivered`) reads otherwise, or not at all. */
const WIRE = [
  'note_on_velocity_zero_is_still_a_note_on_at_the_wire',
  'two_control_changes_in_one_drain',
  'pitch_bend_centre',
  'pitch_bend_full_up',
  'channel_aftertouch',
  'program_change',
];

/** What the wire's reader delivers from a stream: every channel message, in the contract's terms as they are. */
const onTheWire = (bytes: readonly number[]): Message[] => messages(bytes).flatMap((m): Message[] => [readChannelMessage(m)].filter((r) => r !== null));

/** Outside the layer core reads, and why. */
const OUTSIDE: Record<string, string> = {
  running_status: 'framing: the browser expands running status, and Web MIDI delivers whole messages',
  realtime_byte_inside_a_message: 'framing: the browser lifts a real-time byte out of the message it interrupts',
  active_sensing_inside_a_message: 'framing, as the real-time byte; and core reads no active sensing',
  transport_start_then_clock_then_stop: 'core reads no clock in (no MIDI clock in yet); it writes this alphabet (checked below)',
  a_new_status_abandons_the_unfinished_one: 'framing: Web MIDI delivers no unfinished message',
};

/** Read by core, and not as the vector says: none. */
const DIFFERS: Record<string, string> = {};

/** The vectors not run or recorded, and the names recorded twice or for no vector: both empty when each is recorded once. */
const unrecorded = (names: readonly string[], recorded: readonly string[]) => ({
  missing: names.filter((n) => !recorded.includes(n)),
  extra: recorded.filter((n, i) => !names.includes(n) || recorded.indexOf(n) !== i),
});

describe('the midi-rx contract (music-commons contracts/midi-rx, version 1)', () => {
  const recorded = [...RUN, ...WIRE, ...Object.keys(OUTSIDE), ...Object.keys(DIFFERS)];

  it('is shown firing: a vector the hub adds, or one recorded twice, is caught', () => {
    expect(unrecorded(['a', 'b', 'new'], ['a', 'b'])).toEqual({ missing: ['new'], extra: [] });
    expect(unrecorded(['a', 'b'], ['a', 'b', 'a', 'gone'])).toEqual({ missing: [], extra: ['a', 'gone'] });
  });

  it('is the version core is checked against, lifted with its source named, every vector run or recorded once', () => {
    expect(midiRx.version).toBe(1);
    expect(midiRx.lifted).toMatch(/^Lifted from yggi\/music-commons contracts\/midi-rx\/vectors\.json @ [0-9a-f]{7,40}$/);
    expect(
      unrecorded(
        midiRx.vectors.map((v) => v.name),
        recorded,
      ),
    ).toEqual({ missing: [], extra: [] });
    expect([RUN.length, WIRE.length, Object.keys(OUTSIDE).length, Object.keys(DIFFERS).length]).toEqual([6, 6, 5, 0]);
  });

  it.each(RUN)('%s: core delivers every message the stream completes, in order, none lost and none invented', (name) => {
    const v = vector(name);
    const got = delivered(v.bytes);
    expect(got).toHaveLength(v.expect.length);
    v.expect.forEach((m, i) => expect(got[i], `${name} #${i}`).toMatchObject(m));
  });

  it.each([...RUN, ...WIRE])('%s: the wire’s reader delivers every channel message the stream completes, as the vector spells it', (name) => {
    const v = vector(name);
    expect(onTheWire(v.bytes)).toEqual(v.expect);
  });

  it('a note-on at velocity 0: a note-on on the wire, and a release to a player, as the vector asks of the consumer', () => {
    expect(delivered(vector('note_on_velocity_zero_is_still_a_note_on_at_the_wire').bytes)).toEqual([{ type: 'note_off', channel: 0, note: 60, velocity: 0 }]);
  });

  it('what a player’s reader reads none of, delivered whole: nothing (a controller other than the pedal, a program change, aftertouch, a bend, the clock)', () => {
    for (const name of ['two_control_changes_in_one_drain', 'program_change', 'pitch_bend_centre', 'pitch_bend_full_up', 'transport_start_then_clock_then_stop'])
      expect(delivered(vector(name).bytes), name).toEqual([]);
    // (the note after the aftertouch is read)
    expect(delivered(vector('channel_aftertouch').bytes)).toEqual([{ type: 'note_on', channel: 0, note: 60, velocity: 100 }]);
  });

  it('a pitch bend as the vectors spell it is what core writes: 14 bits, LSB first, the centre 8192 (bendMessage)', () => {
    for (const name of ['pitch_bend_centre', 'pitch_bend_full_up']) {
      const v = vector(name);
      const m = v.expect[0] as unknown as { channel: number; bend: number };
      expect(bendMessage(m.channel + 1, m.bend), name).toEqual(v.bytes);
    }
  });

  it('Start, Timing Clock and Stop as the vector spells them are what core writes (ClockOut)', () => {
    const port = fakePort('out', 'Clock');
    const out = new ClockOut(port);
    out.play({ first: 0, at: [1, 1.02], before: -Infinity }, (s) => s * 1000);
    out.stop(2, (s) => s * 1000);
    expect(port.sent.map((m) => m.data[0])).toEqual(vector('transport_start_then_clock_then_stop').bytes);
  });
});
