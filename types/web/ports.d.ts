/** A port in full, as a diagnostic lists it: unplugged ones too, with their state (`MidiAccess` lists only the plugged-in). */
export interface PortInfo {
    id: string;
    name: string;
    manufacturer: string;
    version: string;
    state: string;
    connection: string;
}
/** Every port the browser lists, in its order, each in full. */
export declare function listPorts(access: Pick<MIDIAccess, 'inputs' | 'outputs'>): {
    inputs: PortInfo[];
    outputs: PortInfo[];
};
/**
 * Guess which port belongs to a device: the first whose name or manufacturer matches the first pattern that matches
 * any, so the patterns go most certain first. Deliberately loose (a device's port is named differently on each system,
 * and some names nobody has reported yet): a miss must never block, and the page always offers the choice by hand.
 */
export declare function guessPort(ports: readonly PortInfo[], patterns: readonly RegExp[]): PortInfo | undefined;
