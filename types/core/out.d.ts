/**
 * MIDI out (yggi/cell-studio#205): the notes a frontend plays (`OutNote`, on the audio clock) sent to a port,
 * timestamped for the moment they are heard. Where each goes is the frontend's (Cell studio's channel table, Jambot's
 * parts); a device's drum map is applied here, at the output, and nowhere before.
 *
 * A note-off is answered by the decision its note-on got, never by what else is sounding at release: two voices on one
 * channel often share a pitch, and one striking the other's note must not cut it short. A note already held on its
 * channel and key retriggers, off then on; a note-off reaches the port only once its last holder's own end arrives with
 * nothing else still covering it. Notes come in non-decreasing start order, so `advance(horizon)` decides every release
 * whose end has passed that horizon from intervals already known.
 *
 * A timestamp is never in the past (`max(0, …)`: a late send, not a lost one), and every send sits in a try (a port can
 * vanish mid-send). A timestamped message can't be taken back, so silencing (`panic`: a stop, a seek, another channel
 * table) sends All notes off now and a note-off for every note still held, at once for one sounding and at its start for
 * one struck ahead, and sends nothing later that could cut what plays next. A note-off left ahead of it (sent ahead,
 * not taken back) that a note sent since sounds across is followed by that note struck again: retriggered, not cut. A
 * bend put back after one sent ahead is said again by a note sent since that sounds across it.
 */
import { type Bend } from './bend';
import { type DrumMap } from './drum-presets';
import type { MidiPort } from './port';
/** Seconds on the audio clock to a `performance.now()` timestamp (`clock.ts`). */
type ToDeviceMs = (seconds: number) => number;
/** A note to send: when and for how long, which key on which channel, how hard, and its bends. */
export interface OutNote {
    /** When it starts, in seconds on the clock `toDeviceMs` reads (the audio clock). */
    readonly at: number;
    /** How long it sounds, in seconds. */
    readonly duration: number;
    /** Its key, 0–127; a drum's is its General MIDI drum note, which the device's drum map sends as its own. A note outside 0–127 is not sent. */
    readonly note: number;
    /** How hard it is struck, 1–127 (rounded, and held to that range: a note-on at 0 would be a note-off). */
    readonly velocity: number;
    /** Its channel, 1–16. */
    readonly channel: number;
    /** A drum: sent through the device's drum map, never bent, and never on a rotated channel. */
    readonly drum?: boolean;
    /** The cents it is off its key at its start (a microtonal note), sent as a bend over the synth's bend range. */
    readonly cents?: number;
    /** Its bends while it sounds, in cents from the pitch it starts on; a ramp glides there from the point before. */
    readonly bends?: readonly Bend[];
}
/** How notes are sent: the device's drum map, the synth's bend range, and channels rotated per note (MPE) or not. */
export interface OutOptions {
    readonly drums: DrumMap;
    readonly bendRange: number;
    /** The channels every voice's notes rotate over (one per sounding note, MPE-style, for microtonal pieces), or null: each voice on its channel. */
    readonly rotate: readonly number[] | null;
}
export declare class MidiOut {
    #private;
    /** Told once when notes with different bends overlap on one channel (a microtonal piece without rotation). */
    onClash: (() => void) | null;
    constructor(port?: MidiPort | null);
    /** Adopt a port, silencing whatever the old one held first (what it left ahead is the old port's business). */
    setPort(port: MidiPort | null, atSeconds: number, toDeviceMs: ToDeviceMs): void;
    /** How notes are sent; a change of rotation or bend range silences first, a new drum map takes the next note. */
    setOptions(options: OutOptions, atSeconds: number, toDeviceMs: ToDeviceMs): void;
    /**
     * Silence at `now` (a stop, a seek, All notes off, another channel table): All notes off on every channel in use, a
     * note-off for every note still held (at `now`, or at its start for one struck ahead), the bends put back; then
     * what's held is forgotten. Nothing goes later than the notes already sent ahead, so what plays next isn't cut.
     */
    panic(now: number, toDeviceMs: ToDeviceMs): void;
    /** Forget what's held and what was sent, as after All notes off from elsewhere, or for another port. */
    forget(): void;
    /**
     * Send one note: its bend if the channel needs another, its note-on, its bends while it sounds. Its release is decided
     * by `advance`. Or a run of notes, each held into the next (a glide's, which a synth plays legato): the first now and
     * the others as `advance`'s horizon reaches each, so a stop leaves none of them behind. A note on several channels is
     * a note for each.
     */
    play(run: OutNote | readonly OutNote[], toDeviceMs: ToDeviceMs): void;
    /**
     * Send the bends due by `horizon`, and release every note whose end is at or before it, unless another holder on its
     * channel and key still covers that moment. `now`: the clock, before which nothing sent matters to a silencing.
     */
    advance(horizon: number, toDeviceMs: ToDeviceMs, now?: number): void;
}
export {};
