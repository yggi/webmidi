// Lifted from yggi/cell-studio src/midi/access.ts @ 85175ce (MidiAccess and MidiHandlers; lifted there from yggi/jambot
// apps/web/src/midi/access.ts @ 8cdb6b8; its MidiPort and PortOption are core's, port.ts), with yggi/KO-Multitool
// src/lib/transport/midi.ts @ 8b4b49e (requestAccess, readEnvironment): SysEx asked for, and what the page can tell
// about where it runs. One place asks for Web MIDI, `requestAccess`; `MidiAccess.connect` is it in words.

import type { MidiPort, PortAccess, PortOption } from '../core/port';
import { type ParsedNote, parseMidiMessage } from '../core/surfaces';

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

/** A port's entries, in the order the device gives them (a browser may keep an unplugged port listed, marked disconnected: not an entry). */
const portOptions = (ports: ReadonlyMap<string, { readonly name: string | null; readonly state?: string }>): PortOption[] =>
  [...ports].filter(([, port]) => port.state !== 'disconnected').map(([id, port]) => ({ id, name: port.name ?? 'MIDI' }));

/** How long the permission query may take before it is taken as unanswered (ms). */
const ASK_FOR = 1000;

/** Whether this host has Web MIDI to ask for. */
export const hasWebMidi = (): boolean => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

/** Ask for Web MIDI, SysEx too or not: the browser's `MIDIAccess`, or a throw (no Web MIDI here, or access refused). */
export async function requestAccess(sysex: boolean): Promise<MIDIAccess> {
  if (!hasWebMidi()) throw new Error('This browser has no Web MIDI API.');
  return navigator.requestMIDIAccess({ sysex });
}

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

export function readEnvironment(): MidiEnvironment {
  const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  return {
    secureContext: typeof isSecureContext === 'boolean' ? isSecureContext : false,
    hasWebMidi: hasWebMidi(),
    standalone,
    userAgent: navigator.userAgent,
    language: navigator.language,
    origin: location.origin,
    protocol: location.protocol,
    serviceWorker: 'serviceWorker' in navigator,
  };
}

/** A live Web MIDI connection: the ports plugged in, and which input is listened to. */
export class MidiAccess implements PortAccess {
  #access: MIDIAccess;
  #on: MidiHandlers;
  #listening = 'none';

  private constructor(access: MIDIAccess, on: MidiHandlers) {
    this.#access = access;
    this.#on = on;
    access.onstatechange = () => this.refresh();
  }

  /**
   * Whether Web MIDI (SysEx too, if asked) may be asked for without a prompt (the browser says it is granted), so a page
   * load can reconnect quietly. Denied, or still to be asked: no. A browser that can't say: yes, as it was before.
   */
  static async granted({ sysex = false }: MidiRequest = {}): Promise<boolean> {
    try {
      // (a query that never answers is not a reason to wait: about a second, then as it was before)
      const status = await Promise.race([
        navigator.permissions.query({ name: 'midi', sysex } as unknown as PermissionDescriptor),
        new Promise<null>((resolve) => setTimeout(resolve, ASK_FOR)),
      ]);
      return status === null || status.state === 'granted';
    } catch {
      return true;
    }
  }

  /** Ask for Web MIDI. The connection, or in words why there is none: no Web MIDI here, or access blocked. Never throws. */
  static async connect(on: MidiHandlers = {}, { sysex = false }: MidiRequest = {}): Promise<MidiAccess | string> {
    if (!hasWebMidi()) return 'This browser has no Web MIDI. Chrome and Edge on desktop or Android have it.';
    try {
      return new MidiAccess(await requestAccess(sysex), on);
    } catch (err) {
      const name = err instanceof Error ? err.name : 'error';
      return `MIDI access was blocked here (${name}). Allow MIDI for this site, or open the page in its own tab.`;
    }
  }

  get inputs(): PortOption[] {
    return portOptions(this.#access.inputs);
  }

  get outputs(): PortOption[] {
    return portOptions(this.#access.outputs);
  }

  outputPort(id: string): MidiPort | null {
    return this.#access.outputs.get(id) ?? null;
  }

  /** The browser's own connection, for what this one doesn't wrap: the ports' details (`listPorts`), a SysEx transport. */
  get access(): MIDIAccess {
    return this.#access;
  }

  /** Look at the ports again: listen anew (a port plugged in again is a fresh object), and say they may have changed. */
  refresh(): void {
    this.listen(this.#listening);
    this.#on.onChange?.();
  }

  /** Let go: no input is listened to and the ports' changes are no longer heard. */
  close(): void {
    this.listen('none');
    this.#access.onstatechange = null;
  }

  /** Listen to one input by id, `'all'` of them, or `'none'`. */
  listen(id: string): void {
    this.#listening = id;
    for (const [portId, input] of this.#access.inputs)
      input.onmidimessage =
        id === 'all' || id === portId
          ? (event) => {
              const data = event.data;
              if (!data) return;
              const source = input.name ?? 'MIDI';
              this.#on.onMessage?.(data, source, event.timeStamp);
              const note = parseMidiMessage(data, event.timeStamp);
              if (note) this.#on.onNote?.(note, source);
            }
          : null;
  }
}
