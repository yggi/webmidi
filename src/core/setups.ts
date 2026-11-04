// The model behind the patchbay (docs/proposals/patchbay.md, decision 002): device profiles, named setups and the book
// that keeps them. Pure: a frontend stores the book through a `BookStore` (web's `localBookStore`, or its own).
// Adapted from yggi/cell-studio src/ui/state/midi.svelte.ts @ 55c6a93 (its store's readers: `chosen`, `own`, `numbers`,
// `nested`, `rangeOf`, `outputsOf`), generalized from one setup to many.

import type { DrumMap } from './drum-presets';
import type { PortOption } from './port';

/** The channels notes rotate over on a device (MPE-style, for microtonal pieces), first to last, 1–16. */
export interface MpeRange {
  readonly from: number;
  readonly to: number;
}

/**
 * What is true of a device, kept by its port's name and shared by every setup (decision 002): a Circuit's drum map is
 * set once, wherever it is plugged in.
 */
export interface DeviceProfile {
  /** Whether it is sent MIDI clock (24 ticks a beat, Start, Stop, Continue). */
  readonly clock: boolean;
  /** General MIDI drum note to the note it sends (`drum-presets.ts`). */
  readonly drums: DrumMap;
  /** Its pitch-bend range, in semitones each way, 1–96. */
  readonly bend: number;
  /** The channels its notes rotate over, or null: each row on its own channel. */
  readonly mpe: MpeRange | null;
  /** How much earlier it is sent, in ms, 0–1000: its own latency, measured (yggi/jambot#472). */
  readonly latency: number;
}

/** An output of a setup: the device it sends to (by id and name, as `ChosenPorts` keeps them), under a key its routes are kept by. */
export interface SetupOutput {
  readonly key: string;
  readonly id: string;
  readonly name: string;
}

/**
 * What a crossing sends, from a row to an output: a channel 1–16, or `AS_PLAYED` (0), an input's message on the channel
 * it came in on. A crossing that is absent sends nothing.
 */
export type Crossing = number;

/** An input row's crossing that keeps the channel a message came in on. */
export const AS_PLAYED = 0;

/** A context's routes: a row's id to its crossings, by output key. */
export type Routes = Readonly<Record<string, Readonly<Record<string, Crossing>>>>;

/**
 * A named setup: the outputs in order, the inputs the frontend hears, and the routes of each context it names. A change
 * to a named setup is kept as its custom variant (`base`), saved at once, until the person overwrites the named setup
 * with it, saves it under a new name, or discards it (decision 002).
 */
export interface Setup {
  readonly id: string;
  readonly name: string;
  /** A custom variant's: the id of the named setup it was changed from. A named setup has none. */
  readonly base?: string;
  /** At least one; an output with id `'none'` is a slot with no device. */
  readonly outputs: readonly SetupOutput[];
  /** The inputs the frontend listens to (its keys, MIDI learn, the Muse), or `'all'`. Routing an input is its row's. */
  readonly heard: readonly PortOption[] | 'all';
  /**
   * By context, a name the frontend chooses (`piece:<title>` in Cell studio, `band` in Jambot, `bay` standalone): its
   * routes. Rows are the frontend's, and the inputs' (`inputRow`).
   */
  readonly routes: Readonly<Record<string, Routes>>;
}

/** Everything kept: the device profiles, the setups (at least one) and which is in use. */
export interface SetupBook {
  readonly version: 1;
  readonly devices: Readonly<Record<string, DeviceProfile>>;
  /** The profile of a device with none of its own. */
  readonly defaults: DeviceProfile;
  readonly setups: readonly Setup[];
  readonly active: string;
}

/** Where a book is kept: a frontend's storage (web's `localBookStore`), or memory in a test. */
export interface BookStore {
  /** What was kept, as it was parsed: anything, since it is read with `readBook`; null for nothing. */
  load(): unknown;
  save(book: SetupBook): void;
}

/** The row of an input, by its port's name (its id when it has none); `ANY_INPUT` is every input the frontend hears. */
export const inputRow = (port: PortOption): string => `in:${port.name || port.id}`;
export const ANY_INPUT = 'in:*';

export const DEFAULT_PROFILE: DeviceProfile = { clock: false, drums: {}, bend: 2, mpe: null, latency: 0 };

const NO_DEVICE: PortOption = { id: 'none', name: '' };

/** What a custom variant is called after its named setup: "Home - custom". */
export const CUSTOM = ' - custom';

/** A book with one setup, one output and no device: a first visit. */
export function newBook(): SetupBook {
  return { version: 1, devices: {}, defaults: DEFAULT_PROFILE, setups: [blankSetup('s1', 'Setup 1')], active: 's1' };
}

const blankSetup = (id: string, name: string): Setup => ({ id, name, outputs: [{ key: 'o1', ...NO_DEVICE }], heard: [], routes: {} });

// ---- reading what was kept: anything, junk dropped field by field ----

/** A value kept under a key of its own: a device named `__proto__` has none (not the object's). */
const own = <T>(o: Readonly<Record<string, T>>, key: string): T | undefined => (Object.hasOwn(o, key) ? o[key] : undefined);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
/** A number typed into a field, rounded into lo … hi (not a number: `fallback`). */
const clamped = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback);

const port = (v: unknown): PortOption | null => (isRecord(v) && typeof v.id === 'string' && v.id && typeof v.name === 'string' ? { id: v.id, name: v.name } : null);

function drumMap(v: unknown): DrumMap {
  const map: Record<number, number> = {};
  if (isRecord(v)) for (const [k, n] of Object.entries(v)) if (isInt(Number(k), 0, 127) && k.trim() !== '' && isInt(n, 0, 127)) map[Number(k)] = n;
  return map;
}

const mpe = (v: unknown): MpeRange | null => (isRecord(v) && isInt(v.from, 1, 16) && isInt(v.to, 1, 16) ? { from: v.from, to: v.to } : null);

/** A profile kept, each field checked on its own, the rest from `base`. */
export function readProfile(v: unknown, base: DeviceProfile = DEFAULT_PROFILE): DeviceProfile {
  if (!isRecord(v)) return base;
  return {
    clock: typeof v.clock === 'boolean' ? v.clock : base.clock,
    drums: isRecord(v.drums) ? drumMap(v.drums) : base.drums,
    bend: isInt(v.bend, 1, 96) ? v.bend : base.bend,
    mpe: v.mpe === null ? null : (mpe(v.mpe) ?? base.mpe),
    latency: isInt(v.latency, 0, 1000) ? v.latency : base.latency,
  };
}

function routes(v: unknown): Routes {
  const out: Record<string, Record<string, Crossing>> = {};
  if (!isRecord(v)) return out;
  for (const [row, crossings] of Object.entries(v)) {
    if (!isRecord(crossings)) continue;
    const kept = Object.fromEntries(Object.entries(crossings).filter((e): e is [string, number] => isInt(e[1], 0, 16)));
    if (Object.keys(kept).length) out[row] = kept;
  }
  return out;
}

function readSetup(v: unknown): Setup | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !v.id) return null;
  const outputs: SetupOutput[] = [];
  if (Array.isArray(v.outputs))
    for (const o of v.outputs) {
      const p = port(o);
      if (p && isRecord(o) && typeof o.key === 'string' && o.key && !outputs.some((c) => c.key === o.key)) outputs.push({ key: o.key, ...p });
    }
  const heard = v.heard === 'all' ? 'all' : Array.isArray(v.heard) ? v.heard.map(port).filter((p): p is PortOption => !!p) : [];
  const contexts = isRecord(v.routes) ? Object.fromEntries(Object.entries(v.routes).map(([c, r]) => [c, routes(r)])) : {};
  return {
    id: v.id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name : v.id,
    ...(typeof v.base === 'string' && v.base ? { base: v.base } : {}),
    outputs: outputs.length ? outputs : [{ key: 'o1', ...NO_DEVICE }],
    heard,
    routes: contexts,
  };
}

/** A book from what was kept: anything; junk is dropped field by field, and nothing usable is a new book. */
export function readBook(v: unknown): SetupBook {
  if (!isRecord(v) || v.version !== 1) return newBook();
  const setups: Setup[] = [];
  if (Array.isArray(v.setups))
    for (const s of v.setups) {
      const setup = readSetup(s);
      if (setup && !setups.some((x) => x.id === setup.id)) setups.push(setup);
    }
  // a variant needs its named setup, and a named setup has one variant at most: else it is kept as a named setup
  const kept: Setup[] = [];
  for (const x of setups) {
    const named = setups.some((n) => n.id === x.base && n.base === undefined) && !kept.some((k) => k.base === x.base);
    kept.push(x.base === undefined || named ? x : unbased(x));
  }
  setups.splice(0, setups.length, ...kept);
  if (!setups.some((x) => x.base === undefined)) return newBook();
  const defaults = readProfile(v.defaults);
  const devices = isRecord(v.devices) ? Object.fromEntries(Object.entries(v.devices).map(([name, p]) => [name, readProfile(p, defaults)])) : {};
  const active = typeof v.active === 'string' && setups.some((s) => s.id === v.active) ? v.active : setups[0]!.id;
  return { version: 1, devices, defaults, setups, active };
}

/** The book kept in `store`, or, when nothing is kept, `first()` (a frontend's store from before, migrated), saved at once. */
export function loadBook(store: BookStore, first: () => SetupBook | null = () => null): SetupBook {
  const kept = store.load();
  if (kept !== null && kept !== undefined) return readBook(kept);
  const book = first() ?? newBook();
  store.save(book);
  return book;
}

/** A store in memory, for a test or a page that keeps nothing. */
export function memoryStore(initial: unknown = null): BookStore & { kept: unknown } {
  const store = {
    kept: initial,
    load: () => store.kept,
    save: (book: SetupBook) => {
      store.kept = JSON.parse(JSON.stringify(book)) as unknown;
    },
  };
  return store;
}

// ---- reading the book ----

/** The setup in use. */
export const activeSetup = (book: SetupBook): Setup => book.setups.find((s) => s.id === book.active) ?? book.setups[0]!;

/** A device's profile, by its port's name: its own, or the book's defaults. */
export const profileOf = (book: SetupBook, name: string): DeviceProfile => own(book.devices, name) ?? book.defaults;

/** What a crossing of the setup in use sends, or undefined: nothing. */
export const crossingOf = (book: SetupBook, context: string, row: string, output: string): Crossing | undefined => {
  const r = own(activeSetup(book).routes, context);
  const c = r && own(r, row);
  return c && own(c, output);
};

/** Whether an output's device is among the ports plugged in now: by id, or by name (an id changes on replug on some systems). */
const isPlugged = (o: PortOption, plugged: readonly PortOption[]) => plugged.some((p) => p.id === o.id || (!!o.name && p.name === o.name));

/** How many of a setup's devices are plugged in, of how many it has (slots with no device not counted). */
export function fit(setup: Setup, plugged: readonly PortOption[]): { plugged: number; of: number } {
  const devices = setup.outputs.filter((o) => o.id !== 'none');
  return { plugged: devices.filter((o) => isPlugged(o, plugged)).length, of: devices.length };
}

/**
 * The setup to suggest when the one in use misses a device: another whose every device is plugged in (the one with the
 * most devices first), or null: the one in use has all its own, or no other does.
 */
export function suggestSetup(book: SetupBook, plugged: readonly PortOption[]): Setup | null {
  const whole = (s: Setup) => {
    const f = fit(s, plugged);
    return f.of > 0 && f.plugged === f.of;
  };
  if (whole(activeSetup(book))) return null;
  const others = book.setups.filter((s) => s.id !== book.active && whole(s));
  return others.sort((a, b) => fit(b, plugged).of - fit(a, plugged).of)[0] ?? null;
}

// ---- changing the book: each a new book ----

/** A setup without its base: named. */
const unbased = ({ base: _base, ...setup }: Setup): Setup => setup;

/**
 * A change to the setup in use. A custom variant is changed in place; a named setup stays as it is, and the change is
 * kept as its custom variant, put in use (one it already had is replaced: a change starts from what was saved).
 */
function withActive(book: SetupBook, change: (s: Setup) => Setup): SetupBook {
  const active = activeSetup(book);
  const changed = change(active);
  if (changed === active) return book;
  if (active.base !== undefined) return { ...book, setups: book.setups.map((s) => (s.id === active.id ? changed : s)) };
  const old = book.setups.find((s) => s.base === active.id);
  const variant: Setup = { ...changed, id: old?.id ?? `${active.id}~`, name: active.name + CUSTOM, base: active.id };
  const setups = old ? book.setups.map((s) => (s === old ? variant : s)) : book.setups.flatMap((s) => (s === active ? [s, variant] : [s]));
  return { ...book, setups, active: variant.id };
}

/** The named setup the one in use is a custom variant of, or null: the one in use is as saved. */
export function changedFrom(book: SetupBook): Setup | null {
  const base = activeSetup(book).base;
  return base === undefined ? null : (book.setups.find((s) => s.id === base) ?? null);
}

/** The named setup overwritten with its custom variant in use, which goes; the book as it is when none is. */
export function overwrite(book: SetupBook): SetupBook {
  const variant = activeSetup(book);
  const base = changedFrom(book);
  if (!base) return book;
  const saved: Setup = { ...unbased(variant), id: base.id, name: base.name };
  return { ...book, setups: book.setups.filter((s) => s !== variant).map((s) => (s === base ? saved : s)), active: base.id };
}

/** The custom variant in use discarded, and its named setup put back in use. */
export function discard(book: SetupBook): SetupBook {
  const base = changedFrom(book);
  return base ? { ...book, setups: book.setups.filter((s) => s.id !== book.active), active: base.id } : book;
}

/** A device's profile changed (by its port's name), each value clamped to what it may be. */
export function withProfile(book: SetupBook, name: string, change: Partial<DeviceProfile>): SetupBook {
  const p = { ...profileOf(book, name), ...change };
  const range = p.mpe && { from: clamped(p.mpe.from, 1, 16, 2), to: clamped(p.mpe.to, 1, 16, 16) };
  const kept: DeviceProfile = { clock: p.clock, drums: drumMap(p.drums), bend: clamped(p.bend, 1, 96, 2), mpe: range, latency: clamped(p.latency, 0, 1000, 0) };
  return { ...book, devices: { ...book.devices, [name]: kept } };
}

/** A crossing of the setup in use set (a channel 1–16, or `AS_PLAYED`), or cleared (undefined, or out of range). */
export function withCrossing(book: SetupBook, context: string, row: string, output: string, value: Crossing | undefined): SetupBook {
  return withActive(book, (s) => {
    const r = own(s.routes, context) ?? {};
    const { [output]: _old, ...rest } = own(r, row) ?? {};
    const crossings = value !== undefined && isInt(value, 0, 16) ? { ...rest, [output]: value } : rest;
    const { [row]: _row, ...others } = r;
    const next = Object.keys(crossings).length ? { ...others, [row]: crossings } : others;
    return { ...s, routes: { ...s.routes, [context]: next } };
  });
}

/** An output added to the setup in use, under a key of its own: its key, and the book. */
export function addOutput(book: SetupBook, device: PortOption = NO_DEVICE): { book: SetupBook; key: string } {
  const outputs = activeSetup(book).outputs;
  let n = outputs.length + 1;
  while (outputs.some((o) => o.key === `o${n}`)) n++;
  const key = `o${n}`;
  return { book: withActive(book, (s) => ({ ...s, outputs: [...s.outputs, { key, id: device.id, name: device.name }] })), key };
}

/** An output given another device: its routes stay, under its key. */
export function chooseDevice(book: SetupBook, key: string, device: PortOption): SetupBook {
  return withActive(book, (s) => ({ ...s, outputs: s.outputs.map((o) => (o.key === key ? { key, id: device.id, name: device.name } : o)) }));
}

/** An output removed, with its crossings in every context; the last one stays. */
export function removeOutput(book: SetupBook, key: string): SetupBook {
  return withActive(book, (s) => {
    if (s.outputs.length < 2 || !s.outputs.some((o) => o.key === key)) return s;
    const strip = (r: Routes): Routes =>
      Object.fromEntries(
        Object.entries(r)
          .map(([row, c]) => [row, Object.fromEntries(Object.entries(c).filter(([k]) => k !== key))] as const)
          .filter(([, c]) => Object.keys(c).length),
      );
    return { ...s, outputs: s.outputs.filter((o) => o.key !== key), routes: Object.fromEntries(Object.entries(s.routes).map(([c, r]) => [c, strip(r)])) };
  });
}

/** The inputs the frontend hears, in the setup in use. */
export const withHeard = (book: SetupBook, heard: readonly PortOption[] | 'all'): SetupBook => withActive(book, (s) => ({ ...s, heard: heard === 'all' ? 'all' : [...heard] }));

/** Another setup put in use (an id the book doesn't have: the book as it is). */
export const useSetup = (book: SetupBook, id: string): SetupBook => (book.setups.some((s) => s.id === id) ? { ...book, active: id } : book);

const freeId = (book: SetupBook) => {
  let n = book.setups.length + 1;
  while (book.setups.some((s) => s.id === `s${n}`)) n++;
  return `s${n}`;
};

/** A name no setup has: `name`, or `name 2`, `name 3` … */
const freeName = (book: SetupBook, name: string) => {
  const taken = (n: string) => book.setups.some((s) => s.name === n);
  if (!taken(name)) return name;
  let i = 2;
  while (taken(`${name} ${i}`)) i++;
  return `${name} ${i}`;
};

/** The setup in use saved as a named setup under a new name (made free), and put in use; a custom variant saved so goes. */
export function saveAs(book: SetupBook, name: string): SetupBook {
  const active = activeSetup(book);
  const setups = active.base === undefined ? book.setups : book.setups.filter((s) => s !== active);
  const left = { ...book, setups };
  const id = freeId(left);
  const copy: Setup = { ...unbased(active), id, name: freeName(left, name.trim() || 'Setup') };
  return { ...book, setups: [...setups, copy], active: id };
}

/** A named setup renamed, and its custom variant with it (blank, or a variant: as it was). */
export function renameSetup(book: SetupBook, id: string, name: string): SetupBook {
  const to = name.trim();
  if (!to || !book.setups.some((s) => s.id === id && s.base === undefined)) return book;
  return { ...book, setups: book.setups.map((s) => (s.id === id ? { ...s, name: to } : s.base === id ? { ...s, name: to + CUSTOM } : s)) };
}

/**
 * A setup removed, a named one with its custom variant; the last named setup stays. Removing the one in use puts the
 * first named setup left in use.
 */
export function removeSetup(book: SetupBook, id: string): SetupBook {
  const gone = book.setups.find((s) => s.id === id);
  if (!gone || (gone.base === undefined && book.setups.filter((s) => s.base === undefined).length < 2)) return book;
  const setups = book.setups.filter((s) => s.id !== id && s.base !== id);
  return { ...book, setups, active: setups.some((s) => s.id === book.active) ? book.active : setups.find((s) => s.base === undefined)!.id };
}

// ---- a setup as a file ----

/** What a setup's file says it is. */
const FORMAT = 'webmidi-setup';

/** A setup as a file's text (`.midisetup.json`): the setup, and the profiles of its devices that the book has. */
export function exportSetup(book: SetupBook, id: string = book.active): string {
  const setup = book.setups.find((s) => s.id === id) ?? activeSetup(book);
  const devices = Object.fromEntries(setup.outputs.flatMap((o) => (own(book.devices, o.name) ? [[o.name, own(book.devices, o.name)!]] : [])));
  return JSON.stringify({ format: FORMAT, version: 1, setup: unbased(setup), devices }, null, 2);
}

/**
 * A setup's file added to the book and put in use, or why it can't be. A device's profile in the file is taken only
 * where the book has none: the book's own are this rig's, shared by every setup (decision 002). Its name is made free.
 */
export function importSetup(book: SetupBook, text: string): SetupBook | string {
  let kept: unknown;
  try {
    kept = JSON.parse(text);
  } catch {
    return 'This file isn’t a MIDI setup: it isn’t JSON.';
  }
  if (!isRecord(kept) || kept.format !== FORMAT) return 'This file isn’t a MIDI setup.';
  if (kept.version !== 1) return 'This MIDI setup was saved by a newer version: update the app to open it.';
  const read = readSetup(kept.setup);
  if (!read) return 'This MIDI setup is damaged: it has no setup in it.';
  const id = freeId(book);
  const devices = { ...book.devices };
  if (isRecord(kept.devices)) for (const [name, p] of Object.entries(kept.devices)) if (!own(devices, name)) devices[name] = readProfile(p, book.defaults);
  const setup: Setup = { ...unbased(read), id, name: freeName(book, read.name) };
  return { ...book, devices, setups: [...book.setups, setup], active: id };
}
