import type { DrumMap } from './drum-presets';
import type { PortOption } from './port';
/** The channels notes rotate over on a device (MPE-style, for microtonal pieces), first to last, 1–16. */
export interface MpeRange {
    readonly from: number;
    readonly to: number;
}
/**
 * What is true of a device, kept by its port's name and shared by every setup (decision 002): a Circuit's drum map is
 * set once, wherever it is plugged in. Whether it is sent clock is the setup's (`Setup.clock`), a row of the matrix.
 */
export interface DeviceProfile {
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
export declare const AS_PLAYED = 0;
/** A context's routes: a row's id to its crossings, by output key. */
export type Routes = Readonly<Record<string, Readonly<Record<string, Crossing>>>>;
/**
 * What an input plays (yggi/webmidi#43, decision 003): `'none'`, not heard at all; `'default'`, heard, playing what the
 * frontend plays by default (the open sheet, the Muse's lead); or one of the frontend's rows, kept by its id and by its
 * role (`'lead'`, `'drums'`), so a row a frontend doesn't have falls to its row of that role, else to the default.
 */
export type PlaysChoice = 'none' | 'default' | {
    readonly row: string;
    readonly role?: string;
};
/**
 * A named setup: the outputs in order, what each input plays, and the routes of each context it names. A change
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
    /**
     * What each input plays, by its row (`in:<name>`): one mechanism for whether it is heard and what it drives, the same
     * in every context, as the clock is. `ANY_INPUT`'s is every input's without one of its own; an input with neither is
     * not heard. Where an input's messages are sent is its row's crossings, apart from this.
     */
    readonly plays: Readonly<Record<string, PlaysChoice>>;
    /**
     * By context, a name the frontend chooses (`piece:<title>` in Cell studio, `band` in Jambot, `bay` standalone): its
     * routes. Rows are the frontend's, and the inputs' (`inputRow`).
     */
    readonly routes: Readonly<Record<string, Routes>>;
    /** The outputs sent MIDI clock (24 ticks a beat, Start, Stop, Continue), by key: the matrix's clock row, in every context. */
    readonly clock: readonly string[];
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
export declare const inputRow: (port: PortOption) => string;
export declare const ANY_INPUT = "in:*";
export declare const DEFAULT_PROFILE: DeviceProfile;
/** What a custom variant is called after its named setup: "Home - custom". */
export declare const CUSTOM = " - custom";
/** A book with one setup, one output and no device: a first visit. */
export declare function newBook(): SetupBook;
/** A profile kept, each field checked on its own, the rest from `base`. */
export declare function readProfile(v: unknown, base?: DeviceProfile): DeviceProfile;
/** A book from what was kept: anything; junk is dropped field by field, and nothing usable is a new book. */
export declare function readBook(v: unknown): SetupBook;
/** The book kept in `store`, or, when nothing is kept, `first()` (a frontend's store from before, migrated), saved at once. */
export declare function loadBook(store: BookStore, first?: () => SetupBook | null): SetupBook;
/** A store in memory, for a test or a page that keeps nothing. */
export declare function memoryStore(initial?: unknown): BookStore & {
    kept: unknown;
};
/** The setup in use. */
export declare const activeSetup: (book: SetupBook) => Setup;
/** A device's profile, by its port's name: its own, or the book's defaults. */
export declare const profileOf: (book: SetupBook, name: string) => DeviceProfile;
/** What a crossing of the setup in use sends, or undefined: nothing. */
export declare const crossingOf: (book: SetupBook, context: string, row: string, output: string) => Crossing | undefined;
/** How many of a setup's devices are plugged in, of how many it has (slots with no device not counted). */
export declare function fit(setup: Setup, plugged: readonly PortOption[]): {
    plugged: number;
    of: number;
};
/**
 * The setup to suggest when the one in use misses a device: another whose every device is plugged in (the one with the
 * most devices first), or null: the one in use has all its own, or no other does.
 */
export declare function suggestSetup(book: SetupBook, plugged: readonly PortOption[]): Setup | null;
/** The named setup the one in use is a custom variant of, or null: the one in use is as saved. */
export declare function changedFrom(book: SetupBook): Setup | null;
/** The named setup overwritten with its custom variant in use, which goes; the book as it is when none is. */
export declare function overwrite(book: SetupBook): SetupBook;
/** The custom variant in use discarded, and its named setup put back in use. */
export declare function discard(book: SetupBook): SetupBook;
/** A device's profile changed (by its port's name), each value clamped to what it may be. */
export declare function withProfile(book: SetupBook, name: string, change: Partial<DeviceProfile>): SetupBook;
/** A crossing of the setup in use set (a channel 1–16, or `AS_PLAYED`), or cleared (undefined, or out of range). */
export declare function withCrossing(book: SetupBook, context: string, row: string, output: string, value: Crossing | undefined): SetupBook;
/** An output added to the setup in use, under a key of its own: its key, and the book. */
export declare function addOutput(book: SetupBook, device?: PortOption): {
    book: SetupBook;
    key: string;
};
/** An output given another device: its routes stay, under its key. */
export declare function chooseDevice(book: SetupBook, key: string, device: PortOption): SetupBook;
/**
 * An output removed, with its crossings in every context. A setup keeps one output, so the last is left with no device
 * instead, its routes kept for the next device chosen.
 */
export declare function removeOutput(book: SetupBook, key: string): SetupBook;
/** An output of the setup in use sent clock, or not (an output it doesn't have: the book as it is). */
export declare function withClock(book: SetupBook, key: string, on: boolean): SetupBook;
/** Whether an output of the setup in use is sent clock. */
export declare const sendsClock: (book: SetupBook, key: string) => boolean;
/**
 * What an input plays, by its row (`inputRow(port)`, or `ANY_INPUT` for every input's), in the setup in use: a choice,
 * or undefined to drop its own and follow `ANY_INPUT`'s. A change to a named setup, as any.
 */
export declare function withPlays(book: SetupBook, input: string, choice: PlaysChoice | undefined): SetupBook;
/** Another setup put in use (an id the book doesn't have: the book as it is). */
export declare const useSetup: (book: SetupBook, id: string) => SetupBook;
/** The setup in use saved as a named setup under a new name (made free), and put in use; a custom variant saved so goes. */
export declare function saveAs(book: SetupBook, name: string): SetupBook;
/** A named setup renamed, and its custom variant with it (blank, or a variant: as it was). */
export declare function renameSetup(book: SetupBook, id: string, name: string): SetupBook;
/**
 * A setup removed, a named one with its custom variant. Removing the one in use puts the first named setup left in use;
 * removing the last named setup leaves a blank one in its place, since a book keeps one. The devices' profiles stay.
 */
export declare function removeSetup(book: SetupBook, id: string): SetupBook;
/** A device's profile forgotten: it follows the book's defaults again, in every setup. */
export declare function forgetDevice(book: SetupBook, name: string): SetupBook;
/** A setup as a file's text (`.midisetup.json`): the setup, and the profiles of its devices that the book has. */
export declare function exportSetup(book: SetupBook, id?: string): string;
/**
 * A setup's file added to the book and put in use, or why it can't be. A device's profile in the file is taken only
 * where the book has none: the book's own are this rig's, shared by every setup (decision 002). Its name is made free.
 */
export declare function importSetup(book: SetupBook, text: string): SetupBook | string;
