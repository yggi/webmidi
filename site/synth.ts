/**
 * The page's own sound: a small synth in Web Audio, so a panel or an input makes a sound with no device plugged in
 * (and where the browser has no Web MIDI at all). It takes MIDI as a device would: notes on every channel, two
 * detuned saws through a filter; on channel 10 a kick, a snare and hats by General MIDI note; the pitch bend (two
 * semitones), the sustain pedal, the volume (CC 7), the filter (CC 74) and all notes off (CC 123). The audio starts
 * with the first message, which a press or a key brings, as a browser asks.
 */
import { readChannelMessage } from '../src/core/index';

interface Voice {
  readonly oscillators: OscillatorNode[];
  readonly gain: GainNode;
  /** Released while the pedal is down: let go when it lifts. */
  held: boolean;
}

/** The General MIDI drum notes it tells apart; any other on channel 10 is a hat. */
const KICKS = [35, 36];
const SNARES = [37, 38, 39, 40];

export class Synth {
  private context: AudioContext | null = null;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private readonly voices = new Map<string, Voice>();
  private readonly bend = new Map<number, number>();
  private readonly pedal = new Set<number>();

  /** The audio, made with the first message; null where the browser has none. */
  private audio(): { context: AudioContext; filter: BiquadFilterNode; out: GainNode } | null {
    if (!this.context) {
      if (typeof AudioContext === 'undefined') return null;
      this.context = new AudioContext();
      this.out = this.context.createGain();
      this.out.gain.value = 0.5;
      this.filter = this.context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2400;
      this.filter.connect(this.out).connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return { context: this.context, filter: this.filter!, out: this.out! };
  }

  private hertz(note: number, channel: number): number {
    return 440 * 2 ** ((note - 69 + (this.bend.get(channel) ?? 0)) / 12);
  }

  play(data: ArrayLike<number>): void {
    const m = readChannelMessage(data);
    const audio = m && this.audio();
    if (!m || !audio) return;
    const { context, filter, out } = audio;
    const now = context.currentTime;
    switch (m.type) {
      case 'note_on':
        if (m.velocity === 0) return this.release(m.channel, m.note);
        if (m.channel === 9) return this.drum(m.note, m.velocity / 127, context, out);
        this.stop(`${m.channel}:${m.note}`, now);
        {
          const gain = context.createGain();
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.22 * (m.velocity / 127), now + 0.008);
          gain.connect(filter);
          const oscillators = [-6, 6].map((cents) => {
            const o = context.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = this.hertz(m.note, m.channel);
            o.detune.value = cents;
            o.connect(gain);
            o.start(now);
            return o;
          });
          this.voices.set(`${m.channel}:${m.note}`, { oscillators, gain, held: false });
        }
        return;
      case 'note_off':
        return this.release(m.channel, m.note);
      case 'pitch_bend':
        this.bend.set(m.channel, ((m.bend - 8192) / 8192) * 2);
        for (const [id, v] of this.voices)
          if (id.startsWith(`${m.channel}:`)) for (const o of v.oscillators) o.frequency.setTargetAtTime(this.hertz(Number(id.split(':')[1]), m.channel), now, 0.005);
        return;
      case 'control_change':
        if (m.code === 7) out.gain.setTargetAtTime((m.value / 127) * 0.7, now, 0.01);
        if (m.code === 74) filter.frequency.setTargetAtTime(200 * 2 ** ((m.value / 127) * 6), now, 0.01);
        if (m.code === 64) {
          if (m.value >= 64) this.pedal.add(m.channel);
          else {
            this.pedal.delete(m.channel);
            for (const [id, v] of this.voices) if (v.held && id.startsWith(`${m.channel}:`)) this.stop(id, now);
          }
        }
        if (m.code === 123 || m.code === 120) for (const id of [...this.voices.keys()]) if (id.startsWith(`${m.channel}:`)) this.stop(id, now);
        return;
      default:
        return;
    }
  }

  private release(channel: number, note: number): void {
    const id = `${channel}:${note}`;
    const voice = this.voices.get(id);
    if (!voice || !this.context) return;
    if (this.pedal.has(channel)) voice.held = true;
    else this.stop(id, this.context.currentTime);
  }

  private stop(id: string, now: number): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.04);
    for (const o of voice.oscillators) o.stop(now + 0.3);
  }

  /** A drum: a kick is a falling sine, a snare and a hat are noise, the hat short and thin. */
  private drum(note: number, level: number, context: AudioContext, out: GainNode): void {
    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(out);
    if (KICKS.includes(note)) {
      const o = context.createOscillator();
      o.frequency.setValueAtTime(150, now);
      o.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      gain.gain.setValueAtTime(0.9 * level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      o.connect(gain);
      o.start(now);
      o.stop(now + 0.32);
      return;
    }
    const snare = SNARES.includes(note);
    const length = snare ? 0.18 : note === 46 ? 0.25 : 0.05;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    const tone = context.createBiquadFilter();
    tone.type = snare ? 'bandpass' : 'highpass';
    tone.frequency.value = snare ? 1800 : 7000;
    gain.gain.setValueAtTime((snare ? 0.6 : 0.3) * level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    noise.connect(tone).connect(gain);
    noise.start(now);
  }
}
