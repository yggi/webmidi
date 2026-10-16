# Changelog

What changed in webmidi, newest first: what a frontend (Cell studio, Jambot, KO-Multitool) reads before it moves its pin, `github:yggi/webmidi#vX.Y.Z`.
A release is a tag, and it gathers the entries under *Unreleased* beneath its own heading.
An entry says whether what goes on the wire changes; one that breaks a frontend's code names its migration, and before 1.0 it makes the next release a minor version.

Format: [Keep a Changelog](https://keepachangelog.com/), as cells' (lifted from yggi/cells CHANGELOG.md @ 41ef16b, its form). Add a line to *Unreleased* in the pull request that makes the change.

## Unreleased

### Added
- **`core`**, lifted from Cell studio's `src/midi/` and `src/layout/keyboard.ts` @ 3813fbb: the parser and the computer's keys, the keyboard layout, drum maps, port adoption, the clock offset, note out and clock out. What goes on the wire is Cell studio's, with two differences a frontend moving to it would see: note out takes webmidi's `OutNote` (its channel, key, velocity, cents and bends in the note) where Cell studio's took cells' `Played` and a route, and clock out takes the ticks' times as `ClockTicks`, which cells' `ticksBetween` gives.
- **`web`**, the Web MIDI adapter, `@yggi/webmidi/web`: Cell studio's `src/midi/access.ts` @ 85175ce (`MidiAccess`: connect, the permission query, the ports plugged in, an input listened to, `close`) merged with KO-Multitool's `src/lib/transport/midi.ts` @ 8b4b49e (`requestAccess` with SysEx, `readEnvironment`, `listPorts`, `guessPort`, `MidiTransport`). Nothing on the wire changes. What a frontend moving to it would see: `MidiAccess.connect` and `granted` take `{ sysex }` (false as before), and `MidiAccess.access` is the browser's own connection; `guessPort` takes the patterns to look for (KO-Multitool passes the EP-133's, which it keeps); `MidiTransport` takes core's `MidiPort` as its output and any input with `addEventListener` (a `MIDIInput` is both), and implements webmidi's `SysexTransport`, which ep133-sysex's `Transport` accepts by its shape.
- `SysexAssembler` in core, lifted from ep133-sysex's `src/frame.ts` @ ca8d819: whole SysEx messages out of a byte stream.
- The hub's `midi-rx` contract, version 1, run against the parser: a message cut short is now nothing, where the parser read half a note-on as a note-off.

### Changed
- **A note-off carries its release velocity** (`parseMidiMessage`): `[0x80, 60, 64]` reads `velocity: 64`, where it read 0, as the hub's `midi-rx` contract says; a note-on at velocity 0 still reads as a release at 0. What a frontend reads from input changes, nothing on the wire: a frontend that took a release's velocity for 0 reads `on` instead.

### Repository
- The web gate, `tsconfig.web.json`: web typechecks with the browser's types and not Node's; the layering holds web, as core, to no package.
- The scaffold, lifted from cells: the purity gate, the declarations in `types/`, the pre-push hook and its stamp, verify installing first, the layering check, CI as a witness, this changelog.
