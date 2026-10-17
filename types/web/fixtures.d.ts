import type { fakeAccess } from '../core/fixtures';
import type { MessageSource } from './transport';
/** `navigator.requestMIDIAccess` answering with `access` (or refusing, given an error); `uninstallMidi()` takes it away again. */
export declare function installMidi(access: ReturnType<typeof fakeAccess> | Error): void;
export declare function uninstallMidi(): void;
/** An input heard through `addEventListener`, as a `MIDIInput`: `deliver(bytes)` is one delivery event, whole or a part. */
export declare function fakeListenedInput(): MessageSource & {
    deliver(bytes: number[]): void;
    readonly listeners: number;
};
