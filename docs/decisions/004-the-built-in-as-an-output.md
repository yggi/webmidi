# 004 · The built-in as an output: this device's own sound is a column of the matrix, kept in the setup

**Date:** 2026-11-08 · **Status:** accepted (the owner, in the session that made it; mockup: the built-in synth in the patch matrix) · Amends [002](002-setups-device-profiles-and-inputs-as-rows.md)

## Context

Jambot and Cell studio each had a switch beside the patchbay, "Play the built-in synth" and "Built-in sound too": whether this device's own sound plays, for every part at once, kept by the frontend and not by the setup.
The owner asked for it to move into the matrix and the switches to go.
A switch kept apart from the setups can't say that a setup at a venue is MIDI only while one at home plays the synth too, and it can't say which parts play here.

## Decision

- **The built-in is an output of the setup** (`BUILT_IN`, key and id `builtin`): a column of the matrix, first, once at most.
  Its crossings say which of the frontend's rows it plays (`HEARD`; any crossing does, since it has no channels).
- **It is no device.** It has no port (`outputNow` gives none), no channels, no clock, no profile, and sends no MIDI: `forwardsOf` sends it nothing, and `hardwareOutputs` is what a frontend sends to. A setup's fit doesn't count it. The outputs that send MIDI are numbered from 1 without it, so a piece's MIDI cards still name the same slots.
- **The switch dissolves into the column.** The built-in added (`withBuiltIn`, `+ <label>` in the matrix) hears every row it can play, which is the switch on; removed, by its × like any output, which is the switch off. Being in the setup, it is a setup's choice, and a change to a named setup makes its custom variant.
- **What a row is heard as stays the frontend's.** A voice or a kit can be played by the built-in; a row heard through another (Jambot's keys, through the part they play) says `builtIn: false`, and an input's row says which row it plays there through.
  A frontend that doesn't yet play its rows one by one shows the column's crossings without editing them (`builtIn.rows: false`), as it writes them.
- **One kept is read back as it was, first, under its key**; a second one is dropped.

## Consequences

- A setup's outputs can include one that isn't a device: a frontend that sends to every output, numbers them or counts them takes `hardwareOutputs`, which breaks a frontend's code at its next pin, so it is a minor version.
- Each frontend moves its switch into the book once, and plays a row on its own sound where the setup in use crosses it with the built-in.
- The built-in's settings (a volume, a test note) are the frontend's, opened from its head, as an output's `DeviceInspector` is webmidi's.
