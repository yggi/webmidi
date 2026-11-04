import type { MidiPort, PortAccess, PortOption } from './port';
import { type Setup, type SetupBook } from './setups';
/** An output of a setup as it resolves now: its key, and its live port, or null (no device, or not plugged in). */
export interface LiveOutput {
    readonly key: string;
    readonly port: MidiPort | null;
}
/**
 * The live ports of a setup: each output by its id, else by its name (an id changes on replug on some systems, as
 * `outputNow` finds it), in the setup's order; and the inputs to listen to, heard or routed (`listenOf`), as
 * `MidiAccess.listen` takes them.
 * The book keeps the ids it has: the name finds the port, so a replug changes nothing kept.
 */
export declare function portsOf(setup: Setup, access: Pick<PortAccess, 'outputs' | 'outputPort'>): {
    outputs: LiveOutput[];
    listen: 'all' | readonly PortOption[];
};
/**
 * The ports a book kept by id alone, named from the ports plugged in now (a store from before that kept no names, as
 * Jambot's: `fromJambot` runs before any port is seen), in every setup, a custom variant too: each output, and an
 * input's row (`in:<id>` becomes `in:<name>`) in what it plays and in the routes. No variant is made, since this is no change of the
 * person's. A device's profile needs no moving: it is kept by name, and a device with none takes the book's defaults.
 * The same book when nothing was named.
 */
export declare function namePorts(book: SetupBook, plugged: {
    readonly inputs: readonly PortOption[];
    readonly outputs: readonly PortOption[];
}): SetupBook;
