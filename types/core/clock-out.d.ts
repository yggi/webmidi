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
export declare const PPQN = 24;
/** A window's ticks: the index of the first (from the piece's start), their times, and the time of the tick before it. */
export interface ClockTicks {
    readonly first: number;
    readonly at: readonly number[];
    /** When tick `first − 1` falls on the same grid (−Infinity before the first): how far apart the ticks are where the window starts. */
    readonly before: number;
}
/** Seconds on the audio clock to a `performance.now()` timestamp (`clock.ts`). */
type ToDeviceMs = (seconds: number) => number;
export declare class ClockOut {
    #private;
    constructor(port?: MidiPort | null);
    /** A window's ticks: sent, beginning a run first if none is going. */
    play(ticks: ClockTicks | null, toDeviceMs: ToDeviceMs): void;
    /** Stopped at `now` (audio seconds): Stop, just after the last tick already sent. Nothing if no run is going. */
    stop(now: number, toDeviceMs: ToDeviceMs): void;
}
export {};
