// Inputs assigned by preset (yggi/webmidi#43): the kinds by real devices' port names, every preset over every kind, and
// a preset never over a person's choice.
import { describe, expect, it } from 'vitest';
import { applyPreset, DEFAULT_PRESET, guessKind, type InputKind, type InputPreset } from './input-kinds';
import { activeSetup, newBook, overwrite, withPlays } from './setups';

/** Port names as devices give them (Web MIDI on macOS, Windows and Linux), by the kind each is. */
const DEVICES: Record<InputKind, readonly string[]> = {
  keyboard: [
    'Arturia KeyStep 37',
    'KeyLab mkII 61 MIDI',
    'Arturia MiniLab mkII',
    'Launchkey Mini MK3 MIDI Port',
    'MPK mini 3',
    'Keystation 49 MK3',
    'Oxygen Pro 49',
    'Komplete Kontrol M32',
    'Impact LX49+',
    'A-49',
    'Digital Piano',
    'USB Keyboard',
  ],
  pads: ['MPD218', 'Launchpad X LPX MIDI', 'Maschine Mikro MK3', 'Arturia BeatStep', 'Drum Pads'],
  controller: ['Launch Control XL', 'nanoKONTROL2', 'X-TOUCH MINI', 'Faderfox EC4', 'Midi Fighter Twister', 'MIDI Controller'],
};

describe('an input’s kind, from its port’s name', () => {
  it.each(Object.entries(DEVICES).flatMap(([kind, names]) => names.map((name) => [name, kind] as const)))('%s is a %s', (name, kind) => {
    expect(guessKind(name)).toBe(kind);
  });

  it('is none for a port that isn’t one of the kinds', () => {
    for (const name of ['IAC Bus 1', 'Circuit Tracks', 'Midi Through Port-0', 'TD-3', '']) expect(guessKind(name)).toBeNull();
  });
});

/** A frontend's rows with every role a preset may name. */
const ROWS = [
  { id: 'fiddle', role: 'lead' },
  { id: '*', role: 'drums' },
  { id: 'sub', role: 'bass' },
];
const port = (name: string) => ({ id: `id:${name}`, name });

describe('a preset applied', () => {
  const presets: InputPreset[] = [
    DEFAULT_PRESET,
    { name: 'Everything leads', assign: (['keyboard', 'pads', 'controller'] as const).map((kind) => ({ kind, role: 'lead' })) },
    { name: 'Pads play bass', assign: [{ kind: 'pads', role: 'bass' }] },
    { name: 'Nothing', assign: [] },
  ];

  it.each(presets.flatMap((preset) => (Object.keys(DEVICES) as InputKind[]).map((kind) => [preset.name, kind, preset] as const)))(
    '%s, to a %s: the row of the role it assigns, or nothing',
    (_, kind, preset) => {
      const input = port(DEVICES[kind][0]!);
      const role = preset.assign.find((a) => a.kind === kind)?.role;
      const plays = activeSetup(applyPreset(newBook(), preset, [input], ROWS)).plays;
      expect(plays).toEqual(role ? { [`in:${input.name}`]: { row: ROWS.find((r) => r.role === role)!.id, role } } : {});
    },
  );

  it('fills in only an input with no choice: never over a person’s, a "not heard" too', () => {
    let book = withPlays(newBook(), 'in:MPD218', 'none');
    book = withPlays(book, 'in:Arturia KeyStep 37', { row: 'sub', role: 'bass' });
    const next = applyPreset(book, DEFAULT_PRESET, [port('MPD218'), port('Arturia KeyStep 37'), port('Launchkey Mini MK3 MIDI Port')], ROWS);
    expect(activeSetup(next).plays).toEqual({
      'in:MPD218': 'none',
      'in:Arturia KeyStep 37': { row: 'sub', role: 'bass' },
      'in:Launchkey Mini MK3 MIDI Port': { row: 'fiddle', role: 'lead' },
    });
  });

  it('is a change to a named setup, as any, and the same book when it fills nothing in', () => {
    const book = overwrite(withPlays(newBook(), 'in:x', 'none'));
    expect(activeSetup(applyPreset(book, DEFAULT_PRESET, [port('MPD218')], ROWS)).base).toBe(book.active);
    expect(applyPreset(book, DEFAULT_PRESET, [port('IAC Bus 1')], ROWS)).toBe(book);
    expect(applyPreset(book, DEFAULT_PRESET, [port('MPD218')], [{ id: 'fiddle', role: 'lead' }])).toBe(book);
  });
});
