# Changelog

What changed in webmidi, newest first: what a frontend (Cell studio, Jambot, KO-Multitool) reads before it moves its pin, `github:yggi/webmidi#vX.Y.Z`.
A release is a tag, and it gathers the entries under *Unreleased* and those in [`changes/`](changes/), where what isn't released yet is, beneath its own heading.
An entry says whether what goes on the wire changes; one that breaks a frontend's code names its migration, and before 1.0 it makes the next release a minor version.

Format: [Keep a Changelog](https://keepachangelog.com/), as cells' (lifted from yggi/cells CHANGELOG.md @ 41ef16b, its form). Add a file to [`changes/`](changes/) in the pull request that makes the change ([`changes/README.md`](changes/README.md)).

## Unreleased

Entries not yet released are in [`changes/`](changes/), one file each; a release gathers them here (`npm run changelog -- gather`).

## v0.10.1 — 2026-11-21

A fix to the panel editor's Try, found by the Jambot agent wiring it (yggi/jambot#715; yggi/webmidi#83): with Try off, a key on a stage widget still sent to `onsend`, so an editor given the frontend's outputs could play real MIDI hardware. A frontend that passes `onsend` to `PanelEditor` should take this before showing the editor to anyone with hardware connected. Nothing on the wire changes for a panel played in `PanelView` and nothing breaks a frontend's code, so it is a patch.

### Fixed
- **`PanelEditor` sends nothing to `onsend` while Try is off** (yggi/webmidi#83): the stage was given `onsend` whether or not Try was on, and Try only decided whether a press chose, so with Try off a key on a stage widget (Enter or Space on a key, a pad or a button, an arrow, Home or End on a knob, a fader or an XY pad, a switch's click), or a drag that outlived Try's turning off, still sent to the frontend's outputs. The stage now sends through a gate read at each message, open only while Try is on, so nothing a control does with Try off reaches `onsend`; controls stay choosable by a press, Enter or Space, and turning Try off still releases every note held. A frontend that passes `onsend` to `PanelEditor` should take this before showing the editor to anyone with hardware connected. A standalone `PanelView` sends as before, and nothing else on the wire changes.

## v0.10.0 — 2026-11-21

A crossing of several channels on one output (decision 010; yggi/webmidi#25): the book widens, so a voice can be sent on 1 and 3 of one output, as a cells piece's MIDI cards ask. `Crossing` is now `number | readonly number[]`, which breaks a frontend's code that reads a crossing as a number, so it is a minor version: the migration is under *Changed*. Nothing on the wire changes for a setup with no set of channels, and a set of one is the bare number, so every stored book and file reads and writes as before.

### Added
- **A crossing of several channels on one output** (yggi/webmidi#25, decision 010): a voice can be sent on 1 and 3 of one output, a layered patch, which a cells piece's MIDI cards ask for. A crossing is `AS_PLAYED`, a channel 1–16, or a set of 2 or more distinct channels, ascending; a set of one is the bare number, so every book and file with one channel per crossing reads and writes exactly as before. `crossingFrom(v)` reads one spelling from anything (sorts, drops duplicates and elements that are no channel, one element becomes its number, none no crossing; a 0 in a set is dropped, as played isn't mixed in), and `channelsOf(crossing)` lists a crossing's channels (none for `AS_PLAYED`). `withCrossing` takes either and keeps that spelling. `ChannelPicker` has a *Several* toggle (on already for a set; each pad toggles, the crossing changes at once, *Done* closes; a pad pressed with it off picks one channel and closes as before), `PatchMatrix`'s chip says "1+3" (and "1+3+5", "×4" from four channels, its label and title naming every channel), and the inspector's channels routed to an output, the meter and the picker's busy marks list every channel of a set. `crossingText` and `crossingWords` (`@yggi/webmidi/ui`) say a crossing as the chip and as a label do. Wire output is unchanged for every setup with no set.

### Changed
- **`Crossing` is `number | readonly number[]`, and `forwardsOf`, `forwardsOfInput`, `forwardsAsPlayed` and `panelForwardsOf` send once per channel of a set** (yggi/webmidi#25, decision 010). **This breaks a frontend's typecheck at its next pin; migration:** (1) code that reads a crossing as a number (`crossingOf`'s result, a value of `setup.routes[context][row]`, a `Routes` value, `withCrossing`'s argument) takes its channels with `channelsOf(crossing)` (an array, empty for `AS_PLAYED`; test `crossing === AS_PLAYED` for as played) where it used the number, or narrows with `typeof crossing === 'number'` where only one channel makes sense; (2) code that hands `withCrossing` a channel is unchanged, and one that has several hands it an array; (3) a frontend's own `ChannelPicker` use: `value` is a `Crossing | undefined` and `onpick(value, more?)` has a second argument, true while the picker stays open for a set; (4) a message on a row crossed with a set is now sent once on each channel, ascending, each re-channelled; a system or clock message is not forwarded, as before. The setup's file is written at version 3 only when its setup holds a set (every other file stays version 2, which a reader before this one still reads, and a version 3 is refused by it in words); the book a frontend keeps stays version 1, and a reader before this one drops a set it finds in it. Nothing on the wire changes for a setup with no set.

## v0.9.0 — 2026-11-20

The panel editor tries and moves, found driving it in a browser (yggi/webmidi#68, #69): a control can be played while editing (`onsend`, a Try toggle) and moved into a group or out of its own, by one core operation that refuses in words what would change its meaning, and on a phone what is chosen is edited in a sheet at the bottom. Additive: an optional prop and core operations in a surface outside what 1.0 promises; `moveNode` takes what it took. Nothing on the wire changes and nothing breaks

### Added
- **`moveNode` moves a node into another group or out of its own, and `moveProblem` says why it can't** (yggi/webmidi#68; `@yggi/webmidi/panels`): `moveNode(panel, path, to)` takes `-1` or `1` as before (earlier or later among the siblings) or a `Destination` (`{ container, index }`: any group's children, or the panel's, or a template's, at the index the node will have there), so a place among the siblings is one case of a move to a container. `moveProblem(panel, path, container)` refuses, in words, a move into itself or a group inside it, one that would put a name where a sibling already has it (a control and a group share one key space), one that would carry a parameter (a template's, or a repeat's) to a place that doesn't have it, one into a template that the node uses, and one past `MAX_DEPTH`; `moveNode` then gives the panel as it was. `moveTargets` lists the groups a node can go into and `moveOutOf` the place right after its own group. Nothing on the wire changes.
- **`PanelEditor` tries a control while editing, and moves a control or a group into another group or out of its own** (yggi/webmidi#68): given the optional prop `onsend`, the editor shows a *Try* toggle in its tools row; while it is on the stage plays (a press plays the control through `onsend` and chooses nothing, and the choice and its inspector stay as they were), and turning it off releases every note held. Without `onsend` there is no toggle and the editor is as it was. With a node chosen, *Move into…* lists the groups it can go into by name (a group that uses a template stands for the template's body, so the node joins every instance) and *Move out* puts it right after its own group (absent at the top of the panel or a template); a move the core refuses (`moveProblem`) is said in words at the node. A move is one step of Undo, and the node stays chosen. The standalone page passes its patchbay's send, so Try plays there. Nothing on the wire changes.

### Changed
- **`PanelEditor` edits what is chosen in a sheet docked to the bottom where the two columns stack** (yggi/webmidi#69): below 760 px of the editor's own width (a phone) the inspector followed the whole panel, 450 px under the stage, so a control chosen and its binding meant scrolling down and back for each field. While something is chosen the inspector is now a sheet at the bottom of the editor, at most 40% of the viewport high, with the chosen thing's name and a close control (44 px), its bindings first and the other fields below, scrolling inside it; the control chosen is scrolled clear of the sheet. With nothing chosen the panel's own fields stay where they are, and wider than 760 px nothing changes. Nothing on the wire changes.

## v0.8.1 — 2026-11-16

The panel editor's plain fields and its undo, found driving it in a browser (yggi/webmidi#66, #67): a number that can't be read is refused in words where it was turned into another, and Undo and Redo keep what is chosen and answer Ctrl/Cmd+Z, Delete and Backspace. A fix, with `numberProblem` and `MAX_GRID` added in a surface outside what 1.0 promises. Nothing on the wire changes and nothing breaks a frontend's code, so it is a patch.

### Added
- **`numberProblem(field, text)` and `MAX_GRID`** (`@yggi/webmidi/panels`, yggi/webmidi#66): why a text typed into a plain number field (`'start'`, `'note'`, `'notes'`, `'span'`) can't be taken, in words, or undefined. `MAX_GRID` (64, the most columns a grid has and the furthest cell) is exported for the span's range. Additive.

### Fixed
- **`PanelEditor`'s Undo and Redo keep the control chosen, and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, Delete and Backspace work** (yggi/webmidi#67): Undo and Redo cleared the choice, so the inspector vanished after each step; they now keep it when the place is still in the panel they go to and clear it when it isn't. Ctrl or Cmd with Z undoes, with Shift (or Ctrl+Y) redoes, and Delete or Backspace removes the control or group chosen, only while focus is inside the editor and not in a text field or a select (which keep their own keys). Nothing on the wire changes.
- **`PanelEditor`'s plain number fields take what is typed or say why not** (yggi/webmidi#66): *Starts at* turned a word into 0 and held 7 to 1, *Notes* dropped a word among the pads' notes (`36, abc, 40` made four pads two), and *Lowest note*, *Highest note* and *Spans columns/rows* rounded a fraction or made a word nothing. Each is now read strictly: a text that isn't a number in the field's range (*Starts at* 0 to 1, notes 0 to 127, spans 1 to 64) is refused, the field goes back to what the panel holds and the note says the range. Nothing on the wire changes.

## v0.8.0 — 2026-11-16

The MIDI link measured (decision 009; yggi/webmidi#75, the MIDI side of yggi/jambot#27): a loop through a port timed in the parts one browser clock can tell apart, how stable it is, and a two-part tier (scheduled and played). Additive: nothing existing changes on the wire, and the probes go out only when a person presses *Measure link*. The thresholds of the tiers are a proposal and are marked speculative until hardware numbers replace them. A minor version for the new API.

### Added
- Core: `LinkMeter`, `linkTier` and `linkReport` (`link.ts`, yggi/webmidi#75, decision 009): the MIDI link measured from the times a frontend gives it, as a loop and the page lag (one way is the loop's half, an assumption), its jitter, drift, loss, order, duplicates and outliers, whether timestamps are honoured, two tiers (scheduled, played; the limits are speculative) and a JSON report. `nearestRank` is `thru.ts`'s percentile, shared.
- Testing: `fakeLoop`, an output wired to an input with a latency, jitter, drift, loss, reordering, duplicates, a page lag and timestamps honoured or not made, seeded, for testing a link's measurement without hardware.
- Web: `runLinkProbe`, which sends probes on an output and times them back on an input of a loop (a quick run of 100 probes in about 2 s, a long run of 600 in about 60 s), one out at a time, abortable, with progress, and resolves with a `LinkReport`. It sends only when called.
- UI: `LinkMeasure`, "Measure link" in an output's `DeviceInspector` and `DeviceDialog` (`onmeasure`, `inputs`, `onlinkreport`) and in `PatchMatrix`'s dialog (`onmeasure(key, run)`): the loop's input and the run chosen, progress and Stop, then the report in words, saying which numbers are measured (loop, page lag, jitter, drift, loss) and which assumed (one way), with the tiers marked speculative. It sends only when its button is pressed, and says so. `site/` wires it.

## v0.7.0 — 2026-11-16

Panels play a frontend's own voices (decision 007, amended; #71): a panel's row takes the Plays choice an input's does, for Cell studio's and Jambot's panels (yggi/cell-studio#671, yggi/jambot#703). Additive, `'none'` by default: nothing on the wire changes and nothing breaks a frontend's code, so it is a minor version for the new API. A book stays version 1 and a setup's file version 2; a reader from before this keeps the file's other fields and drops a panel's choice.

### Added
- **A panel's row takes a Plays choice, as an input's does** (decision 007, amended; #71): `Setup.plays` keys a panel by `panelKey(id)` beside an input's name, `'none'` by default and never what every input plays, so a setup that doesn't ask changes nothing. `choiceOf`, `playsOf` and `withPlays` read it as they read an input's; `heardOf` and `listenOf` still name inputs only, and no preset fills a panel in. `PatchMatrix` shows the same Plays choice on a panel's row where a frontend gives `heardBy`, and the built-in's column says through which row a panel plays. Taking a panel out of a setup takes its choice with it.
- **`panelPlays(book, panelId, rows, data)` and `playedBy(book, source, rows, data)`**: what a message plays among the frontend's rows (`{ plays, data }`: a row's id or `'default'`), or null when it is not heard or is no channel voice message; one rule for an input and a panel, so a frontend's adapter is one call per message `PanelRuntime` sends. `forwardsAsPlayed` takes a panel's row too. A message a panel is sent is played by no one.

## v0.6.1 — 2026-11-16

The panel editor made honest (found driving it in a browser): it says why a binding isn't read, refuses a change it would keep only in part or a name it would lose, and a field never says what the panel doesn't hold. A fix, with `nameProblem` added beside it in a surface outside what 1.0 promises. Nothing on the wire changes and nothing breaks a frontend's code, so it is a patch.

### Added
- **`nameProblem(panel, path, wanted)`** (`@yggi/webmidi/panels`): why a name asked for can't be taken, in words, or undefined. Additive.

### Fixed
- **`PanelEditor` says why a binding isn't read, refuses what it would lose, and never shows a field the panel doesn't hold.** A binding that couldn't be resolved said only "see what couldn't be read, under the panel's name", where the panel gave a count; the reasons (an unknown name, a channel out of 1 to 16, a number out of range) are now listed under the control, once each. A change the reader would keep only in part (an expression over 200 characters, say) is refused with a note, where it was taken and dropped what it couldn't keep; and a field whose change isn't taken is put back to what the panel holds, where it kept the text typed. A Name that isn't one the reader keeps (`a/b c`) or that a sibling, a control or a group, already has is refused in words, where it was taken and the control lost its key (a duplicate left the second out, said only in the panel's list). Nothing on the wire changes.

## v0.6.0 — 2026-11-16

Silencing in two parts (decision 008), for Jambot's move onto `MidiOut` (yggi/jambot#680): `panic` takes a `tail`, and `sweep` is a panic button that needs no record of what was sent. Additive, and a call without the new option sends what it sent; nothing on the wire changes and nothing breaks a frontend's code, so it is a minor version for the new API.

### Added
- **`MidiOut.panic` takes a `tail`, and `MidiOut.sweep`** (decision 008; yggi/jambot#680): `panic(now, toDeviceMs, { tail })` lets notes already sent ahead sound on for up to `tail` seconds (each released at its own end, a key two notes hold once, a bend put back after the last, no All notes off); `tail` 0, the default, is the cut it was, and `Infinity` lets every note sound out. `sweep(now, toDeviceMs, channels?)` sends All notes off, All sound off and sustain off on each channel (all sixteen by default), now, from nothing `MidiOut` knows, for a panic button after a reload or a replug; it counts as no use of a channel. Additive: a call without the new option sends what it sent, and nothing breaks a frontend's code.

## v0.5.0 — 2026-11-16

Control panels and a roomier patchbay: panels of controls kept as data (`@yggi/webmidi/panels`), played (`@yggi/webmidi/ui/panels`), edited, and made rows and columns of the matrix; every channel message read and written; an output's details in a dialog; a port found by its name. Nothing on the wire changes except for one case (a kept id that is another device's now, under *Changed*). `PatchMatrix` no longer docks the inspector or lists a kit's members as rows, which a frontend that did must follow, so it is a minor version: the migration is under *Changed*.

### Added
- **Every channel message, read and written** (`core/messages.ts`; rung 2 of the control surfaces' proposal, yggi/webmidi#57): `readChannelMessage` and `writeChannelMessage` over a `ChannelMessage` (note off and on, poly and channel aftertouch, control change, program change, pitch bend), named as the hub's `midi-rx` contract names them, a channel 0–15; `controlChange14` for a 14-bit controller; `parameterMessages` for an NRPN or an RPN, and `ParameterReader` to read them out of a stream of control changes. `parseMidiMessage` and `parseSustain` are as they were. Core now meets 12 of `midi-rx`'s 17 vectors (6 before), 5 being the browser's framing and the clock in. Additive: nothing existing changes on the wire, and nothing breaks a frontend's code.
- **`DeviceDialog`** (`@yggi/webmidi/ui`): the `DeviceInspector` as a dialog over the page, a sheet on a narrow screen. `DeviceInspector` takes `port` (the port its output is now) and `members`. `PatchMatrix` takes `ontest`, `onpanic` and `onbuiltin`. Core: `matchPorts`, `pluggedOf`, `spareOf`.
- **`PanelEditor`** (`@yggi/webmidi/ui/panels`; rung 6 of the control surfaces' proposal): a panel edited where it is drawn. A control or a group is pressed to choose it, every instance of one definition is marked, and a change is a change to all; a binding is one line (what it speaks, its number or an expression, its range, its channel) with what it comes to in each instance under it; a group's layout and repeat; add, move, duplicate, delete, undo and redo. It takes a panel and calls back the panel changed. `PanelView` takes `onselect` and `selected` for it. Core (`@yggi/webmidi/panels`): the editing operations (`nodeAt`, `updateNode`, `insertNode`, `removeNode`, `moveNode`, `duplicateNode`, `newControl`, `newGroup`, `containerOf`, `childrenAt`, `ofKind`, `samePath`), and each instance's `source`, its place in the panel (`NodePath`).
- **`ThruMeter`** (`@yggi/webmidi/core`): what a page adds to a message it passes on, from the port seeing it to the page sending it: the median, what 95 in 100 are within, the worst, over the last 256 (`delayText` says one).
- **`PatchMatrix`'s `builtIn.direct`**: for a built-in that plays MIDI itself, an input's and a panel's row cross it on or off. A frontend that doesn't pass it sees no change.
- **A panel to play: `@yggi/webmidi/ui/panels`** (decision 005; rung 4 of the control surfaces' proposal). `PanelView` lays a panel out (a group a row, a strip or a grid) and plays it through core's `PanelRuntime`: `onsend` with each message a touch makes, `receive` for what the panel's column is sent, full screen (or over the window where the browser has none), every note released on leaving. Its widgets: knob, fader, XY pad, button and switch, drum pads, and `Keys`, the on-screen keyboard (louder lower down, a slide across the keys, several fingers), exported on its own too. Several fingers move several controls. `@yggi/webmidi/panels` gains `EXAMPLE_PLAY`, a panel of every kind of control. A new subpath, outside what 1.0 promises; nothing in the patchbay names a panel yet. Nothing existing changes on the wire.
- **Panels in the patch** (decision 007; rung 5 of the control surfaces' proposal). A setup names its active panels (`Setup.panels`, optional; `withPanelActive`, `panelsOf`, `panelKey`, `isPanelKey`); `panelForwardsOf` says which panels a row's message goes to; `PanelRack` (`@yggi/webmidi/panels`) keeps a runtime for each, and `PanelRuntime.watch` tells a view when a value changes; `localPanelStore` (`@yggi/webmidi/web`) keeps the library in `localStorage`. `PatchMatrix` takes `panels` (the library's, by id and name) and `onpanel`: active panels are rows (routed like an input's) and columns (an input's or a panel's row crossed on or off), the others chips that add them. `PanelView` takes a `runtime` in place of a `panel`, to draw one the frontend keeps. `MatrixRow.kind` gains `'panel'`. A frontend that passes no `panels` sees no change, and `forwardsOf` sends nothing to a panel's column. Nothing existing changes on the wire.
- **Control panels, the pure part: `@yggi/webmidi/panels`** (decision 005; rung 3 of the control surfaces' proposal, yggi/webmidi#57). A panel is a layout of controls (button, switch, knob, fader, XY pad, label, keyboard, drum pads), each bound to MIDI messages both ways (`cc`, `cc14`, `note`, `program`, `bend`, `pressure`, `nrpn`, `rpn`), kept as data: `readPanel`, `instantiate` (groups repeated over a parameter, templates filled in, expressions resolved: `compileExpression`), `PanelRuntime` (a touch in, bytes out; a message in, the controls moved), `PanelLibrary` with `exportPanel` and `importPanel` (`.midipanel.json`), and `EXAMPLE_MIXER`. A new subpath, outside what 1.0 promises; no component yet, and nothing in the patchbay names a panel yet. Additive: nothing existing changes on the wire, and nothing breaks a frontend's code.

### Changed
- **A port kept is found by its name, one port to one output** (decision 006): `matchPorts` in core, read by `outputNow`, `adoptPorts`, `portsOf`, `fit`, `isListened`, the matrix and the inspector. A kept id that is another device's now (ports numbered by place, replugged in another order) is no longer taken for the device; two devices of one name are two ports, and the second can be added. **On the wire:** a setup whose kept id is now another device's sends nothing to that device, where it sent the first device's notes to it; an output found by its id and name, or by its name, is found as before. No migration.
- **`PatchMatrix`: an output's details open in a dialog, and the matrix holds the patch alone.** A kit's members (`kind: 'member'`) are no longer rows, and their notes are no longer typed in the matrix: each drum's note on a device is set in its details. **Migration:** a frontend that passes `onselect` and docks its own `DeviceInspector` keeps working, and passes the inspector `members` (`{ label, note }` of each member) to get the drums' notes back; or it drops `onselect`, `selected` and its inspector, passes `ontest` and `onpanic` (by output key), and the matrix opens the dialog itself. The `+ Output` button is gone: the devices plugged in that the setup has no output for are chips over the matrix, each adding its device (into a slot with no device where the setup has one). An output's × takes it out at once when nothing is routed to it, and asks first when routes would go with it. A slot with no device and no routes is no column. Nothing on the wire changes.

### Fixed
- **The inspector's port list shows the port an output is on after a replug** under another id, where it showed none chosen.
- An output's head is one height whatever it says, and a row's name stays beside its crossings in a wide room: the matrix is as wide as its columns.

### Repository
- **`npm run changelog -- gather` files an entry of several sections each part under its own heading** (yggi/cells#568): an entry with `### Added` and then `### Changed` no longer lands whole under its first heading, and `check` names an unknown heading anywhere in an entry, not only its first line. Ported from yggi/cells#623.
- **The standalone page** edits a panel, makes a new one and deletes one; says what it adds to each message it passes on, measured; and has a sound of its own (`site/synth.ts`, a small Web Audio synth as the built-in of its setups), which a first visit's keys play, with no device and no Web MIDI needed.
- **`site/`, the standalone patchbay page** (the patchbay's proposal, section 4): the connection, the setups, the patch and the panels on a page of their own, kept in `localStorage`. `npm run site` serves it and `npm run site:build` builds it; `.github/workflows/site.yml` publishes it on GitHub Pages, run by hand only. Not in the package. `vite` is now a dev dependency by name (8.3.8; it was there through vitest).

## v0.4.0 — 2026-11-08

The built-in as an output (decision 004): this device's own sound is a column of the matrix, kept in the setup, so the frontends' "play the built-in" switches dissolve into it. A setup's outputs can now include one that is no device, which breaks a frontend's code that sends to, numbers or counts them, so it is a minor version: the migration is under *Changed*. Nothing on the wire changes.

### Added
- **The built-in, this device's own sound, as an output of a setup** (decision 004): `BUILT_IN`, the matrix's first column where the frontend gives it a label (`PatchMatrix`'s `builtIn`), its crossings the rows it plays (`HEARD`, toggled in place, or shown only with `builtIn.rows: false`), added with *+ <label>* hearing every row it can play and removed by its × like any output. `withBuiltIn`, `hasBuiltIn`, `builtInHears`, `isBuiltIn`, `hardwareOutputs`; `MatrixRow.builtIn: false` for a row heard through another. Kept in the setup, so a setup can be MIDI only; read back once, first. Nothing on the wire changes: it sends no MIDI.

### Changed
- **A setup's outputs can include the built-in, which is no device**, so this breaks a frontend's code at its next pin: a frontend that sends to, numbers or counts a setup's outputs takes `hardwareOutputs(setup)`. Core already leaves it out where it should: `forwardsOf` sends it nothing, `outputNow` gives it no port, `fit` doesn't count it, `withClock` and `chooseDevice` leave it as it is, and the matrix numbers the outputs that send MIDI from 1 without it, so a piece's MIDI cards name the same slots; an output added takes its key among them too (`addOutput`), so the built-in beside them changes no key.

## v0.3.1 — 2026-11-08

A fix found moving Cell studio onto v0.3.0: an output's × stays on its head however wide the matrix. Nothing on the wire changes and nothing breaks a frontend's code, so it is a patch.

### Fixed
- **An output's × stays on its head in a wide matrix.** A matrix wider than its columns stretches each column, and the × sat at the column's right edge, away from the head it removes; the head and its × are now one box as wide as the head (`PatchMatrix`). Nothing on the wire changes.

## v0.3.0 — 2026-11-07

The patchbay made robust and easier to edit: inputs under one name (Android's multi-port devices) no longer break the page, an output is removed from the matrix's head, and setups and device profiles can be removed and forgotten. Nothing on the wire changes and nothing breaks a frontend's code; it is a minor version because `removeOutput` and `removeSetup` now act on the last output and the last named setup, where they did nothing, which a frontend's own guard (`canRemove`, say) may want to follow.

### Fixed
- **Inputs plugged in under one name no longer break the page.** Android names every port of a multi-port device after the device, and the patch matrix drew a row per port keyed by its name: a keyed list with one key twice throws in Svelte, and the page stopped redrawing (a lobby's Solo did nothing, the channel picker stayed open, a device plugged in wasn't shown). They are one row now, "2 ports" under its name, since the book keeps an input by its name (`inputRows`); the matrix draws each row id once whatever it is handed, and the `DeviceInspector` tells such ports apart by their place ("USB MIDI (2)"). Nothing on the wire changes.
- **The channel picker closes before the frontend's change runs**, so a change that throws leaves no picker open over the matrix.
- **`MidiAccess.listen` listens to the other inputs when one refuses a listener** (a port gone mid-look), where it threw and left the rest unheard.
- **`SetupPicker` says why a setup's file couldn't be read** instead of an unhandled rejection.

### Changed
- **The last output removed is left with no device** (`removeOutput`), its routes kept for the next device chosen, where it stayed as it was; and **the last named setup removed leaves a blank one** (`removeSetup`), the devices' profiles kept, where it stayed. A frontend's `canRemove` can now offer removal of a lone output with a device. Nothing on the wire changes.
- **Manage… works on a custom variant too**, renaming or removing its named setup (removed, the variant goes with it), where it was disabled while a change was unsaved.

### Added
- **An output removed from the matrix:** its head's × asks, then removes it (`PatchMatrix`; not on a piece's own outputs, nor on a lone output with no device).
- **`forgetDevice(book, name)`** and `DeviceInspector`'s `onforget`: a device's profile forgotten, back to the book's defaults, offered when the frontend passes it.

### Repository
- **What isn't released yet is in [`changes/`](changes/), one file per pull request** in place of a line under *Unreleased*, so that two pull requests no longer conflict on the changelog; a release gathers them here (`npm run changelog -- gather`), so the released sections a frontend reads before it moves its pin keep their form. Nothing on the wire or in the package changes.

## v0.2.1 — 2026-11-04

What the frontends' moves onto what an input plays found: a row an input can't play isn't offered (`MatrixRow.playable`, for Jambot's play-along parts), and an input's Plays choice is shown whole in a narrow drawer (Cell studio's). Nothing on the wire changes, and nothing breaks a frontend's code, so it is a patch; a frontend's test that reads a Plays option's text sees the short labels.

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
