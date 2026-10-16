// Lifted from yggi/cell-studio src/midi/drum-presets.test.ts @ 3813fbb, adapted there from yggi/jambot
// apps/web/src/midi/drum-presets.test.ts @ 8cdb6b8.
import { describe, expect, it } from 'vitest';
import { DRUM_PRESETS, deviceNote, gmNotesFor, presetNameOf } from './drum-presets';

describe('drum presets', () => {
  it('GM sends every General MIDI drum note as it is', () => {
    for (let n = 35; n <= 81; n++) expect(deviceNote(DRUM_PRESETS.GM, n)).toBe(n);
  });

  it('Novation Circuit sends only the four notes its drum tracks answer (60, 62, 64, 65), kick alone on 60', () => {
    const circuit = DRUM_PRESETS['Novation Circuit'];
    for (const note of Object.values(circuit)) expect([60, 62, 64, 65]).toContain(note);
    expect(deviceNote(circuit, 36)).toBe(60);
    expect(Object.entries(circuit).filter(([, v]) => v === 60)).toEqual([['36', 60]]);
    expect([38, 42, 46].map((n) => deviceNote(circuit, n))).toEqual([62, 64, 65]);
  });
});

describe('presetNameOf', () => {
  it('names each preset by its notes', () => {
    for (const [name, map] of Object.entries(DRUM_PRESETS)) expect(presetNameOf(map)).toBe(name);
  });

  it('counts a note listed as itself as not listed: still GM', () => {
    expect(presetNameOf({ 36: 36, 38: 38 })).toBe('GM');
  });

  it('is Custom for a map edited by hand', () => {
    expect(presetNameOf({ 36: 61 })).toBe('Custom');
    expect(presetNameOf({ ...DRUM_PRESETS['Novation Circuit'], 36: 61 })).toBe('Custom');
  });
});

describe("gmNotesFor: a device's note back to the General MIDI notes it stands for (MIDI in, #207)", () => {
  it('under GM, every note is itself', () => {
    for (let n = 0; n <= 127; n++) expect(gmNotesFor(DRUM_PRESETS.GM, n)).toEqual([n]);
  });

  it('under every preset and a custom map, each note maps back to every General MIDI note sent as it, and to no other', () => {
    for (const map of [...Object.values(DRUM_PRESETS), { 36: 61, 38: 36 }])
      for (let note = 0; note <= 127; note++) {
        const back = gmNotesFor(map, note);
        for (const gm of back) expect(deviceNote(map, gm)).toBe(note);
        for (let gm = 0; gm <= 127; gm++) if (!back.includes(gm)) expect(deviceNote(map, gm)).not.toBe(note);
      }
  });

  it("a Circuit's pads: each pad the notes mapped onto it, then itself: 60 the kick, 62 the rim, snare, clap and toms, 64 the closed and pedal hats, 65 the open hat, crash and ride", () => {
    const circuit = DRUM_PRESETS['Novation Circuit'];
    expect(gmNotesFor(circuit, 60)).toEqual([36, 60]);
    expect(gmNotesFor(circuit, 62)).toEqual([37, 38, 39, 41, 45, 48, 62]);
    expect(gmNotesFor(circuit, 64)).toEqual([42, 44, 64]);
    expect(gmNotesFor(circuit, 65)).toEqual([46, 49, 51, 65]);
    // (a note the map sends elsewhere stands for nothing: the Circuit never sends 36 for the kick)
    expect(gmNotesFor(circuit, 36)).toEqual([]);
  });
});
