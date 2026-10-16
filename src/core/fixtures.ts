// Lifted from yggi/cell-studio src/midi/fixtures.ts @ 3813fbb (lifted there from yggi/jambot apps/web/src/midi/access.test.ts
// @ 8cdb6b8): Web MIDI without a device. Its `installMidi` and `uninstallMidi` (a fake `navigator.requestMIDIAccess`)
// are `web`'s (web/fixtures.ts); `fakeConnection` is new, the adapter's part played over the same fake ports.
import type { PortAccess } from './port';

type Handler = ((event: { data: Uint8Array; timeStamp: number }) => void) | null;
type FakeInput = { id: string; name: string; onmidimessage: Handler };
type FakeOutput = { id: string; name: string; sent: { data: number[]; timestamp?: number }[]; send(data: readonly number[], timestamp?: number): void };

/** An input a test plays into: `play(bytes, timeStamp)` is what a key would send. */
export function fakeInput(id: string, name: string): FakeInput & { play(bytes: number[], timeStamp?: number): void } {
  const input = { id, name, onmidimessage: null as Handler, play: (bytes: number[], timeStamp = 0) => input.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp }) };
  return input;
}

/** An output that records what is sent to it. */
export function fakePort(id: string, name: string): FakeOutput {
  const port: FakeOutput = { id, name, sent: [], send: (data, timestamp) => void port.sent.push({ data: [...data], timestamp }) };
  return port;
}

/** A fake `MIDIAccess`: plug ports in and out of its maps, then `change()` as Web MIDI's `statechange` would. */
export function fakeAccess(inputs: FakeInput[] = [], outputs: FakeOutput[] = []) {
  const access = {
    inputs: new Map(inputs.map((p) => [p.id, p])),
    outputs: new Map(outputs.map((p) => [p.id, p])),
    onstatechange: null as (() => void) | null,
    change: () => access.onstatechange?.(),
  };
  return access;
}

/**
 * A connection over a fake access, as the Web MIDI adapter makes one (Cell studio's `MidiAccess`): the ports in its maps,
 * in order, an output by id, the input listened to (an id, `'all'` or `'none'`: the others' handlers cleared), and the
 * access's `change()` heard as the ports changing: the input listened to anew (a port plugged in again is a fresh
 * object), then `onChange`.
 */
export function fakeConnection(access: ReturnType<typeof fakeAccess>, on: { onChange?: () => void } = {}): PortAccess {
  let listening = 'none';
  const listen = (id: string) => {
    listening = id;
    for (const [portId, input] of access.inputs) input.onmidimessage = id === 'all' || id === portId ? () => {} : null;
  };
  access.onstatechange = () => {
    listen(listening);
    on.onChange?.();
  };
  const options = (ports: ReadonlyMap<string, { readonly name: string }>) => [...ports].map(([id, port]) => ({ id, name: port.name }));
  return {
    get inputs() {
      return options(access.inputs);
    },
    get outputs() {
      return options(access.outputs);
    },
    outputPort: (id) => access.outputs.get(id) ?? null,
    listen,
  };
}
