// Lifted from yggi/KO-Multitool src/lib/transport/midi.ts @ 8b4b49e (MidiTransport, CaptureEvent, DeliveryStats), which
// implemented yggi/ep133-sysex's `Transport` (src/session.ts @ ca8d819) and used its `SysexAssembler` (core's here,
// sysex.ts). The shape is declared here, `SysexTransport`, so webmidi depends on no device's protocol: ep133-sysex's
// `Transport` is met structurally (transport.test.ts holds it to a copy).
//
// What it reports is deliberately observational: how a browser delivers a long SysEx response (Chrome on Android, a
// 374-byte one) isn't known, so it counts the raw delivery events and reassembles on F0/F7 rather than assuming one event
// is one message.

import type { MidiPort } from '../core/port';
import { SysexAssembler } from '../core/sysex';

/** Bytes to a device and its whole SysEx messages back: what a device's protocol needs of a host. */
export interface SysexTransport {
  send(bytes: Uint8Array): void;
  /** Hear each complete F0 … F7 message; returns the unsubscribe. */
  onMessage(cb: (bytes: Uint8Array) => void): () => void;
}

/** An input a transport listens to beside anyone else (a `MIDIInput`: `addEventListener`, so `onmidimessage` stays free). */
export interface MessageSource {
  addEventListener(type: 'midimessage', listener: (event: { readonly data: Uint8Array | null }) => void): void;
  removeEventListener(type: 'midimessage', listener: (event: { readonly data: Uint8Array | null }) => void): void;
}

export interface CaptureEvent {
  t: number;
  dir: 'tx' | 'rx';
  bytes: number[];
  /** Present on rx: how the browser actually delivered it. */
  deliveryEvents?: number;
}

export interface DeliveryStats {
  rawEvents: number;
  messages: number;
  maxEventBytes: number;
  /** Messages that arrived across more than one delivery event. */
  fragmented: number;
  /** Bytes still buffered with no closing F7. */
  danglingBytes: number;
}

/** A SysEx transport over a Web MIDI input and output, capturing every message each way (ms since it was made). */
export class MidiTransport implements SysexTransport {
  readonly capture: CaptureEvent[] = [];
  private assembler = new SysexAssembler();
  private listeners = new Set<(bytes: Uint8Array) => void>();
  private eventsSinceMessage = 0;
  private stats: DeliveryStats = {
    rawEvents: 0,
    messages: 0,
    maxEventBytes: 0,
    fragmented: 0,
    danglingBytes: 0,
  };
  private detach: () => void;
  private t0 = performance.now();

  constructor(
    input: MessageSource,
    private output: MidiPort,
  ) {
    const handler = (e: { readonly data: Uint8Array | null }) => this.receive(e);
    input.addEventListener('midimessage', handler);
    this.detach = () => input.removeEventListener('midimessage', handler);
  }

  private receive(e: { readonly data: Uint8Array | null }) {
    const data = e.data;
    if (!data) return;
    this.stats.rawEvents++;
    this.eventsSinceMessage++;
    this.stats.maxEventBytes = Math.max(this.stats.maxEventBytes, data.length);
    for (const msg of this.assembler.push(data)) {
      this.stats.messages++;
      if (this.eventsSinceMessage > 1) this.stats.fragmented++;
      this.capture.push({
        t: Math.round(performance.now() - this.t0),
        dir: 'rx',
        bytes: Array.from(msg),
        deliveryEvents: this.eventsSinceMessage,
      });
      this.eventsSinceMessage = 0;
      for (const cb of this.listeners) cb(msg);
    }
    this.stats.danglingBytes = this.assembler.pending;
  }

  send(bytes: Uint8Array) {
    this.capture.push({ t: Math.round(performance.now() - this.t0), dir: 'tx', bytes: Array.from(bytes) });
    this.output.send(Array.from(bytes));
  }

  onMessage(cb: (bytes: Uint8Array) => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  get deliveryStats(): DeliveryStats {
    return { ...this.stats, danglingBytes: this.assembler.pending };
  }

  /** Stop listening, and let go of every listener. */
  close() {
    this.detach();
    this.listeners.clear();
  }
}
