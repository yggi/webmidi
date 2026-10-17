import type { PortAccess } from './port';
type Handler = ((event: {
    data: Uint8Array;
    timeStamp: number;
}) => void) | null;
type FakeInput = {
    id: string;
    name: string;
    onmidimessage: Handler;
};
type FakeOutput = {
    id: string;
    name: string;
    sent: {
        data: number[];
        timestamp?: number;
    }[];
    send(data: readonly number[], timestamp?: number): void;
};
/** An input a test plays into: `play(bytes, timeStamp)` is what a key would send. */
export declare function fakeInput(id: string, name: string): FakeInput & {
    play(bytes: number[], timeStamp?: number): void;
};
/** An output that records what is sent to it. */
export declare function fakePort(id: string, name: string): FakeOutput;
/** A fake `MIDIAccess`: plug ports in and out of its maps, then `change()` as Web MIDI's `statechange` would. */
export declare function fakeAccess(inputs?: FakeInput[], outputs?: FakeOutput[]): {
    inputs: Map<string, FakeInput>;
    outputs: Map<string, FakeOutput>;
    onstatechange: (() => void) | null;
    change: () => void | undefined;
};
/**
 * A connection over a fake access, as the Web MIDI adapter makes one (Cell studio's `MidiAccess`): the ports in its maps,
 * in order, an output by id, the input listened to (an id, `'all'` or `'none'`: the others' handlers cleared), and the
 * access's `change()` heard as the ports changing: the input listened to anew (a port plugged in again is a fresh
 * object), then `onChange`.
 */
export declare function fakeConnection(access: ReturnType<typeof fakeAccess>, on?: {
    onChange?: () => void;
}): PortAccess;
export {};
