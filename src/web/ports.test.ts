// New: KO-Multitool's listPorts and guessPort (src/lib/transport/midi.ts @ 8b4b49e) had no tests of their own.
import { describe, expect, it } from 'vitest';
import { guessPort, listPorts, type PortInfo } from './ports';

const port = (id: string, name: string | null, more: Partial<MIDIPort> = {}) =>
  ({ id, name, manufacturer: null, version: null, state: 'connected', connection: 'closed', ...more }) as unknown as MIDIPort;
const access = (inputs: MIDIPort[], outputs: MIDIPort[]) => ({
  inputs: new Map(inputs.map((p) => [p.id, p])) as unknown as MIDIInputMap,
  outputs: new Map(outputs.map((p) => [p.id, p])) as unknown as MIDIOutputMap,
});
const info = (name: string, manufacturer = ''): PortInfo => ({ id: name, name, manufacturer, version: '', state: 'connected', connection: 'open' });

/** KO-Multitool's patterns for the EP-133 K.O. II, which it keeps. */
const KO_II = [/ep[-\s]?133/i, /k\.?o\.?\s*(ii|2)/i, /teenage/i];

describe('listPorts', () => {
  it('lists every port in full, in the browser’s order, an unplugged one too, with what it lacks filled in', () => {
    const ports = listPorts(
      access(
        [port('in-1', 'EP-133 KO II MIDI 1', { manufacturer: 'teenage engineering', version: '2.0', connection: 'open' }), port('in-2', null, { state: 'disconnected' })],
        [port('out-1', 'Synth')],
      ),
    );
    expect(ports.inputs).toEqual([
      { id: 'in-1', name: 'EP-133 KO II MIDI 1', manufacturer: 'teenage engineering', version: '2.0', state: 'connected', connection: 'open' },
      { id: 'in-2', name: '(unnamed)', manufacturer: '', version: '', state: 'disconnected', connection: 'closed' },
    ]);
    expect(ports.outputs.map((p) => p.id)).toEqual(['out-1']);
  });
});

describe('guessPort', () => {
  it('finds a device by its port’s name, or by its manufacturer', () => {
    expect(guessPort([info('Keys'), info('EP-133 KO II MIDI 1')], KO_II)?.name).toBe('EP-133 KO II MIDI 1');
    expect(guessPort([info('Keys'), info('USB MIDI', 'teenage engineering')], KO_II)?.name).toBe('USB MIDI');
  });

  it('goes by the patterns in order: a surer pattern’s port before an earlier listed one', () => {
    expect(guessPort([info('USB MIDI', 'teenage engineering'), info('K.O. II')], KO_II)?.name).toBe('K.O. II');
  });

  it('guesses nothing when nothing matches, or with no patterns', () => {
    expect(guessPort([info('Keys')], KO_II)).toBeUndefined();
    expect(guessPort([info('EP-133')], [])).toBeUndefined();
  });
});
