/**
 * A panel being played (decision 005): the controls' values, what a touch sends, what a message received moves. Pure:
 * a widget says what the person did (`press`, `move`, `lift`, `strike`, `unstrike`), a frontend hands over each
 * message the panel's column is sent (`receive`), and what comes back is bytes for the panel's row of the patch, which
 * the frontend sends where the row's crossings say (`forwardsOf`), with its own timestamp.
 *
 * - A binding sends only when the number on the wire changes: a slow drag across one step sends once.
 * - What is received is not sent back, and a control being held is not moved by what arrives.
 * - A note bound to a control is on while the control's value is above 0; `silence` releases everything sounding.
 */
import { controlChange14, parameterMessages, ParameterReader, readChannelMessage, writeChannelMessage } from '../messages';
import { instantiate, type BoundMessage, type ControlInstance, type PanelInstance } from './instantiate';
import type { Panel } from './model';

/** A control's values, each 0 … 1; `y` is an `xy`'s second. */
export interface ControlValue {
  readonly x: number;
  readonly y: number;
}

interface Bound {
  readonly control: ControlInstance;
  readonly binding: BoundMessage;
  /** `${key}#${index}`: what was last on the wire for it is kept by this. */
  readonly id: string;
  /** A 14-bit controller's fine half. */
  readonly fine?: boolean;
}

const unit = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export class PanelRuntime {
  /** The panel as it was given: a rack keeps a runtime while this is the same. */
  readonly source: Panel;
  readonly panel: PanelInstance;
  private readonly byKey = new Map<string, ControlInstance>();
  private readonly values = new Map<string, ControlValue>();
  /** By binding: the last number on the wire, sent or received (a note's: its velocity, 0 when off). */
  private readonly wire = new Map<string, number>();
  private readonly held = new Set<string>();
  /** By what a message is (`cc:0:7`), the bindings that read it. */
  private readonly readers = new Map<string, Bound[]>();
  private readonly parameters = new ParameterReader();
  /** A keyboard's and a pads' notes sounding, as `key:note`. */
  private readonly struck = new Set<string>();
  private readonly watchers = new Set<() => void>();

  /**
   * Told whenever a control's value changes, by a touch or by what was received: a view that draws a runtime it
   * doesn't own (the panel plays on while the view is away). Returns how to stop being told.
   */
  watch(changed: () => void): () => void {
    this.watchers.add(changed);
    return () => void this.watchers.delete(changed);
  }
  private tell(): void {
    for (const w of [...this.watchers]) w();
  }

  constructor(panel: Panel) {
    this.source = panel;
    this.panel = instantiate(panel);
    for (const control of this.panel.controls) {
      this.byKey.set(control.key, control);
      this.values.set(control.key, { x: control.value, y: control.value });
      control.bindings.forEach((binding, i) => {
        const { kind, channel, number } = binding;
        const at = (what: string, fine?: boolean) => {
          const list = this.readers.get(what) ?? [];
          list.push({ control, binding, id: `${control.key}#${i}`, ...(fine ? { fine } : {}) });
          this.readers.set(what, list);
        };
        if (kind === 'cc' || kind === 'cc14') at(`cc:${channel}:${number}`);
        if (kind === 'cc14') at(`cc:${channel}:${number + 32}`, true);
        if (kind === 'note' || kind === 'nrpn' || kind === 'rpn') at(`${kind}:${channel}:${number}`);
        if (kind === 'program' || kind === 'bend' || kind === 'pressure') at(`${kind}:${channel}`);
      });
    }
  }

  /** A control's values now; a key the panel has none for reads 0. */
  value(key: string): ControlValue {
    return this.values.get(key) ?? { x: 0, y: 0 };
  }

  /** The person's finger is on it: nothing received moves it until `lift`. */
  press(key: string): void {
    if (this.byKey.has(key)) this.held.add(key);
  }

  lift(key: string): void {
    this.held.delete(key);
  }

  /** The person set it (each value held to 0 … 1; one left out stays): the messages that sends. */
  move(key: string, to: Partial<ControlValue>): number[][] {
    const control = this.byKey.get(key);
    if (!control) return [];
    const was = this.value(key);
    const value = { x: to.x === undefined ? was.x : unit(to.x), y: to.y === undefined ? was.y : unit(to.y) };
    this.values.set(key, value);
    const sent = control.bindings.flatMap((binding, i) => this.send(binding, `${key}#${i}`, value[binding.axis]));
    this.tell();
    return sent;
  }

  /** What a binding sends for a value, when it is not what is already on the wire. */
  private send(b: BoundMessage, id: string, x: number): number[][] {
    const v = Math.round(b.lo + x * (b.hi - b.lo));
    const last = this.wire.get(id);
    if (b.kind === 'note') {
      const on = x > 0;
      if (on === (last ?? 0) > 0) return [];
      this.wire.set(id, on ? Math.max(1, v) : 0);
      return [
        writeChannelMessage(
          on ? { type: 'note_on', channel: b.channel, note: b.number, velocity: Math.max(1, v) } : { type: 'note_off', channel: b.channel, note: b.number, velocity: 0 },
        ),
      ];
    }
    if (v === last) return [];
    this.wire.set(id, v);
    switch (b.kind) {
      case 'cc':
        return [writeChannelMessage({ type: 'control_change', channel: b.channel, code: b.number, value: v })];
      case 'cc14':
        return controlChange14(b.channel, b.number, v);
      case 'program':
        return [writeChannelMessage({ type: 'program_change', channel: b.channel, program: v })];
      case 'bend':
        return [writeChannelMessage({ type: 'pitch_bend', channel: b.channel, bend: v })];
      case 'pressure':
        return [writeChannelMessage({ type: 'channel_aftertouch', channel: b.channel, pressure: v })];
      default:
        return parameterMessages({ type: b.kind, channel: b.channel, parameter: b.number, value: v });
    }
  }

  /**
   * A message the panel's column was sent: the keys of the controls it moved, for a view to redraw. Each binding that
   * speaks this message takes its value, and none of it is sent back; a control being held is left where it is.
   */
  receive(data: ArrayLike<number>): string[] {
    const m = readChannelMessage(data);
    if (!m) return [];
    const moved = new Set<string>();
    const take = (what: string, value: (r: Bound) => number, note = false) => {
      for (const r of this.readers.get(what) ?? []) {
        if (this.held.has(r.control.key)) continue;
        const v = value(r);
        const { lo, hi, axis } = r.binding;
        this.wire.set(r.id, v);
        const x = note ? (v > 0 ? unit((v - lo) / (hi - lo)) || 1 : 0) : hi === lo ? 0 : unit((v - lo) / (hi - lo));
        this.values.set(r.control.key, { ...this.value(r.control.key), [axis]: x });
        moved.add(r.control.key);
      }
    };
    const { channel } = m;
    switch (m.type) {
      case 'control_change': {
        // (a 14-bit controller: the coarse half is the value with its fine half 0, the fine half completes it)
        take(`cc:${channel}:${m.code}`, (r) => (r.binding.kind === 'cc' ? m.value : r.fine ? ((this.wire.get(r.id) ?? 0) & ~0x7f) | m.value : m.value << 7));
        const p = this.parameters.read(m);
        if (p) take(`${p.type}:${channel}:${p.parameter}`, () => p.value);
        break;
      }
      case 'note_on':
        take(`note:${channel}:${m.note}`, () => m.velocity, true);
        break;
      case 'note_off':
        take(`note:${channel}:${m.note}`, () => 0, true);
        break;
      case 'program_change':
        take(`program:${channel}`, () => m.program);
        break;
      case 'pitch_bend':
        take(`bend:${channel}`, () => m.bend);
        break;
      case 'channel_aftertouch':
        take(`pressure:${channel}`, () => m.pressure);
        break;
    }
    if (moved.size) this.tell();
    return [...moved];
  }

  /** A key of a `keyboard` or a pad of a `pads` struck: its note-on, once until it is released; nothing for a note it hasn't. */
  strike(key: string, note: number, velocity = 100): number[][] {
    const control = this.byKey.get(key);
    const id = `${key}:${note}`;
    if (!control?.notes.includes(note) || this.struck.has(id)) return [];
    this.struck.add(id);
    return [writeChannelMessage({ type: 'note_on', channel: control.channel, note, velocity: Math.max(1, velocity) })];
  }

  unstrike(key: string, note: number): number[][] {
    const control = this.byKey.get(key);
    if (!control || !this.struck.delete(`${key}:${note}`)) return [];
    return [writeChannelMessage({ type: 'note_off', channel: control.channel, note, velocity: 0 })];
  }

  /**
   * Everything sounding released: each note struck, and each note a control holds on (its control back at 0), for a
   * view that closes, so no note hangs. Nothing is held after it.
   */
  silence(): number[][] {
    const out: number[][] = [];
    for (const id of [...this.struck]) {
      const cut = id.lastIndexOf(':');
      out.push(...this.unstrike(id.slice(0, cut), Number(id.slice(cut + 1))));
    }
    for (const control of this.panel.controls)
      control.bindings.forEach((b, i) => {
        if (b.kind !== 'note' || !((this.wire.get(`${control.key}#${i}`) ?? 0) > 0)) return;
        this.values.set(control.key, { ...this.value(control.key), [b.axis]: 0 });
        out.push(...this.send(b, `${control.key}#${i}`, 0));
      });
    this.held.clear();
    if (out.length) this.tell();
    return out;
  }
}
