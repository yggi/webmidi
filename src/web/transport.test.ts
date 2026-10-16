// New: KO-Multitool's MidiTransport (src/lib/transport/midi.ts @ 8b4b49e) had no tests of its own.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { fakePort } from '../core/fixtures';
import type { MidiPort } from '../core/port';
import { fakeListenedInput } from './fixtures';
import { MidiTransport, type MessageSource, type SysexTransport } from './transport';

/**
 * yggi/ep133-sysex's `Transport` as src/session.ts @ ca8d819 declares it, copied: webmidi doesn't depend on ep133-sysex,
 * so this holds the shape at that commit, and a change there shows only when the copy is taken again.
 */
interface Ep133Transport {
  send(bytes: Uint8Array): void;
  /** Returns an unsubscribe function. Messages must be complete F0…F7. */
  onMessage(cb: (bytes: Uint8Array) => void): () => void;
}

const GREET = [0xf0, 0x00, 0x20, 0x76, 0x33, 0x40, 0x60, 0x01, 0x01, 0xf7];

describe('MidiTransport', () => {
  it('meets ep133-sysex’s Transport, and takes a Web MIDI input and output as they are (types only)', () => {
    expectTypeOf<SysexTransport>().toExtend<Ep133Transport>();
    expectTypeOf<MidiTransport>().toExtend<Ep133Transport>();
    expectTypeOf<MIDIInput>().toExtend<MessageSource>();
    expectTypeOf<MIDIOutput>().toExtend<MidiPort>();
    // shown firing: a transport that can't be unsubscribed from is not one
    expectTypeOf<{ send(bytes: Uint8Array): void; onMessage(cb: (bytes: Uint8Array) => void): void }>().not.toExtend<Ep133Transport>();
  });

  it('hands on whole messages only, rejoined across delivery events, and counts how they came', () => {
    const input = fakeListenedInput();
    const transport = new MidiTransport(input, fakePort('out', 'KO II'));
    const heard: number[][] = [];
    transport.onMessage((bytes) => heard.push([...bytes]));
    input.deliver(GREET.slice(0, 4));
    expect(heard).toEqual([]);
    expect(transport.deliveryStats).toMatchObject({ rawEvents: 1, messages: 0, danglingBytes: 4 });
    input.deliver([...GREET.slice(4), ...GREET]);
    expect(heard).toEqual([GREET, GREET]);
    expect(transport.deliveryStats).toEqual({ rawEvents: 2, messages: 2, maxEventBytes: 16, fragmented: 1, danglingBytes: 0 });
    // (each counts the events since the message before it, as KO-Multitool's did: a second message in one event counts 0)
    expect(transport.capture.map((e) => [e.dir, e.deliveryEvents])).toEqual([
      ['rx', 2],
      ['rx', 0],
    ]);
  });

  it('sends the bytes as they are, and captures them', () => {
    const out = fakePort('out', 'KO II');
    const transport = new MidiTransport(fakeListenedInput(), out);
    transport.send(Uint8Array.from(GREET));
    expect(out.sent).toEqual([{ data: GREET, timestamp: undefined }]);
    expect(transport.capture).toEqual([{ t: expect.any(Number), dir: 'tx', bytes: GREET }]);
  });

  it('stops a listener that unsubscribes, and on close stops listening to the input', () => {
    const input = fakeListenedInput();
    const transport = new MidiTransport(input, fakePort('out', 'KO II'));
    let heard = 0;
    const off = transport.onMessage(() => heard++);
    transport.onMessage(() => heard++);
    off();
    input.deliver(GREET);
    expect(heard).toBe(1);
    expect(input.listeners).toBe(1);
    transport.close();
    expect(input.listeners).toBe(0);
    input.deliver(GREET);
    expect(heard).toBe(1);
  });
});
