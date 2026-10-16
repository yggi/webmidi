import type { MidiPort, PortAccess, PortOption } from './port';
/** The ports chosen, as the settings keep them (by id and name; `'none'`, or for the input `'all'`), and the live output they resolve to. */
export interface ChosenPorts {
    outPortId: string;
    outPortName: string;
    inPortId: string;
    inPortName: string;
    outPort: MidiPort | null;
}
/** The live output a port chosen resolves to now (by id, else by name: see `idNow`), or null: none chosen, or not plugged in. */
export declare function outputNow(access: Pick<PortAccess, 'outputs' | 'outputPort'>, chosen: PortOption): MidiPort | null;
/**
 * Adopt the ports chosen from the connection as it is now: the output by its id (or its name: see `idNow`), none if it
 * is gone or was never chosen, and the input listened to. A port unplugged and plugged in again is a new object, so this
 * runs whenever the ports may have changed.
 */
export declare function adoptPorts(access: PortAccess, chosen: ChosenPorts): void;
/** What was found, in a line: "MIDI connected: 1 input, 2 outputs." */
export declare function portsMessage(ports: {
    readonly inputs: readonly unknown[];
    readonly outputs: readonly unknown[];
}): string;
/**
 * Connect, then adopt the ports already chosen: the connection and what was found, or why it couldn't connect. `alive`
 * false once the connection comes (its owner gone while asking): nothing is adopted, the caller closes it.
 */
export declare function connectMidi<A extends PortAccess>(connect: () => Promise<A | string>, chosen: ChosenPorts, alive?: () => boolean): Promise<{
    access: A | null;
    message: string;
}>;
