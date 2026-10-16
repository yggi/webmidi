// Lifted from yggi/cell-studio src/midi/clock-out.ts @ 3813fbb (which adapted yggi/jambot apps/web/src/audio/midi-out.ts
// @ 8cdb6b8: `clockTick`, `start` 2 ms before the first step, `stop`), the wire part only: the ticks' times come in
// (`ClockTicks`, lifted from yggi/cells src/engine/midiclock.ts @ 41ef16b, whose `ticksBetween` makes them), and when a
// piece's ticks fall stays the language's.

/**
 * MIDI clock out (yggi/cell-studio#206): a window's ticks (from the frontend: cells' `ticksBetween`, retimed onto the
 * audio clock by the player) sent to a port as Timing Clock (0xF8), 24 to a beat, timestamped through the same clock
 * offset as the notes (`clock.ts`), with Start, Continue and Stop around them.
 *
 * - **Start** (0xFA) goes 2 ms before the first tick of a run that begins at the piece's start (tick 0).
 * - **Song Position Pointer** (0xF2) and **Continue** (0xFB) go before the first tick of a run that begins anywhere
 *   else (Play after Pause, a seek, the clock switched on while playing): the run starts on the next 16th (every 6th
 *   tick), and the pointer says which, so a device following picks up where the piece is.
 * - **Stop** (0xFC) goes when the player stops (Pause, Stop, a seek, the end of a piece), or the clock is switched off.
 *   A tick sent ahead can't be taken back, so Stop lands just after the last tick already sent: at most the look-ahead
 *   (about half a second) after now. No tick lands after it, and the next run's first message lands after it too.
 *
 * Within a run, a window's ticks follow on from the last one sent. When the grid itself moved between two windows (a
 * held `free()` tempo, a hand on a motor, a recompile), a tick nearer the last one than half its own spacing is left
 * out, so none is doubled; none is added. Timestamps are never in the past and never earlier than the clock message
 * before them (the offset can jump between windows), and every send is in a try.
 */
import type { MidiPort } from './port';

/** Ticks a beat (MIDI's 24 ppqn). */
export const PPQN = 24;

/** A window's ticks: the index of the first (from the piece's start), their times, and the time of the tick before it. */
export interface ClockTicks {
  readonly first: number;
  readonly at: readonly number[];
  /** When tick `first − 1` falls on the same grid (−Infinity before the first): how far apart the ticks are where the window starts. */
  readonly before: number;
}

/** Seconds on the audio clock to a `performance.now()` timestamp (`clock.ts`). */
type ToDeviceMs = (seconds: number) => number;

const TIMING_CLOCK = 0xf8;
const START = 0xfa;
const CONTINUE = 0xfb;
const STOP = 0xfc;
const SONG_POSITION = 0xf2;

/** Start (or Continue) goes this long before the first tick (Jambot's 2 ms). */
const LEAD = 0.002;
/** Stop goes this long after the last tick sent. */
const STOP_AFTER = 0.001;
/** Two tick times this close (seconds) are one tick: the same tick, met again at a window's edge. */
const SAME = 1e-6;
/** Ticks a 16th: a run that doesn't begin at the start begins on one, which the Song Position Pointer counts. */
const SIXTEENTH = 6;
/** The farthest a Song Position Pointer reaches (14 bits of 16ths); beyond it, Continue alone. */
const MAX_POSITION = 16383;

export class ClockOut {
  #port: MidiPort | null;
  /** Ticks are being sent: a run has begun (Start or Continue) and not yet stopped. */
  #running = false;
  /** The last tick sent: its index and its time (audio seconds). */
  #lastK = -1;
  #lastAt = -Infinity;
  /** When the last Stop was sent for (audio seconds): the next run begins after it. */
  #stopAt = -Infinity;
  /** The latest timestamp a clock message was sent at: none goes earlier. */
  #lastMs = -Infinity;

  constructor(port: MidiPort | null = null) {
    this.#port = port;
  }

  /** A window's ticks: sent, beginning a run first if none is going. */
  play(ticks: ClockTicks | null, toDeviceMs: ToDeviceMs): void {
    if (!this.#port || !ticks) return;
    for (let i = 0; i < ticks.at.length; i++) {
      const k = ticks.first + i;
      const at = ticks.at[i]!;
      const before = i ? ticks.at[i - 1]! : ticks.before;
      if (!Number.isFinite(at) || at <= this.#lastAt + SAME) continue;
      if (this.#running) {
        const follows = k === this.#lastK + 1 && Math.abs(before - this.#lastAt) <= SAME;
        // (a grid that moved: no tick nearer the last one sent than half this one's own spacing)
        if (!follows && Number.isFinite(before) && at - this.#lastAt < (at - before) / 2) continue;
      } else {
        if (at - LEAD <= this.#stopAt) continue;
        if (k === 0) this.#send([START], at - LEAD, toDeviceMs);
        else {
          if (k % SIXTEENTH !== 0) continue;
          const position = k / SIXTEENTH;
          if (position <= MAX_POSITION) this.#send([SONG_POSITION, position & 0x7f, position >> 7], at - LEAD, toDeviceMs);
          this.#send([CONTINUE], at - LEAD, toDeviceMs);
        }
        this.#running = true;
      }
      this.#send([TIMING_CLOCK], at, toDeviceMs);
      this.#lastK = k;
      this.#lastAt = at;
    }
  }

  /** Stopped at `now` (audio seconds): Stop, just after the last tick already sent. Nothing if no run is going. */
  stop(now: number, toDeviceMs: ToDeviceMs): void {
    if (!this.#running) return;
    this.#running = false;
    this.#stopAt = Math.max(now, this.#lastAt + STOP_AFTER);
    this.#send([STOP], this.#stopAt, toDeviceMs);
  }

  #send(data: readonly number[], seconds: number, toDeviceMs: ToDeviceMs): void {
    if (!this.#port) return;
    const ms = Math.max(0, toDeviceMs(seconds), this.#lastMs);
    this.#lastMs = ms;
    try {
      this.#port.send(data, ms);
    } catch {
      // a port can vanish mid-send (unplugged, revoked): nothing to do about it
    }
  }
}
