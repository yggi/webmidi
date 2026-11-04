// A frontend's MIDI store from before the book, as a book (docs/proposals/patchbay.md, decision 002): run once, on a
// first load with nothing kept (`loadBook`'s `first`). Each takes the frontend's store as its own load reads it.
// Cell studio's: yggi/cell-studio src/ui/state/midi.svelte.ts @ 55c6a93 (`Stored`, under `cell-studio:midi`).
// Jambot's: yggi/jambot apps/web/src/midi/settings.svelte.ts @ 7113d55 (`StoredPrefs`, under `jambot-midi-v1`).

import type { PortOption } from './port';
import { DEFAULT_PROFILE, inputRow, ANY_INPUT, readProfile, type DeviceProfile, type Routes, type Setup, type SetupBook, type SetupOutput } from './setups';

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const portOf = (v: unknown): PortOption | null => (isRecord(v) && typeof v.id === 'string' && v.id && typeof v.name === 'string' ? { id: v.id, name: v.name } : null);
const record = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

/** What a frontend chose to hear: none, all, or one input. */
const heardOf = (p: PortOption | null): readonly PortOption[] | 'all' => (!p || p.id === 'none' ? [] : p.id === 'all' ? 'all' : [p]);

const book = (setup: Setup, devices: Record<string, DeviceProfile>, defaults: DeviceProfile): SetupBook => ({
  version: 1,
  devices,
  defaults,
  setups: [setup],
  active: setup.id,
});

/**
 * Cell studio's store as a book of one setup, "Cell studio": its outputs and input; each piece's matrix as the context
 * `piece:<title>` (a channel 0, not sent there, dropped: 0 is `AS_PLAYED` in the book); each device's drum map, clock,
 * bend range and rotation as its profile, and the ranges a device with none of its own took as the defaults.
 * The built-in sound (`internal`) stays Cell studio's.
 */
export function fromCellStudio(stored: unknown): SetupBook {
  const s = record(stored);
  const outputs: SetupOutput[] = [];
  if (Array.isArray(s.outputs))
    for (const o of s.outputs) {
      const p = portOf(o);
      if (p && isRecord(o) && typeof o.key === 'string' && o.key && !outputs.some((c) => c.key === o.key)) outputs.push({ key: o.key, ...p });
    }
  if (!outputs.length) outputs.push({ key: 'o1', id: 'none', name: '' });

  const routes: Record<string, Routes> = {};
  for (const [title, byOutput] of Object.entries(record(s.routes))) {
    const rows: Record<string, Record<string, number>> = {};
    for (const [key, byRow] of Object.entries(record(byOutput))) for (const [row, ch] of Object.entries(record(byRow))) if (isInt(ch, 1, 16)) (rows[row] ??= {})[key] = ch;
    if (Object.keys(rows).length) routes[`piece:${title}`] = rows;
  }

  const defaults = readProfile({ bend: s.bendRange, mpe: s.rotate ?? null }, DEFAULT_PROFILE);
  const [drums, bends, rotates, clock] = [record(s.drums), record(s.bends), record(s.rotates), record(s.clock)];
  const names = new Set([...Object.keys(drums), ...Object.keys(bends), ...Object.keys(rotates), ...Object.keys(clock)]);
  const devices: Record<string, DeviceProfile> = {};
  for (const name of names) {
    const kept: Record<string, unknown> = {};
    if (Object.hasOwn(drums, name)) kept.drums = drums[name];
    if (Object.hasOwn(bends, name)) kept.bend = bends[name];
    if (Object.hasOwn(rotates, name)) kept.mpe = rotates[name] ?? null;
    if (Object.hasOwn(clock, name)) kept.clock = clock[name];
    devices[name] = readProfile(kept, defaults);
  }

  return book({ id: 's1', name: 'Cell studio', outputs, heard: heardOf(portOf(s.in)), routes }, devices, defaults);
}

/** The row of what is played on Jambot's own keys (on screen and the computer's), which its thru passed on too. */
export const KEYS = 'keys';

/** Jambot's parts, as its store keys their channels. */
const PARTS = ['lead', 'bass', 'pad', 'stab', 'drums'] as const;

/**
 * Jambot's store as a book of one setup, "Jambot": its one output; the context `band`, each part a row on that output
 * at its channel; thru on, as the keys' row (`KEYS`) and the heard input's row (every input's, `ANY_INPUT`, when it
 * heard all), each sent there on the thru channel; the drum map and the clock as the output device's profile. Jambot keeps its ports by id alone, so
 * `ports` (the ports plugged in now) gives their names; a device whose name isn't found keeps its map and clock as the
 * defaults, for whichever device is chosen next. The built-in synth (`internal`) stays Jambot's.
 */
export function fromJambot(stored: unknown, ports: { readonly inputs: readonly PortOption[]; readonly outputs: readonly PortOption[] }): SetupBook {
  const s = record(stored);
  const id = (v: unknown) => (typeof v === 'string' && v ? v : 'none');
  const named = (list: readonly PortOption[], portId: string): PortOption => ({ id: portId, name: list.find((p) => p.id === portId)?.name ?? '' });
  const out = named(ports.outputs, id(s.outPortId));
  const inPort = id(s.inPortId);
  const heard = heardOf(inPort === 'none' || inPort === 'all' ? { id: inPort, name: '' } : named(ports.inputs, inPort));

  const band: Record<string, Record<string, number>> = {};
  const channels = record(s.channels);
  for (const part of PARTS) if (isInt(channels[part], 1, 16)) band[part] = { o1: channels[part] };
  if (s.thru === true && isInt(s.thruChannel, 1, 16)) {
    band[KEYS] = { o1: s.thruChannel };
    if (heard === 'all') band[ANY_INPUT] = { o1: s.thruChannel };
    else if (heard.length) band[inputRow(heard[0]!)] = { o1: s.thruChannel };
  }

  const profile = readProfile({ drums: s.drumMap, clock: s.clock }, DEFAULT_PROFILE);
  const known = out.id !== 'none' && !!out.name;
  return book({ id: 's1', name: 'Jambot', outputs: [{ key: 'o1', ...out }], heard, routes: { band } }, known ? { [out.name]: profile } : {}, known ? DEFAULT_PROFILE : profile);
}
