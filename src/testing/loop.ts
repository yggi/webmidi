// A MIDI loop without hardware, for tests of the link's measurement (yggi/webmidi#75): an output wired to an input, as a
// cable from an out to an in on one interface is. What is sent comes back after a latency, a jitter, a drift, with
// some of it lost, late or twice, as made. Seeded, so a run is the same each time. It keeps time with timers and
// `performance.now()`, so a test's fake timers drive it (they fire on whole milliseconds: a test's times are whole ones); held to the web gate, like the rest of `testing`.

/** What a made loop does to a message. Times are ms. */
export interface LoopOptions {
  /** From leaving the output to arriving at the input (default 1). */
  readonly latency?: number;
  /** Added to each message, uniformly from 0 to this (default 0). */
  readonly jitter?: number;
  /** The loop grows by this much each minute (default 0). */
  readonly drift?: number;
  /** A share of messages never arriving, 0 … 1 (default 0). */
  readonly loss?: number;
  /** A share arriving `reorderBy` late (default 0, and 25 ms), so after the messages sent after them. */
  readonly reorder?: number;
  readonly reorderBy?: number;
  /** A share arriving twice (default 0). */
  readonly duplicate?: number;
  /** Whether a message sent with a timestamp leaves at it (default true) or at once, as a platform that ignores them does. */
  readonly honoursTimestamps?: boolean;
  /** How long after the message arrived the page's handler runs (default 0.1): the event's `timeStamp` is when it arrived. */
  readonly pageLag?: number;
  /** Whether SysEx passes (default true): a device that doesn't echo it. */
  readonly passesSysex?: boolean;
  readonly seed?: number;
}

/** An event as the loop's input delivers it. */
interface LoopEvent {
  readonly data: Uint8Array | null;
  readonly timeStamp: number;
}
type Listener = (event: LoopEvent) => void;

/** A small seeded generator (mulberry32): a number in [0, 1) each call. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An output wired to an input: `output.send` as a `MidiPort`, `input.addEventListener('midimessage', …)` as a `MIDIInput`. */
export function fakeLoop(options: LoopOptions = {}) {
  const { latency = 1, jitter = 0, drift = 0, loss = 0, reorder = 0, reorderBy = 25, duplicate = 0, honoursTimestamps = true, pageLag = 0.1, passesSysex = true } = options;
  const random = seeded(options.seed ?? 1);
  const listeners = new Set<Listener>();
  const started = performance.now();
  const loop = {
    output: {
      id: 'loop-out',
      name: 'Loop out',
      sent: [] as number[][],
      send(data: readonly number[], timestamp?: number): void {
        const now = performance.now();
        loop.output.sent.push([...data]);
        if (data[0] === 0xf0 && !passesSysex) return;
        const left = honoursTimestamps && timestamp !== undefined ? Math.max(timestamp, now) : now;
        // the same draws for each message, whatever it does, so one option doesn't shift another's
        const [lost, late, twice, spread] = [random(), random(), random(), random()];
        if (lost < loss) return void loop.drops++;
        const arrives = left + latency + spread * jitter + (drift * (left - started)) / 60_000 + (late < reorder ? reorderBy : 0);
        const deliver = (at: number) => {
          setTimeout(
            () => {
              loop.arrivals++;
              const event = { data: new Uint8Array(data), timeStamp: at };
              listeners.forEach((l) => l(event));
            },
            Math.max(0, at + pageLag - now),
          );
        };
        deliver(arrives);
        if (twice < duplicate) deliver(arrives + 0.5);
      },
    },
    input: {
      id: 'loop-in',
      name: 'Loop in',
      addEventListener: (_type: 'midimessage', listener: Listener) => void listeners.add(listener),
      removeEventListener: (_type: 'midimessage', listener: Listener) => void listeners.delete(listener),
    },
    drops: 0,
    arrivals: 0,
    /** Messages dropped, and delivered (a duplicate counts twice). */
    get dropped() {
      return loop.drops;
    },
    get delivered() {
      return loop.arrivals;
    },
  };
  return loop;
}
