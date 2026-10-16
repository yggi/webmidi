import type { MidiPort, PortAccess, PortOption } from '../core/port';
import { type ParsedNote } from '../core/surfaces';
/** What a connection tells: a note from a listened input, every message from one (for CCs), the ports changed. */
export interface MidiHandlers {
    /** A note-on or note-off, and the name of the port it came from. */
    onNote?: (note: ParsedNote, source: string) => void;
    /** Every message, raw, with the port's name and when the port saw it (ms on the page's clock). */
    onMessage?: (data: Uint8Array, source: string, timeStamp: number) => void;
    /** The ports may have changed: one plugged in or out, or a person asking to look again (`refresh`). */
    onChange?: () => void;
}
/** What is asked for: SysEx too, or not (a browser may prompt for it where it doesn't for notes). */
export interface MidiRequest {
    readonly sysex?: boolean;
}
/** Whether this host has Web MIDI to ask for. */
export declare const hasWebMidi: () => boolean;
/** Ask for Web MIDI, SysEx too or not: the browser's `MIDIAccess`, or a throw (no Web MIDI here, or access refused). */
export declare function requestAccess(sysex: boolean): Promise<MIDIAccess>;
/** Where the page runs, as far as Web MIDI cares: for a report of why it can't be had (KO-Multitool's diagnostics). */
export interface MidiEnvironment {
    secureContext: boolean;
    hasWebMidi: boolean;
    standalone: boolean;
    userAgent: string;
    language: string;
    /** file:// yields "null" here — an opaque origin has nothing to grant a permission against. */
    origin: string;
    protocol: string;
    serviceWorker: boolean;
}
export declare function readEnvironment(): MidiEnvironment;
/** A live Web MIDI connection: the ports plugged in, and which input is listened to. */
export declare class MidiAccess implements PortAccess {
    #private;
    private constructor();
    /**
     * Whether Web MIDI (SysEx too, if asked) may be asked for without a prompt (the browser says it is granted), so a page
     * load can reconnect quietly. Denied, or still to be asked: no. A browser that can't say: yes, as it was before.
     */
    static granted({ sysex }?: MidiRequest): Promise<boolean>;
    /** Ask for Web MIDI. The connection, or in words why there is none: no Web MIDI here, or access blocked. Never throws. */
    static connect(on?: MidiHandlers, { sysex }?: MidiRequest): Promise<MidiAccess | string>;
    get inputs(): PortOption[];
    get outputs(): PortOption[];
    outputPort(id: string): MidiPort | null;
    /** The browser's own connection, for what this one doesn't wrap: the ports' details (`listPorts`), a SysEx transport. */
    get access(): MIDIAccess;
    /** Look at the ports again: listen anew (a port plugged in again is a fresh object), and say they may have changed. */
    refresh(): void;
    /** Let go: no input is listened to and the ports' changes are no longer heard. */
    close(): void;
    /** Listen to one input by id, `'all'` of them, or `'none'`. */
    listen(id: string): void;
}
