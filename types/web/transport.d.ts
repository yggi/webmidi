import type { MidiPort } from '../core/port';
/** Bytes to a device and its whole SysEx messages back: what a device's protocol needs of a host. */
export interface SysexTransport {
    send(bytes: Uint8Array): void;
    /** Hear each complete F0 … F7 message; returns the unsubscribe. */
    onMessage(cb: (bytes: Uint8Array) => void): () => void;
}
/** An input a transport listens to beside anyone else (a `MIDIInput`: `addEventListener`, so `onmidimessage` stays free). */
export interface MessageSource {
    addEventListener(type: 'midimessage', listener: (event: {
        readonly data: Uint8Array | null;
    }) => void): void;
    removeEventListener(type: 'midimessage', listener: (event: {
        readonly data: Uint8Array | null;
    }) => void): void;
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
export declare class MidiTransport implements SysexTransport {
    private output;
    readonly capture: CaptureEvent[];
    private assembler;
    private listeners;
    private eventsSinceMessage;
    private stats;
    private detach;
    private t0;
    constructor(input: MessageSource, output: MidiPort);
    private receive;
    send(bytes: Uint8Array): void;
    onMessage(cb: (bytes: Uint8Array) => void): () => undefined;
    get deliveryStats(): DeliveryStats;
    /** Stop listening, and let go of every listener. */
    close(): void;
}
