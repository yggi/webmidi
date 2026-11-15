import { type Panel } from './model';
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
export declare const newLibrary: () => PanelLibrary;
/** A library from what was kept: anything. A panel that can't be read, and a second under one id, are dropped. */
export declare function readLibrary(v: unknown): PanelLibrary;
export declare const loadLibrary: (store: PanelStore) => PanelLibrary;
/** A store in memory, for a test or a page that keeps nothing. */
export declare function memoryPanelStore(initial?: unknown): PanelStore & {
    kept: unknown;
};
export declare const panelOf: (library: PanelLibrary, id: string) => Panel | undefined;
/** The library with a panel put in: in the place of the one with its id, else last. */
export declare function withPanel(library: PanelLibrary, panel: Panel): PanelLibrary;
export declare const removePanel: (library: PanelLibrary, id: string) => PanelLibrary;
/** The longest file read, in characters: 256 KB of text. */
export declare const MAX_FILE: number;
/** A panel as a file's text (`.midipanel.json`). */
export declare const exportPanel: (panel: Panel) => string;
/**
 * A panel's file added to the library, under an id and a name of its own, or why it can't be, in words: no panel's
 * file, one saved by a newer version, one too large, or one that instantiates to more than `MAX_INSTANCES`.
 */
export declare function importPanel(library: PanelLibrary, text: string): PanelLibrary | string;
