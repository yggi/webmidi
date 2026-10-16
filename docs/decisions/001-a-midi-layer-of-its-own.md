# 001 · A MIDI layer of its own

**Date:** 2026-10-16 · **Status:** accepted (the owner) · Issues: [yggi/cells#63](https://github.com/yggi/cells/issues/63)

## Context

Cell studio and Jambot each had a copy of the same MIDI code: Web MIDI access, port adoption, the message parser and the computer's keys, drum maps, note out, clock out and the offset between the audio clock and the page's. Cell studio's had lifted Jambot's and gone further in every shared part. Cells' decision 037 (D2) asked for one shared copy, its home settled when it is merged.
yggi/cells#63 took the inventory and recommended the pure core in cells' engine, each frontend keeping its own browser adapter, mainly because the core's note out read the language's played note (`Played`).

## Decision

- **A repository of its own, `yggi/webmidi`**, public, consumed at a tag like cells.
- **Three layers, each a subpath export:** `core`, pure (no DOM, no Web MIDI, no timers); `web`, the Web MIDI adapter, shared rather than one per frontend; `ui`, shared Svelte 5 components as source.
- **webmidi never depends on cells, and cells never on webmidi.** Note out takes webmidi's own plain note, so a frontend adapts its events in a few lines; clock out takes the ticks' times, which the frontend gets from cells' `ticksBetween`.
- **Cells keeps only its own MIDI aspects:** MIDI files, and when a piece's clock ticks (`mainMeter`, `ticksBetween`). The pitch-bend encoding is in both (cells writes it into files); the hub's `midi-rx` bend vectors are the one encoding both are held to.

## Consequences

- The browser adapter is written once (`web`), not once per frontend, and KO-Multitool can take the same layer.
- A fifth repository and a second line of tags to keep; a frontend moves two pins.
- Cell studio's adapter turns `Played` into `OutNote`s (cells' `router`, `legatoNotes` and `noteOf`, outside webmidi); its sweeps of `MidiOut` over every example stay there, since they need the language.
