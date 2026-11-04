# Changelog

What changed in webmidi, newest first: what a frontend (Cell studio, Jambot, KO-Multitool) reads before it moves its pin, `github:yggi/webmidi#vX.Y.Z`.
A release is a tag, and it gathers the entries under *Unreleased* beneath its own heading.
An entry says whether what goes on the wire changes; one that breaks a frontend's code names its migration, and before 1.0 it makes the next release a minor version.

Format: [Keep a Changelog](https://keepachangelog.com/), as cells' (lifted from yggi/cells CHANGELOG.md @ 41ef16b, its form). Add a line to *Unreleased* in the pull request that makes the change.

## Unreleased

### Added
- **`MatrixRow.playable`** (found moving Jambot onto what an input plays, yggi/jambot#560): a row that says `false` isn't offered in an input's Plays choice, and a preset doesn't assign an input to it; by default a voice or a kit can be played, as before. Jambot plays along on its lead and drums alone, so its bass, pad, stab and keys' rows say `false`. Additive: nothing breaks at a frontend's next pin, and nothing on the wire changes.

### Fixed
- **An input's Plays choice is shown whole in a narrow drawer** (yggi/webmidi#48): its closed labels are short, *Default*, *Not heard*, the row's own name, *All: …* for every input's choice, each option's full meaning in its title; and the select takes the row name's whole width, on its own line under the name and IN. At Cell studio's 347 px drawer, the widest label takes 52 of 79 px. Nothing on the wire changes.

## v0.2.0 — 2026-11-04

What an input plays (decision 003, yggi/webmidi#43): one mechanism for whether an input is heard and which of the frontend's parts it plays, kept in the setup by row and role, filled in by preset (keyboard → lead, pads → drums), and sent as played (#29). It breaks a frontend's code, `Setup.heard` and `withHeard` gone, so it is a minor version: the migration is under *Changed*. A setup's file is now version 2, which a frontend still on 0.1 refuses in words. Nothing on the wire changes.

### Changed
- **What an input plays replaces what it heard: one mechanism** (yggi/webmidi#43, decision 003). This breaks a frontend's code, so the next release is a minor version.
  - `Setup.plays`, by input row: `'none'` (not heard), `'default'`, or one of the frontend's rows kept with its role.
  - `ANY_INPUT`'s choice is every input's without one of its own. It is the setup's, the same in every context.
  - A book kept before reads its `heard` as the inputs playing the default (`'all'` as `ANY_INPUT`), so nothing a person chose is lost.
  - `PatchMatrix`'s Heard switch is now a Plays choice on each input row.
  - `forwardsOfInput` forwards by every input's row (`ANY_INPUT`) only an input that is heard.

  **Migration:**
  - `setup.heard` → `heardOf(setup)` (`'all'` or the ports), or `isHeard(setup, port)`;
  - `withHeard(book, ports)` → `withPlays(book, inputRow(port), 'default' | 'none')`, and `withHeard(book, 'all')` → `withPlays(book, ANY_INPUT, 'default')`;
  - `portsOf(...).listen` now gives the inputs heard and routed (`listenOf`).
  - A setup's file (`exportSetup`, `.midisetup.json`) is now version 2. `importSetup` reads version 1 and 2 (a version 1 file's inputs heard as playing the default); a frontend still on webmidi 0.1 refuses a version 2 file with "saved by a newer version: update the app", rather than read it as hearing nothing.

  Nothing on the wire changes.

### Added
- **Inputs assigned by preset, and sent as played** (yggi/webmidi#43, #29; decision 003):
  - `playsOf(book, input, rows)` gives the row an input plays among the frontend's rows: its own, else the first of its role, else the default.
  - `guessKind(name)` gives an input's kind (keyboard, pads, controller) from its port's name.
  - `applyPreset(book, preset, inputs, rows)` fills in, by kind and the rows' roles (`DEFAULT_PRESET`: keyboard → lead, pads → drums), only the inputs with no choice. `PatchMatrix`'s `preset` prop shows its button.
  - `MatrixRow.role` gives a row's role.
  - `forwardsAsPlayed` sends an input's messages wherever the row it plays is sent (Cell studio's keys thru).

## v0.1.4 — 2026-11-04

What Cell studio's and Jambot's moves onto the patchbay (yggi/cell-studio#538, yggi/jambot#560) found. The machinery both frontends wrote for themselves is now in core: a setup's ports adopted without a custom variant (`portsOf`, `namePorts`) and what an input row's crossing forwards (`forwardsOf`, `forwardsOfInput`). In `PatchMatrix`: the clock is the first row, the matrix fits a narrow drawer, a kit member's drum note is edited in it, a locked matrix keeps the inputs and the clock editable, and the GM mark tells the truth. The connect button takes a name, and `listen` takes a setup's heard inputs. Nothing on the wire changes, and nothing breaks a frontend's code: `PortAccess.listen` widens to `Listened` (a string means what it did), and a frontend's own fake that declares `listen(id: string)` still types, so it is a patch. A frontend that keeps only part of a locked matrix's book (Cell studio keeps the Heard switches) takes the inputs' crossings, `clock` and `devices` from it too when it moves its pin.

### Added
- **What an input row's crossing sends, in one place** (yggi/webmidi#32), `core/forward.ts`: `forwardsOf(book, context, row, data)` gives each output's bytes for a raw message, a channel voice message (0x80–0xEF) with its channel replaced, or kept for `AS_PLAYED`, and nothing for a system message (0xF0–0xFF) or a message with no status byte; `forwardsOfInput` adds every input's row (`ANY_INPUT`), the same bytes to one output once. The frontend sends the bytes with its own timestamp. Cell studio's and Jambot's own forwarding can go; what each passes on then agrees. Nothing a frontend sends changes until it adopts it.
- **A setup's ports as plugged in now** (yggi/webmidi#28), `core/setup-ports.ts`: `portsOf(setup, access)` resolves each output to its live port, by id, else by name after a replug, and gives its heard inputs to listen to, changing nothing kept; `namePorts(book, plugged)` names the ports a store from before kept by id alone (Jambot's, through `fromJambot`), in every setup, their input rows too, and makes no custom variant. A frontend's own port adoption for a setup (Cell studio's) and its naming of ports (Jambot's `nameByPorts`) can go. `adoptPorts` stays for one port. Nothing on the wire changes.
- **`MidiAccess.listen` (and `PortAccess.listen`) takes several inputs** (yggi/webmidi#27): `Listened`, an id, `'all'`, `'none'`, or a list of ports (a setup's `heard`), each found by its id, else by its name, and listened to anew when the ports change; `isListened` says whether an input is among them. The string form works as before, and a frontend's own fake that listens by one id still types. A frontend that listened to all and filtered by name (Cell studio) can pass its heard inputs. Nothing on the wire changes.
- **A kit member's drum note is editable in `PatchMatrix`** (yggi/webmidi#24): a number 0–127 per output where the kit is routed, written to that device's profile (`withProfile`, no custom variant); its own General MIDI note again drops the entry. Cell studio's and Jambot's own drum-note editors can go at their next pin. Nothing on the wire changes.
- **`MidiStatus` takes its connect button's name** (yggi/webmidi#31): `connectLabel` (default "Connect") and `connectingLabel` (default "Connecting…"), so Jambot keeps "Connect MIDI". Additive; nothing on the wire changes.

### Changed
- **The clock is the first row of `PatchMatrix`** (the owner, 2026-11-04), a rule under it, where it was the last. Nothing on the wire changes.
- **`PatchMatrix` fits a narrow container** (yggi/webmidi#23): the matrix is a size container. A row's name wraps within at most 36 % of its width (96 px at least), with its tags (`IN`, Heard, a seat's part) on a line under it, and under 480 px the output heads are narrower. At 360 px with an input named 24 characters, two outputs show without scrolling, where none did. A frontend's own override for wrapping names (Cell studio's) can go. Nothing on the wire changes.
- **A locked `PatchMatrix` locks only the frontend's rows** (yggi/webmidi#22): on a piece routed by its own MIDI cards, the input rows and the clock row stay editable and call back through `onchange`; "+ Output" stays hidden, since the outputs are the piece's. A frontend that kept only the Heard switches from a locked matrix's `onchange` (Cell studio, yggi/cell-studio#538) takes the input rows' crossings and the clock from it too. Nothing on the wire changes.

### Fixed
- **The kit's "GM" mark on channel 10 shows only on an output whose drum map is General MIDI** (yggi/webmidi#30), where it showed beside a Circuit's map too. Nothing on the wire changes.

## v0.1.3 — 2026-11-04

The clock's estimate shown and its estimator exported, for Jambot's timing panel and its check against Jambot's own; the setups hardened. Nothing on the wire changes, and nothing breaks a frontend's code (new exports, a return type that widens), so it is a patch.

### Added
- **`clockOffset` shows its estimate** (yggi/webmidi#9): it returns an `EstimatedClockOffset`, a `ClockOffset` with `estimate` (`PairEstimate`, now exported): the offset, the bound of the reading trusted and the jumps followed, for a timing panel or report. `ClockOffset` itself is as it was, so a frontend's own fake of one still types. Jambot can read its jumps here and drop its own count (`apps/web/src/audio/output-estimate.ts`). Nothing on the wire changes.
- **`clockPair` is exported** (yggi/webmidi#10), with `PairConfig`, `PairSample` and `PairCarried`: the estimator `clockOffset` runs with `OUTPUT`, for a test or a frontend that runs it with another configuration. With `leap: Infinity` it is Jambot's estimator sample for sample (`src/core/clock-jambot.test.ts`). Nothing on the wire changes.

### Fixed
- **Setups hardened** (yggi/webmidi#15). A stored row or device named `__proto__` is now kept as one, where `fromCellStudio` wrote it onto `Object.prototype`, and `importSetup` and `readBook` set the object's prototype. A custom variant takes an id no setup has, where it could repeat one `readBook` had kept as a named setup. An exported setup's download is no longer dropped by an older Safari. `localBookStore` says why text that isn't JSON reads as nothing kept. Nothing on the wire changes, and no signature does.

## v0.1.2 — 2026-11-04

The patchbay's first three rungs (docs/proposals/patchbay.md): the setups model in `core` and the shared Svelte 5 components in `ui`, for Cell studio and Jambot to move onto. Nothing on the wire changes, and nothing breaks a frontend's code (new exports only, and an optional peer), so it is a patch.

### Added
- **`@yggi/webmidi/ui`**, the patchbay's Svelte 5 components, shipped as source with Svelte as an optional peer (`^5.57.2`, what Cell studio already has, so its pin moves without moving its Svelte; yggi/webmidi#13, yggi/webmidi#14): `MidiStatus` (the connection), `SetupPicker` (the setups, Save… with overwrite, save as new or discard), `PatchMatrix` (rows, inputs and the clock down, outputs across, with `ChannelPicker`), `DeviceInspector` (an output and its device's profile) and `ChannelMeter`. A frontend that doesn't import `ui` needs no Svelte. Nothing on the wire changes.
- **Setups** (decision 002, yggi/webmidi#12): the model the patchbay's components will share, in `core` (`setups.ts`). It holds device profiles kept by port name (drum map, bend range, MPE, latency), named setups (outputs, the inputs heard, routes per context with the inputs as rows, the outputs sent clock), and the book that keeps them. A change to a named setup is kept as its custom variant ("Home - custom"), saved at once, until it overwrites the named setup (`overwrite`), is saved under a new name (`saveAs`) or is discarded (`discard`). It suggests a setup whose devices are all plugged in, and writes a setup as a file and reads it back. `fromCellStudio` and `fromJambot` migrate each frontend's store once; web's `localBookStore` keeps the book in `localStorage`. Nothing on the wire changes, and nothing changes for a frontend until it adopts the model.

## v0.1.1 — 2026-10-17

The fakes for a frontend's tests, `@yggi/webmidi/testing`, and the v0.1.0 notes corrected. Nothing on the wire changes, and nothing breaks a frontend's code, so it is a patch.

### Added
- **`@yggi/webmidi/testing`**, the fake Web MIDI for a frontend's tests (yggi/webmidi#6): `fakeInput`, `fakePort`, `fakeAccess` and `fakeConnection` (core's), `installMidi`, `uninstallMidi` and `fakeListenedInput` (web's), typed in `types/testing/`, where `files` left them out before. Nothing on the wire changes. A frontend that keeps its own copy of the fakes (Cell studio's `src/midi/fixtures.ts`) can import these instead; only its tests may (`tools/layering.ts` holds webmidi's own sources to it).

### Corrected: what the v0.1.0 notes left out
The v0.1.0 entry spoke for Cell studio's move; Cell studio and Jambot, moving onto it, found more that a frontend sees. Nothing here changed since v0.1.0: the notes did.
- **`MidiOut` has no `setRoute`**: routing stays with the frontend, which turns its own notes into `OutNote`s, one per place its route sends a note.
- **`MidiOut.play` takes a run** (an array of `OutNote`s) for a glide, the first struck now and the others as `advance`'s horizon reaches each (or a single `OutNote`).
- **A pitch no key plays is dropped inside `play`** (outside 0–127, or not a whole number), so a frontend passes it on, and a run keeps its other notes' places.
- **A note's timestamp is `ParsedNote.timeStamp`** (ms on the page's clock), not a third argument of the handler: `onNote(note, source)`; `onMessage(data, source, timeStamp)` keeps its raw form.
- **`MidiAccess.connect({ onNote, onMessage, onChange }, { sysex })`**: the handlers first, the request second.
- **`ChosenPorts` needs `outPortName` and `inPortName`** beside the ids: a replugged port is found by its name; a frontend that keeps no names passes `''`, and a port is adopted by its id alone, as before.

## v0.1.0 — 2026-10-17

The first release: `core` and `web`, for Cell studio and Jambot to move onto (yggi/webmidi#3).

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
