// Lifted from yggi/cell-studio src/midi/access.test.ts @ 85175ce (lifted there from yggi/jambot
// apps/web/src/midi/access.test.ts @ 8cdb6b8): its seven tests of the adapter, only their imports changed (the fake
// ports from core's fixtures, the parser's own tests in core's surfaces.test.ts). New tests follow them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeAccess, fakeInput, fakePort } from '../core/fixtures';
import type { PortAccess } from '../core/port';
import type { ParsedNote } from '../core/surfaces';
import { hasWebMidi, MidiAccess, readEnvironment, requestAccess } from './access';
import { installMidi, uninstallMidi } from './fixtures';

afterEach(uninstallMidi);

const connected = async (on: Parameters<typeof MidiAccess.connect>[0] = {}) => {
  const midi = await MidiAccess.connect(on);
  if (typeof midi === 'string') throw new Error(midi);
  return midi;
};

describe('MidiAccess', () => {
  it('says in words that there is no Web MIDI, when the browser has none', async () => {
    expect(await MidiAccess.connect()).toContain('no Web MIDI');
  });

  it('says a blocked request is blocked, rather than throwing', async () => {
    installMidi(new DOMException('nope', 'SecurityError'));
    expect(await MidiAccess.connect()).toMatch(/^MIDI access was blocked here \(SecurityError\)/);
  });

  it('lists the ports Web MIDI gives, and finds an output by id', async () => {
    const out = fakePort('out-1', 'Synth');
    installMidi(fakeAccess([fakeInput('in-1', 'Keys')], [out]));
    const midi = await connected();
    expect(midi.inputs).toEqual([{ id: 'in-1', name: 'Keys' }]);
    expect(midi.outputs).toEqual([{ id: 'out-1', name: 'Synth' }]);
    expect(midi.outputPort('out-1')).toBe(out);
    expect(midi.outputPort('missing')).toBeNull();
  });

  it('lets go on close: no input is listened to, and a change of ports is no longer heard', async () => {
    const keys = fakeInput('in-1', 'Keys');
    const access = fakeAccess([keys]);
    installMidi(access);
    let changes = 0;
    const midi = await connected({ onChange: () => changes++ });
    midi.listen('all');
    midi.close();
    expect(keys.onmidimessage).toBeNull();
    access.change();
    expect(changes).toBe(0);
  });

  it('delivers notes only from the input listened to, or from all of them', async () => {
    const keys = fakeInput('in-1', 'Keys');
    const pads = fakeInput('in-2', 'Pads');
    installMidi(fakeAccess([keys, pads]));
    const notes: [number, string][] = [];
    const midi = await connected({ onNote: (n, source) => notes.push([n.note, source]) });
    expect(keys.onmidimessage).toBeNull(); // nothing is listened to yet

    midi.listen('in-1');
    keys.play([0x90, 60, 100]);
    pads.play([0x90, 36, 100]);
    expect(notes).toEqual([[60, 'Keys']]);

    midi.listen('all');
    pads.play([0x90, 36, 100]);
    expect(notes).toEqual([
      [60, 'Keys'],
      [36, 'Pads'],
    ]);

    midi.listen('none');
    expect(keys.onmidimessage).toBeNull();
    expect(pads.onmidimessage).toBeNull();
  });

  it('hands on every message raw (a CC too), and the time the port saw it', async () => {
    const keys = fakeInput('in-1', 'Keys');
    installMidi(fakeAccess([keys]));
    const raw: [number[], string, number][] = [];
    const notes: ParsedNote[] = [];
    const midi = await connected({ onMessage: (data, source, t) => raw.push([[...data], source, t]), onNote: (n) => notes.push(n) });
    midi.listen('all');
    keys.play([0xb0, 1, 64], 1000.5);
    keys.play([0x90, 60, 100], 1234.5);
    expect(raw).toEqual([
      [[0xb0, 1, 64], 'Keys', 1000.5],
      [[0x90, 60, 100], 'Keys', 1234.5],
    ]);
    expect(notes).toEqual([{ on: true, note: 60, velocity: 100, channel: 0, timeStamp: 1234.5 }]);
  });

  it('listens anew and says so when the ports change (a replugged port is a fresh object)', async () => {
    const keys = fakeInput('in-1', 'Keys');
    const access = fakeAccess([keys]);
    installMidi(access);
    let changes = 0;
    const midi = await connected({ onChange: () => changes++ });
    midi.listen('in-1');
    const again = fakeInput('in-1', 'Keys');
    access.inputs.set('in-1', again);
    access.change();
    expect(again.onmidimessage).not.toBeNull();
    expect(changes).toBe(1);
    midi.refresh();
    expect(changes).toBe(2);
  });
});

// New: what the merge with KO-Multitool's access adds, and what neither had a test for.
describe('MidiAccess, beyond the lifted tests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a connection as core adopts ports from (PortAccess)', async () => {
    installMidi(fakeAccess());
    const access: PortAccess = await connected();
    expect(access.inputs).toEqual([]);
  });

  it('lists no port the browser keeps marked disconnected', async () => {
    const gone = { ...fakeInput('in-2', 'Pads'), state: 'disconnected' };
    installMidi(fakeAccess([fakeInput('in-1', 'Keys'), gone]));
    expect((await connected()).inputs).toEqual([{ id: 'in-1', name: 'Keys' }]);
  });

  it('asks for SysEx only when asked to, and hands on the browser’s own connection', async () => {
    const access = fakeAccess();
    const asked: unknown[] = [];
    navigator.requestMIDIAccess = (options) => (asked.push(options), Promise.resolve(access as unknown as MIDIAccess));
    const midi = await MidiAccess.connect({}, { sysex: true });
    await MidiAccess.connect();
    expect(asked).toEqual([{ sysex: true }, { sysex: false }]);
    expect(typeof midi !== 'string' && midi.access).toBe(access);
  });

  it('is granted when the browser says so, and when it can’t say; not when denied or still to be asked', async () => {
    const asked: unknown[] = [];
    const answer = (state: string) => vi.stubGlobal('navigator', { permissions: { query: async (d: unknown) => (asked.push(d), { state }) } });
    answer('granted');
    expect(await MidiAccess.granted({ sysex: true })).toBe(true);
    expect(asked).toEqual([{ name: 'midi', sysex: true }]);
    for (const state of ['denied', 'prompt']) (answer(state), expect(await MidiAccess.granted(), state).toBe(false));
    vi.stubGlobal('navigator', {});
    expect(await MidiAccess.granted()).toBe(true);
  });

  it('is granted, as before, when the query never answers: after about a second', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('navigator', { permissions: { query: () => new Promise(() => {}) } });
      const granted = MidiAccess.granted();
      await vi.advanceTimersByTimeAsync(1000);
      expect(await granted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('requestAccess and the environment', () => {
  afterEach(() => (uninstallMidi(), vi.unstubAllGlobals()));

  it('throws where there is no Web MIDI, and asks for SysEx as told', async () => {
    expect(hasWebMidi()).toBe(false);
    await expect(requestAccess(true)).rejects.toThrow('no Web MIDI');
    const access = fakeAccess();
    installMidi(access);
    expect(hasWebMidi()).toBe(true);
    expect(await requestAccess(true)).toBe(access);
  });

  it('reads where the page runs: a secure context, Web MIDI, a standalone app, the origin', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(display-mode: standalone)' }));
    vi.stubGlobal('location', { origin: 'https://yggi.github.io', protocol: 'https:' });
    vi.stubGlobal('navigator', { userAgent: 'Chrome/140', language: 'de', serviceWorker: {}, requestMIDIAccess: () => {} });
    expect(readEnvironment()).toEqual({
      secureContext: true,
      hasWebMidi: true,
      standalone: true,
      userAgent: 'Chrome/140',
      language: 'de',
      origin: 'https://yggi.github.io',
      protocol: 'https:',
      serviceWorker: true,
    });
    vi.stubGlobal('isSecureContext', undefined);
    vi.stubGlobal('matchMedia', undefined);
    vi.stubGlobal('location', { origin: 'null', protocol: 'file:' });
    vi.stubGlobal('navigator', { userAgent: 'Firefox', language: 'en' });
    expect(readEnvironment()).toMatchObject({ secureContext: false, hasWebMidi: false, standalone: false, origin: 'null', serviceWorker: false });
  });
});
