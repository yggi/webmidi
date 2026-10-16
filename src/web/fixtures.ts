// Lifted from yggi/cell-studio src/midi/fixtures.ts @ 85175ce (installMidi, uninstallMidi; lifted there from yggi/jambot
// apps/web/src/midi/access.test.ts @ 8cdb6b8): what only `web`'s tests need, a fake `navigator.requestMIDIAccess`. The
// fake ports and access are core's (core/fixtures.ts); `fakeListenedInput` is new, an input a transport listens to.
import type { fakeAccess } from '../core/fixtures';
import type { MessageSource } from './transport';

/** `navigator.requestMIDIAccess` answering with `access` (or refusing, given an error); `uninstallMidi()` takes it away again. */
export function installMidi(access: ReturnType<typeof fakeAccess> | Error): void {
  navigator.requestMIDIAccess = () => (access instanceof Error ? Promise.reject(access) : Promise.resolve(access as unknown as MIDIAccess));
}

export function uninstallMidi(): void {
  delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess;
}

/** An input heard through `addEventListener`, as a `MIDIInput`: `deliver(bytes)` is one delivery event, whole or a part. */
export function fakeListenedInput(): MessageSource & { deliver(bytes: number[]): void; readonly listeners: number } {
  const listeners = new Set<(event: { readonly data: Uint8Array | null }) => void>();
  return {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    deliver: (bytes) => listeners.forEach((l) => l({ data: new Uint8Array(bytes) })),
    get listeners() {
      return listeners.size;
    },
  };
}
