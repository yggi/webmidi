// Inputs assigned by preset (yggi/webmidi#43, decision 003): an input's kind guessed from its port's name, and a preset
// that gives each kind a role (`keyboard → lead`, `pads → drums`), filled into what each input plays where nothing is
// chosen. Webmidi doesn't know what a lead is: the frontend gives its rows' roles.

import type { PortOption } from './port';
import type { PlayableRow } from './plays';
import { activeSetup, inputRow, withPlays, type SetupBook } from './setups';

/** What an input is, as far as assigning it goes. */
export type InputKind = 'keyboard' | 'pads' | 'controller';

/**
 * The kinds, by names a port of each has, tried in this order: a keyboard first, since a keyboard with pads (an MPK
 * mini, a Launchkey) plays notes from its keys, then pads, then a controller of knobs and faders. Taken from devices'
 * port names: Arturia KeyStep, KeyLab, MiniLab; Novation Launchkey, Launchpad, Launch Control; Akai MPK mini, MPD;
 * M-Audio Keystation, Oxygen; NI Komplete Kontrol, Maschine; Nektar Impact; Roland A-49; Arturia BeatStep; Korg
 * nanoKONTROL; Behringer X-Touch; Faderfox; DJ TechTools Midi Fighter.
 */
export const KIND_PATTERNS: readonly (readonly [InputKind, RegExp])[] = [
  ['keyboard', /key ?step|key ?lab|mini ?lab|launch ?key|\bmpk|keystation|oxygen|komplete kontrol|\bimpact\b|\ba-?(25|37|49|61|88)\b|\bkeys?\b|piano|keyboard|\bkbd\b/i],
  ['pads', /\bmpd|launch ?pad|maschine|beat ?step|pads?\b/i],
  ['controller', /launch ?control|nano ?kontrol|x-?touch|faderfox|midi ?fighter|twister|control(ler)?\b/i],
];

/** An input's kind from its port's name, or null: not one of the kinds. */
export function guessKind(name: string): InputKind | null {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

/** A preset: a name, and for each kind it assigns, the role an input of that kind plays (a kind left out: nothing). */
export interface InputPreset {
  readonly name: string;
  readonly assign: readonly { readonly kind: InputKind; readonly role: string }[];
}

/** The preset a frontend starts from: a keyboard plays the lead, pads the drums, a controller nothing. */
export const DEFAULT_PRESET: InputPreset = {
  name: 'Keyboard to lead, pads to drums',
  assign: [
    { kind: 'keyboard', role: 'lead' },
    { kind: 'pads', role: 'drums' },
  ],
};

/**
 * The preset applied to the inputs plugged in, in the setup in use: an input whose kind it assigns plays the frontend's
 * first row of that role, kept by its id and role. Only where the input has no choice of its own: never over a
 * person's, a "not heard" too. An input whose kind it doesn't assign, or whose role no row has, is left as it was. A
 * change to a named setup, as any; the same book when nothing was filled in.
 */
export function applyPreset(book: SetupBook, preset: InputPreset, inputs: readonly PortOption[], rows: readonly PlayableRow[]): SetupBook {
  let next = book;
  for (const input of inputs) {
    const row = inputRow(input);
    if (Object.hasOwn(activeSetup(next).plays, row)) continue;
    const kind = guessKind(input.name);
    const role = preset.assign.find((a) => a.kind === kind)?.role;
    const target = role === undefined ? undefined : rows.find((r) => r.role === role);
    if (target) next = withPlays(next, row, { row: target.id, role: role! });
  }
  return next;
}
