# Changelog

What changed in webmidi, newest first: what a frontend (Cell studio, Jambot, KO-Multitool) reads before it moves its pin, `github:yggi/webmidi#vX.Y.Z`.
A release is a tag, and it gathers the entries under *Unreleased* beneath its own heading.
An entry says whether what goes on the wire changes; one that breaks a frontend's code names its migration, and before 1.0 it makes the next release a minor version.

Format: [Keep a Changelog](https://keepachangelog.com/), as cells' (lifted from yggi/cells CHANGELOG.md @ 41ef16b, its form). Add a line to *Unreleased* in the pull request that makes the change.

## Unreleased

### Added
- **`core`**, lifted from Cell studio's `src/midi/` and `src/layout/keyboard.ts` @ 3813fbb: the parser and the computer's keys, the keyboard layout, drum maps, port adoption, the clock offset, note out and clock out. What goes on the wire is Cell studio's, with two differences a frontend moving to it would see: note out takes webmidi's `OutNote` (its channel, key, velocity, cents and bends in the note) where Cell studio's took cells' `Played` and a route, and clock out takes the ticks' times as `ClockTicks`, which cells' `ticksBetween` gives.
- The hub's `midi-rx` contract, version 1, run against the parser: a message cut short is now nothing, where the parser read half a note-on as a note-off.

### Repository
- The scaffold, lifted from cells: the purity gate, the declarations in `types/`, the pre-push hook and its stamp, verify installing first, the layering check, CI as a witness, this changelog.
