/**
 * The link probe (yggi/webmidi#75): probes sent on an output and timed back on an input of the loop (a cable from an out
 * to an in, or a device that echoes), with timers and the page's clock. The measuring is core's (`LinkMeter`); this runs
 * it. It sends only when called, and a frontend calls it only when the person presses the button, and says so.
 *
 * One probe is out at a time: the next goes when the last has come back or its timeout has passed, and no sooner than
 * its place in the run (so a scheduled probe, which leaves `LINK_LEAD` after the call, makes its slot a little longer).
 * Probes go out scheduled (stamped `LINK_LEAD` ahead) and at once in turn, so a run says whether the platform honours
 * timestamps. Abortable; reports its progress.
 */
import { type LinkLength, type LinkReport } from '../core/link';
import type { MidiPort } from '../core/port';
/** An input listened to beside anyone else (a `MIDIInput`), with the time the port saw each message. */
export interface ProbeInput {
    /** A `MIDIInput` opens when it is asked to: listening by `addEventListener` doesn't open it by itself. */
    open?(): Promise<unknown>;
    addEventListener(type: 'midimessage', listener: (event: {
        readonly data: Uint8Array | null;
        readonly timeStamp: number;
    }) => void): void;
    removeEventListener(type: 'midimessage', listener: (event: {
        readonly data: Uint8Array | null;
        readonly timeStamp: number;
    }) => void): void;
}
export interface LinkProbeOptions {
    /** The output probes go out on, and the input of its loop they are heard on. */
    readonly output: MidiPort;
    readonly input: ProbeInput;
    /** Their names, as the report says them. */
    readonly outputName: string;
    readonly inputName: string;
    /** Quick (100 probes 20 ms apart) or long (600, 100 ms apart): quick by default. */
    readonly length?: LinkLength;
    /** The browser and OS as the report says them: the user agent by default. */
    readonly environment?: string;
    readonly signal?: AbortSignal;
    /** After each probe: how many are sent of how many. */
    readonly onprogress?: (progress: {
        readonly sent: number;
        readonly of: number;
    }) => void;
}
/**
 * Run the probes and report: resolves with the `LinkReport`, or rejects with an `AbortError` when `signal` aborts (what was
 * sent stays sent; nothing more goes out and the input is let go of).
 */
export declare function runLinkProbe(options: LinkProbeOptions): Promise<LinkReport>;
