// Lifted from yggi/cell-studio src/midi/out.ts @ 3813fbb (which lifted it from yggi/jambot apps/web/src/audio/midi-out.ts
// @ 8cdb6b8 and adapted it to the language's played notes): on webmidi's own note (`OutNote`) in place of the language's
// `Played`, routed and turned into MIDI there by cells' `router` and `midiNote`. A note says its channel, key, velocity
// and bends itself; a frontend adapts its own events to it, one note per channel a note goes out on.

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
import { BEND_CENTRE, bendMessage, bendsOf, type Bend } from './bend';
import { deviceNote, type DrumMap } from './drum-presets';
import type { MidiPort } from './port';
import { Rotation } from './rotation';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const ALL_NOTES_OFF = 123;

/** Seconds on the audio clock to a `performance.now()` timestamp (`clock.ts`). */
type ToDeviceMs = (seconds: number) => number;

/** A 1–16 MIDI channel to its 0–15 status nibble, wrapping rather than throwing. */
const nibble = (channel: number) => (channel - 1) & 15;

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

/** A note as MIDI (cells' `MidiNote`): its channel (1–16), key and velocity, when it starts and ends, and its bends as 14-bit values. */
interface MidiNote {
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
  readonly at: number;
  readonly end: number;
  readonly bend: number;
  readonly bends: readonly { readonly at: number; readonly value: number }[];
}

/** A note as MIDI on a synth bending `bendRange` semitones, or null for one no key plays (outside 0–127, or not a whole number). */
function midiNote(e: OutNote, bendRange: number): MidiNote | null {
  if (!(Number.isInteger(e.note) && e.note >= 0 && e.note <= 127) || !Number.isFinite(e.at)) return null;
  const velocity = Number.isFinite(e.velocity) ? Math.max(1, Math.min(127, Math.round(e.velocity))) : 1;
  const end = e.at + Math.max(0, e.duration);
  if (e.drum) return { channel: e.channel, note: e.note, velocity, at: e.at, end, bend: BEND_CENTRE, bends: [] };
  return { channel: e.channel, note: e.note, velocity, at: e.at, end, ...bendsOf({ at: e.at, end, cents: e.cents, bends: e.bends }, bendRange) };
}

interface Holder {
  readonly start: number;
  readonly end: number;
}

/** How notes are sent: the device's drum map, the synth's bend range, and channels rotated per note (MPE) or not. */
export interface OutOptions {
  readonly drums: DrumMap;
  readonly bendRange: number;
  /** The channels every voice's notes rotate over (one per sounding note, MPE-style, for microtonal pieces), or null: each voice on its channel. */
  readonly rotate: readonly number[] | null;
}

export class MidiOut {
  #port: MidiPort | null;
  #options: OutOptions = { drums: {}, bendRange: 2, rotate: null };
  #rotation: Rotation | null = null;
  /** Notes held, by channel nibble and key, not yet resolved as released. */
  #open = new Map<string, Holder[]>();
  /** The bend each channel was last sent (a channel never sent one is at the centre). */
  #bend = new Map<number, number>();
  /** Per channel nibble, until when its notes sound and on what bend, to tell when notes with different bends overlap. */
  #sounding = new Map<number, { end: number; bend: number; moving: boolean }[]>();
  /** Bends sent ahead of the horizon only (`advance`), so a stop leaves none behind it. */
  #pending: { channel: number; value: number; at: number }[] = [];
  /** A run's later notes (a glide's, `play`), struck as the horizon reaches each (`advance`): a stop leaves none behind. */
  #later: OutNote[] = [];
  /** The channel nibbles sent on since the last stop. */
  #used = new Set<number>();
  /** Per channel nibble, the latest moment a bend was sent for. */
  #bendAt = new Map<number, number>();
  /** Note-offs sent, by channel and key, until the clock has passed them (`advance`'s `now`): when, and the timestamp sent. */
  #offs: { key: string; at: number; ms: number }[] = [];
  /** Note-offs a silencing left ahead of it (sent ahead, and not taken back): their channel and key, when, and the timestamp sent. */
  #struck: { key: string; at: number; ms: number }[] = [];
  /**
   * Per channel and key, the latest timestamp a note-on or note-off was sent at since the last silencing. The clock's
   * offset can move between two sends (a jump followed), so each note message on a key is sent no earlier than the one
   * before it: a note-off never lands before its own note-on, nor a note-on before the note-off it follows.
   */
  #keyMs = new Map<string, number>();
  /** Per channel nibble, a bend a silencing put back to the centre ahead of it (after a bend sent ahead): when. */
  #bentBack = new Map<number, number>();
  /** Told once when notes with different bends overlap on one channel (a microtonal piece without rotation). */
  onClash: (() => void) | null = null;

  constructor(port: MidiPort | null = null) {
    this.#port = port;
  }

  /** Adopt a port, silencing whatever the old one held first (what it left ahead is the old port's business). */
  setPort(port: MidiPort | null, atSeconds: number, toDeviceMs: ToDeviceMs): void {
    if (port === this.#port) return;
    this.panic(atSeconds, toDeviceMs);
    this.forget();
    this.#port = port;
  }

  /** How notes are sent; a change of rotation or bend range silences first, a new drum map takes the next note. */
  setOptions(options: OutOptions, atSeconds: number, toDeviceMs: ToDeviceMs): void {
    const o = this.#options;
    const rotated = (o.rotate ?? []).join() !== (options.rotate ?? []).join();
    if (o.bendRange !== options.bendRange || rotated) this.panic(atSeconds, toDeviceMs);
    this.#options = options;
    // (the same rotation from window to window keeps which channel is free longest)
    if (rotated) this.#rotation = options.rotate ? new Rotation(options.rotate) : null;
  }

  /**
   * Silence at `now` (a stop, a seek, All notes off, another channel table): All notes off on every channel in use, a
   * note-off for every note still held (at `now`, or at its start for one struck ahead), the bends put back; then
   * what's held is forgotten. Nothing goes later than the notes already sent ahead, so what plays next isn't cut.
   */
  panic(now: number, toDeviceMs: ToDeviceMs): void {
    this.#silence(now, toDeviceMs);
    this.#reset();
  }

  /** Forget what's held and what was sent, as after All notes off from elsewhere, or for another port. */
  forget(): void {
    this.#reset();
    this.#struck = [];
    this.#bentBack.clear();
  }

  #reset(): void {
    this.#open.clear();
    this.#pending = [];
    this.#later = [];
    this.#sounding.clear();
    this.#rotation?.forget();
    this.#used.clear();
    this.#bend.clear();
    this.#bendAt.clear();
    this.#offs = [];
    this.#keyMs.clear();
  }

  /**
   * Send one note: its bend if the channel needs another, its note-on, its bends while it sounds. Its release is decided
   * by `advance`. Or a run of notes, each held into the next (a glide's, which a synth plays legato): the first now and
   * the others as `advance`'s horizon reaches each, so a stop leaves none of them behind. A note on several channels is
   * a note for each.
   */
  play(run: OutNote | readonly OutNote[], toDeviceMs: ToDeviceMs): void {
    if (!this.#port) return;
    const [first, ...rest] = isRun(run) ? run : [run];
    if (!first) return;
    this.#play(first, toDeviceMs);
    for (const n of rest) this.#later.push(n);
  }

  #play(e: OutNote, toDeviceMs: ToDeviceMs): void {
    const n = midiNote(e, this.#options.bendRange);
    if (!n) return;
    this.advance(n.at, toDeviceMs);
    const drum = !!e.drum;
    const channel = nibble(!drum && this.#rotation ? this.#rotation.take(n.end) : n.channel);
    const note = drum ? deviceNote(this.#options.drums, n.note) : n.note;
    if (!drum) this.#clashes(channel, n.at, n.end, n.bend, n.bends.length > 0);
    const key = `${channel}:${note}`;
    // (a note-off a silencing left at this note's start, or before: this note-on lands after it)
    let after = -Infinity;
    for (const s of this.#struck) if (s.key === key && s.at <= n.at) after = Math.max(after, s.ms);
    this.#passed(n.at);
    const back = drum ? undefined : this.#bentBack.get(channel);
    if (back !== undefined) {
      // (a silencing put this channel's bend back at `back`, after a bend sent ahead: before then it isn't known, and after it, it's the centre)
      this.#sendBend(channel, n.bend, n.at, toDeviceMs);
      if (n.end > back && n.bend !== BEND_CENTRE) this.#sendBend(channel, n.bend, back, toDeviceMs);
      else this.#bend.set(channel, BEND_CENTRE);
    } else if (!drum && (this.#bend.get(channel) ?? BEND_CENTRE) !== n.bend) this.#sendBend(channel, n.bend, n.at, toDeviceMs);
    const holders = this.#open.get(key) ?? [];
    if (holders.some((h) => h.start <= n.at && n.at < h.end)) this.#note([NOTE_OFF | channel, note, 0], key, n.at, toDeviceMs);
    this.#note([NOTE_ON | channel, note, n.velocity], key, n.at, toDeviceMs, after);
    // a note-off a silencing left ahead, while this one sounds: struck again after it, so this one sounds on
    for (const s of this.#struck) if (s.key === key && s.at < n.end) this.#note([NOTE_ON | channel, note, n.velocity], key, s.at, toDeviceMs, s.ms);
    if (this.#struck.length) this.#struck = this.#struck.filter((s) => !(s.key === key && s.at < n.end));
    for (const b of n.bends) this.#pending.push({ channel, value: b.value, at: b.at });
    this.#open.set(key, [...holders, { start: n.at, end: n.end }]);
  }

  /**
   * Send the bends due by `horizon`, and release every note whose end is at or before it, unless another holder on its
   * channel and key still covers that moment. `now`: the clock, before which nothing sent matters to a silencing.
   */
  advance(horizon: number, toDeviceMs: ToDeviceMs, now = -Infinity): void {
    if (!this.#port) return;
    if (this.#later.length) {
      const due = this.#later.filter((l) => l.at <= horizon).sort((a, b) => a.at - b.at);
      this.#later = this.#later.filter((l) => l.at > horizon);
      for (const l of due) this.#play(l, toDeviceMs);
    }
    if (this.#offs.length) this.#offs = this.#offs.filter((o) => o.at >= now);
    if (this.#pending.length) {
      const due = this.#pending.filter((b) => b.at <= horizon).sort((a, b) => a.at - b.at);
      this.#pending = this.#pending.filter((b) => b.at > horizon);
      for (const b of due) this.#sendBend(b.channel, b.value, b.at, toDeviceMs);
    }
    for (const [key, holders] of this.#open) {
      const due = holders.filter((h) => h.end <= horizon);
      if (due.length === 0) continue;
      const [channel, note] = key.split(':').map(Number) as [number, number]; // (a key is "channel:note")
      // (two holders ending together, a note struck twice at once, release it once: the strike after the first retriggered it)
      const released = new Set<number>();
      for (const h of due) {
        const stillHeld = holders.some((o) => o !== h && o.start <= h.end && h.end < o.end);
        if (!stillHeld && !released.has(h.end)) this.#offs.push({ key, at: h.end, ms: this.#note([NOTE_OFF | channel, note, 0], key, h.end, toDeviceMs) });
        released.add(h.end);
      }
      const remaining = holders.filter((h) => h.end > horizon);
      if (remaining.length) this.#open.set(key, remaining);
      else this.#open.delete(key);
    }
  }

  // a note with a bend of its own beside another sounding on its channel with a different one: one of them is out of tune
  #clashes(channel: number, at: number, end: number, bend: number, moving: boolean): void {
    const now = (this.#sounding.get(channel) ?? []).filter((s) => s.end > at);
    if (this.onClash && now.some((s) => s.bend !== bend || s.moving || moving)) {
      this.onClash();
      this.onClash = null;
    }
    this.#sounding.set(channel, [...now, { end, bend, moving }]);
  }

  #sendBend(channel: number, value: number, at: number, toDeviceMs: ToDeviceMs): void {
    this.#send(bendMessage(channel + 1, value), at, toDeviceMs);
    this.#bend.set(channel, value);
    this.#bendAt.set(channel, Math.max(at, this.#bendAt.get(channel) ?? at));
  }

  // (notes come in start order: what a silencing left ahead before `at` no note from here on sounds across)
  #passed(at: number): void {
    if (this.#struck.length) this.#struck = this.#struck.filter((s) => s.at > at);
    for (const [c, back] of this.#bentBack) if (back <= at) this.#bentBack.delete(c);
  }

  // All notes off on every channel sent on now, a note-off for every note held (one struck ahead at its start, which
  // All notes off now can't reach), and a bend back to the centre where one was left off it, after any sent ahead
  #silence(now: number, toDeviceMs: ToDeviceMs): void {
    for (const c of this.#used) this.#send([CONTROL_CHANGE | c, ALL_NOTES_OFF, 0], now, toDeviceMs);
    for (const o of this.#offs) if (o.at > now) this.#struck.push(o);
    for (const [key, holders] of this.#open) {
      const [channel, note] = key.split(':').map(Number) as [number, number];
      for (const at of new Set(holders.map((h) => Math.max(now, h.start)))) {
        const ms = this.#note([NOTE_OFF | channel, note, 0], key, at, toDeviceMs);
        if (at > now) this.#struck.push({ key, at, ms });
      }
    }
    for (const [c, v] of this.#bend) {
      if (v === BEND_CENTRE) continue;
      const at = Math.max(now, this.#bendAt.get(c) ?? now);
      this.#send(bendMessage(c + 1, BEND_CENTRE), at, toDeviceMs);
      if (at > now) this.#bentBack.set(c, at);
    }
  }

  #send(data: readonly number[], seconds: number, toDeviceMs: ToDeviceMs): void {
    this.#sendAt(data, Math.max(0, toDeviceMs(seconds)));
  }

  // a note-on or note-off on a channel and key, no earlier than the one before it on that key (nor than `after`): the timestamp sent
  #note(data: readonly number[], key: string, seconds: number, toDeviceMs: ToDeviceMs, after = -Infinity): number {
    const ms = Math.max(0, toDeviceMs(seconds), this.#keyMs.get(key) ?? -Infinity, after);
    this.#keyMs.set(key, ms);
    this.#sendAt(data, ms);
    return ms;
  }

  #sendAt(data: readonly number[], ms: number): void {
    if (!this.#port) return;
    this.#used.add(data[0]! & 0x0f);
    try {
      this.#port.send(data, ms);
    } catch {
      // a port can vanish mid-send (unplugged, revoked): nothing to do about it
    }
  }
}

const isRun = (run: OutNote | readonly OutNote[]): run is readonly OutNote[] => Array.isArray(run);
