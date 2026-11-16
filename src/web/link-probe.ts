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
import { LINK_LEAD, LINK_RUNS, LINK_TIMEOUT, LinkMeter, linkReport, type LinkLength, type LinkReport } from '../core/link';
import type { MidiPort } from '../core/port';

/** An input listened to beside anyone else (a `MIDIInput`), with the time the port saw each message. */
export interface ProbeInput {
  /** A `MIDIInput` opens when it is asked to: listening by `addEventListener` doesn't open it by itself. */
  open?(): Promise<unknown>;
  addEventListener(type: 'midimessage', listener: (event: { readonly data: Uint8Array | null; readonly timeStamp: number }) => void): void;
  removeEventListener(type: 'midimessage', listener: (event: { readonly data: Uint8Array | null; readonly timeStamp: number }) => void): void;
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
  readonly onprogress?: (progress: { readonly sent: number; readonly of: number }) => void;
}

const aborted = () => new DOMException('The link measurement was stopped.', 'AbortError');

/**
 * Run the probes and report: resolves with the `LinkReport`, or rejects with an `AbortError` when `signal` aborts (what was
 * sent stays sent; nothing more goes out and the input is let go of).
 */
export async function runLinkProbe(options: LinkProbeOptions): Promise<LinkReport> {
  const { output, input, signal, onprogress } = options;
  const { probes, spacing } = LINK_RUNS[options.length ?? 'quick'];
  if (signal?.aborted) throw aborted();

  const meter = new LinkMeter();
  let answered: (() => void) | null = null;
  const listener = (event: { readonly data: Uint8Array | null; readonly timeStamp: number }) => {
    if (!event.data) return;
    const heard = meter.heard(event.data, event.timeStamp, performance.now());
    if (heard === 'matched' || heard === 'late') answered?.();
  };

  /** Wait `ms`, or until `done` is called (the probe came back), or the run is aborted. */
  const wait = (ms: number, early = false) =>
    new Promise<void>((resolve, reject) => {
      const finish = () => (clearTimeout(timer), signal?.removeEventListener('abort', stop), (answered = null), resolve());
      const stop = () => (clearTimeout(timer), (answered = null), reject(aborted()));
      const timer = setTimeout(finish, Math.max(0, ms));
      signal?.addEventListener('abort', stop, { once: true });
      if (early) answered = finish;
    });

  input.addEventListener('midimessage', listener);
  try {
    await input.open?.();
    const start = performance.now();
    for (let i = 0; i < probes; i++) {
      if (signal?.aborted) throw aborted();
      const called = performance.now();
      const ahead = i % 2 === 0 ? LINK_LEAD : 0;
      const { bytes } = meter.sent(called, ahead);
      if (ahead > 0) output.send(bytes, called + ahead);
      else output.send(bytes);
      // out until it is back or just past its timeout: never two at once
      await wait(ahead + LINK_TIMEOUT + 1, true);
      onprogress?.({ sent: i + 1, of: probes });
      if (i + 1 < probes) await wait(start + (i + 1) * spacing - performance.now());
    }
  } finally {
    input.removeEventListener('midimessage', listener);
  }
  const environment = options.environment ?? (typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent);
  return linkReport({ at: new Date().toISOString(), output: options.outputName, input: options.inputName, environment }, meter.stats(performance.now()));
}
