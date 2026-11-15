/**
 * The panels a person has (decision 005): a library of its own, apart from the patchbay's book, since a panel is made
 * once and used in any setup. A panel is also a file to share (`.midipanel.json`), read as carefully as the library.
 */
import { instantiate, MAX_INSTANCES } from './instantiate';
import { readPanel, type Panel } from './model';

export interface PanelLibrary {
  readonly version: 1;
  readonly panels: readonly Panel[];
}

/** Where a library is kept: a frontend's storage, or memory in a test. */
export interface PanelStore {
  /** What was kept, as it was parsed: anything, since it is read with `readLibrary`; null for nothing. */
  load(): unknown;
  save(library: PanelLibrary): void;
}

export const newLibrary = (): PanelLibrary => ({ version: 1, panels: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A library from what was kept: anything. A panel that can't be read, and a second under one id, are dropped. */
export function readLibrary(v: unknown): PanelLibrary {
  if (!isRecord(v) || v.version !== 1 || !Array.isArray(v.panels)) return newLibrary();
  const panels: Panel[] = [];
  for (const p of v.panels) {
    const panel = readPanel(p);
    if (panel && !panels.some((x) => x.id === panel.id)) panels.push(panel);
  }
  return { version: 1, panels };
}

export const loadLibrary = (store: PanelStore): PanelLibrary => readLibrary(store.load());

/** A store in memory, for a test or a page that keeps nothing. */
export function memoryPanelStore(initial: unknown = null): PanelStore & { kept: unknown } {
  const store = {
    kept: initial,
    load: () => store.kept,
    save: (library: PanelLibrary) => {
      store.kept = JSON.parse(JSON.stringify(library)) as unknown;
    },
  };
  return store;
}

export const panelOf = (library: PanelLibrary, id: string): Panel | undefined => library.panels.find((p) => p.id === id);

/** The library with a panel put in: in the place of the one with its id, else last. */
export function withPanel(library: PanelLibrary, panel: Panel): PanelLibrary {
  const at = library.panels.findIndex((p) => p.id === panel.id);
  return { ...library, panels: at < 0 ? [...library.panels, panel] : library.panels.map((p, i) => (i === at ? panel : p)) };
}

export const removePanel = (library: PanelLibrary, id: string): PanelLibrary => ({ ...library, panels: library.panels.filter((p) => p.id !== id) });

const FORMAT = 'webmidi-panel';
const FILE_VERSION = 1;
/** The longest file read, in characters: 256 KB of text. */
export const MAX_FILE = 256 * 1024;

/** A panel as a file's text (`.midipanel.json`). */
export const exportPanel = (panel: Panel): string => JSON.stringify({ format: FORMAT, version: FILE_VERSION, panel }, null, 2);

/** A name no panel of the library has: the name, or the name with the first free number after it. */
function freeName(library: PanelLibrary, name: string): string {
  const taken = (n: string) => library.panels.some((p) => p.name === n);
  if (!taken(name)) return name;
  for (let i = 2; ; i++) if (!taken(`${name} ${i}`)) return `${name} ${i}`;
}

function freeId(library: PanelLibrary): string {
  for (let i = library.panels.length + 1; ; i++) if (!panelOf(library, `p${i}`)) return `p${i}`;
}

/**
 * A panel's file added to the library, under an id and a name of its own, or why it can't be, in words: no panel's
 * file, one saved by a newer version, one too large, or one that instantiates to more than `MAX_INSTANCES`.
 */
export function importPanel(library: PanelLibrary, text: string): PanelLibrary | string {
  if (text.length > MAX_FILE) return 'This panel is too large to open (more than 256 KB).';
  let kept: unknown;
  try {
    kept = JSON.parse(text);
  } catch {
    return 'This file isn’t a panel: it isn’t JSON.';
  }
  if (!isRecord(kept) || kept.format !== FORMAT) return 'This file isn’t a panel.';
  if (kept.version !== FILE_VERSION) return 'This panel was saved by a newer version: update the app to open it.';
  const read = readPanel(kept.panel);
  if (!read) return 'This panel is damaged: it has no panel in it.';
  if (instantiate(read).truncated) return `This panel is too large to open (more than ${MAX_INSTANCES} controls and groups).`;
  return withPanel(library, { ...read, id: freeId(library), name: freeName(library, read.name) });
}
