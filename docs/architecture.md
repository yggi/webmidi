# Architecture

What lives where, module by module, layer by layer; the layers' rules are in [../AGENTS.md](../AGENTS.md), and [MEMORY.md](MEMORY.md) keeps the short map.

## Map of src/core/

`index.ts` is the surface, `@yggi/webmidi/core`; every module is re-exported there.

- `messages.ts` the wire both ways: every channel message read and written in the contract's terms (`readChannelMessage`, `writeChannelMessage`), a 14-bit controller (`controlChange14`), an NRPN or RPN written whole (`parameterMessages`) and read out of a stream of control changes (`ParameterReader`)
- `surfaces.ts` a raw message to a note or the sustain pedal; the computer's keys and drum keys; `ignoreKeyEvent` (a field, a repeat, a modifier), duck-typed
- `keyboard.ts` the on-screen keyboard's layout, its keys' names, a strike's velocity by height
- `drum-presets.ts` drum maps by General MIDI note (GM, Novation Circuit), `deviceNote` out and `gmNotesFor` back
- `port.ts` what a port and a connection are (`MidiPort`, `PortOption`, `PortAccess`), and which port plugged in a port kept is now (`matchPorts`, decision 006: by its name, one port to one kept); `routing.ts` adopting the ports chosen (`ChosenPorts`), a replugged one by its name; a frontend that keeps no port names passes `''` as `outPortName` and `inPortName`, and a port is adopted by its id alone; `fixtures.ts` the fake ports, access and connection, shipped through `@yggi/webmidi/testing`
- `thru.ts` what a page adds to a message it passes on (`ThruMeter`): the delay from the port seeing it to the page sending it, its median, what 95 in 100 are within, the worst, over the last 256
- `link.ts` the MIDI link measured from times a frontend gives (decision 009): `LinkMeter` matches probes (a control change on channel 16, numbered) and keeps the loop (`Tr − Ts`), the page lag (`Th − Tr`), jitter, drift (long runs only), loss, order, duplicates, outliers and whether timestamps are honoured; one way is loop / 2, an assumption; `linkTier` rates a scheduled and a played tier (speculative limits, `LINK_LIMITS`); `linkReport` is the JSON. `thru.ts` shares its nearest-rank percentile (`nearestRank`)
- `clock.ts` the audio clock against the page's (`clockOffset`): the pair estimate, its slew, jumps confirmed, a `leap` followed at once
- `bend.ts` cents as 14-bit bends, a note's bends with ramps sampled; `rotation.ts` MPE channels
- `out.ts` `MidiOut`: `OutNote`s to a port, timestamped, note-offs kept after their note-ons, retriggers, drum maps, silencing that cuts nothing sent since; a run (a glide) struck as the horizon reaches each note; `panic` with a tail, and `sweep` (decision 008)
- `clock-out.ts` `ClockOut`: 24 ticks a beat from the times a frontend passes in, Start, Stop, Continue and Song Position
- `setups.ts` the patchbay's book (decision 002; its active control panels, decision 007): device profiles by port name, named setups with their outputs, what each input plays (`plays`, decision 003), routes per context (inputs as rows, `AS_PLAYED`) and the outputs sent clock, a setup's fit to the ports plugged in, a setup as a file; `setups-from.ts` Cell studio's and Jambot's stores migrated once; `setup-ports.ts` a setup's live ports by id or name (`portsOf`), and ports kept by id named once they're seen (`namePorts`), neither making a custom variant; `plays.ts` what an input plays among a frontend's rows (`playsOf`, by row, else role), heard (`isHeard`, `heardOf`), listened to (`listenOf`), what a message plays (`playedBy`, and a panel's, `panelPlays`, decision 007); `input-kinds.ts` an input's kind by its port's name, presets (`applyPreset`); `forward.ts` what an input row's crossing sends (`forwardsOf`, `forwardsOfInput`; to a panel's column, `panelForwardsOf`): a channel message re-channelled or as played, no system message
- `sysex.ts` whole SysEx messages out of a byte stream (`SysexAssembler`, lifted from ep133-sysex)
- `host.d.ts` the one host global core uses

## Map of src/core/panels/

`index.ts` is the surface, `@yggi/webmidi/panels` (decision 005): control panels, the pure part, under core's gate and exported apart from `@yggi/webmidi/core`.

- `expr.ts` a panel's expressions: a total language (numbers, names, arithmetic, comparison, a conditional, eight functions), parsed and never `eval`ed, refused in words (`compileExpression`)
- `model.ts` a panel as it is kept: controls, bindings (`kind`, `number`, `range`), groups that nest, repeat over a parameter and use templates, the grid; `readPanel` from anything; `panelRow`
- `instantiate.ts` a panel resolved to what is drawn and played: groups repeated, templates filled in, every expression a number, each control with a key (`strips[3]/level`); what can't be resolved said and left out; at most 2,000 instances
- `edit.ts` a panel edited, each operation a new panel: a node by its place (`NodePath`, which every instance of one definition shares), updated, inserted (into its template for a group that uses one), removed, moved, duplicated; a new control bound so it does something at once
- `runtime.ts` `PanelRuntime`: a touch in, bytes out (only when the number on the wire changes); a message in, the controls moved (not echoed, a held control left); a keyboard's and a pads' notes; `silence`
- `library.ts` the panels kept (`PanelLibrary`, `PanelStore`), a panel as a file (`.midipanel.json`: `exportPanel`, `importPanel`)
- `rack.ts` `PanelRack`: a runtime for each panel a setup has active, kept while its panel is the same, silenced when it goes (decision 007)
- `examples.ts` `EXAMPLE_MIXER`: eight strips of one template, the model's test; `EXAMPLE_PLAY`: every kind of control

## Map of src/web/

`index.ts` is the surface, `@yggi/webmidi/web`. Lifted from Cell studio's `src/midi/access.ts` @ 85175ce and KO-Multitool's `src/lib/transport/midi.ts` @ 8b4b49e, merged: one place asks for Web MIDI.

- `access.ts` `requestAccess(sysex)` (the browser's `MIDIAccess`, or a throw) and `MidiAccess.connect` (a connection, or in words why none: never throws), the permission query (`granted`), the ports plugged in (a disconnected one isn't listed), an input listened to (notes parsed, every message raw), `close`; `readEnvironment` for a diagnostic. `MidiAccess` is core's `PortAccess`, so `connectMidi` and `adoptPorts` take it.
- `ports.ts` every port in full, unplugged ones too (`listPorts`), and `guessPort` by patterns a frontend gives (KO-Multitool keeps the EP-133's)
- `transport.ts` `SysexTransport`, the shape a device's protocol needs (ep133-sysex's `Transport`, met structurally: `transport.test.ts` holds it to a copy), and `MidiTransport` over an input (by `addEventListener`, so `onmidimessage` stays `MidiAccess`'s) and an output, capturing each message and counting how the browser delivered it
- `book-store.ts` `localBookStore`: the book in `localStorage`, nothing thrown when storage is refused; `panel-store.ts` `localPanelStore`: the panels' library, likewise
- `link-probe.ts` `runLinkProbe`: the link measured on an output and an input of a loop with timers (decision 009): 100 probes 20 ms apart or 600 100 ms apart, scheduled and at once in turn, one out at a time, abortable, with progress, a `LinkReport` at the end; it sends only when called, so only when a person presses the button
- `fixtures.ts` the fake `navigator.requestMIDIAccess` and a listened input, shipped through `@yggi/webmidi/testing`

## Map of src/ui/

`index.ts` is the surface, `@yggi/webmidi/ui`: the patchbay's components ([proposals/patchbay.md](proposals/patchbay.md)), presentational. A frontend owns the connection and the book, and passes in what they say; a component calls back with what was asked. Colours come from `--wm-*` custom properties, falling back to a neutral palette in both themes; `--wm-surface` is the ground the matrix's sticky names sit on.

- `MidiStatus.svelte` the connection: a light, the message, Connect, or Refresh ports and All notes off; the setup's devices missing
- `DeviceInspector.svelte` one output: its port (one not plugged in kept; found by its name, decision 006), its device's profile (clock, drum map and each drum's note where a kit is routed to it, bend, MPE, latency, forgetting it), the channels routed to it, test note, notes off, remove; ports under one name told apart by their place. `DeviceDialog.svelte` is it as a dialog over the page
- `LinkMeasure.svelte` "Measure link", in the inspector where a frontend gives `onmeasure` and `inputs` (and the matrix's dialog, by output key): the input of the loop and the run chosen, what it sends and that it sends only on the button said first, progress and Stop, then the report in words: what is measured (loop, jitter, page lag, loss, drift, timestamps honoured), what is assumed (one way, half the loop; wire time per byte, not measured), the tiers marked speculative, and the JSON (decision 009)
- `PatchMatrix.svelte` the patch, and nothing of a device's settings: over it the devices plugged in that the setup has no output for, each a chip that adds it; the clock first, then the frontend's rows (`rows.ts`, `MatrixRow`; a kit's members are not rows) and the inputs (`inputRows`, one row per name) down, the outputs across (the built-in first, where the frontend has one: decision 004), each head opening its details in a `DeviceDialog` (or calling the frontend's `onselect`), its × taking it out, asked about only when routes go with it; a slot with no device and no routes is no column; a jack opens `ChannelPicker.svelte`; Heard per input; it takes the book and calls back a new one
- `SetupPicker.svelte` the setups as chips (devices plugged in, the custom variant marked), Save… (overwrite, save as new, discard), Manage… (rename or remove the named setup in use, a variant's too; the last removed leaves a blank one), the setup suggested, export and import
- `ChannelMeter.svelte` the 16 channels of an output, used and sounding; `channels.ts` a channel's hue, the same in every component
- `ui.svelte.test.ts` the components mounted in jsdom (`// @vitest-environment jsdom`; Svelte's browser build)

## Map of src/ui/panels/

`index.ts` is the surface, `@yggi/webmidi/ui/panels` (decision 005): control panels to play, apart from `@yggi/webmidi/ui`.

- `PanelView.svelte` a panel laid out and played: a group a row, a strip (`columns: 1`) or a grid, each control its widget, driven by core's `PanelRuntime`; `onsend` with each message a touch makes, `receive` for what the panel's column is sent, `silence`; full screen, or over the window where the browser has none; what the panel couldn't resolve said under its name; every note released on leaving
- `PanelEditor.svelte` a panel edited: the panel as it will be played, a control or a group pressed to choose it (every instance of one definition marked), and what is chosen field by field: a binding in one line with what it comes to in each instance, a group's layout and repeat, add, move, duplicate, delete, undo; it calls back the panel changed, read through `readPanel`
- `Keys.svelte` the on-screen keyboard over core's `keyboardLayout`: louder lower down, a slide playing each key it crosses, several fingers; it stands on its own too, and carries the palette
- `Knob.svelte`, `Fader.svelte`, `XYPad.svelte`, `Toggle.svelte` (a button and a switch), `Pads.svelte`: the view's widgets, drawn from its palette; `drag.ts` a drag that keeps its pointer, so several fingers move several controls, and a slider's keys
- `panels.svelte.test.ts` the view and the keyboard mounted in jsdom

## site/

The standalone patchbay page ([proposals/patchbay.md](proposals/patchbay.md), section 4), not in the package: `npm run site` serves it, `npm run site:build` builds it into `dist-site/`, and `.github/workflows/site.yml` publishes that on GitHub Pages when run by hand.

- `bay.svelte.ts` `Bay`: what the page keeps and does: the connection, the book and the panels' library in `localStorage`, a `PanelRack`, a message from an input or a panel sent where its row is crossed (`forwardsOf`, `forwardsOfInput`, `panelForwardsOf`), a test note, all notes off, a panel's file in and out, a panel edited, made and deleted, the delay it adds measured (`ThruMeter`), and rows crossed with the built-in played on its own sound
- `synth.ts` the page's own sound, the built-in of its setups: a small Web Audio synth that takes MIDI (notes, drums on channel 10, the bend, the pedal, volume and filter), so a panel sounds with no device, and where there is no Web MIDI
- `App.svelte` the page drawn: `MidiStatus`, `SetupPicker`, `PatchMatrix` (inputs and panels down, outputs and panels across, no clock), the panel being played (`PanelView` over the rack's runtime), the last messages through the patch
- `bay.svelte.ts` also `measureLink`: an output's link measured over the input of its loop (`runLinkProbe`), the probes heard back on an input not passed on while it runs
- `bay.svelte.test.ts` the page end to end on the fake Web MIDI

## src/testing/

`index.ts` is `@yggi/webmidi/testing`, for tests only: core's and web's `fixtures.ts` re-exported, so a frontend's tests drive the fakes webmidi's own do (yggi/webmidi#6). `loop.ts` `fakeLoop`: an output wired to an input with a latency, jitter, drift, loss, reordering, duplicates and a page lag made, seeded, on timers and `performance.now()` (yggi/webmidi#75). `testing.test.ts` holds it to its surface, to the web gate and to `npm pack`.

## The contracts

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts. Core runs `midi-rx` version 1 (`src/contracts.test.ts`, the vectors copied into `fixtures/contracts/` with the hub's commit): 12 vectors pass, and 5 are outside the layer core reads (framing, which is the browser's, and the clock in). 6 pass as a player's reader delivers them (`parseMidiMessage`, `parseSustain`), a note-off's release velocity among them; those and 6 more pass through the wire's reader (`readChannelMessage`) as the vectors spell them: a note-on at velocity 0, control changes, the bends, aftertouch, a program change. The pitch-bend and transport vectors are checked against what core writes. Cells writes pitch bends into MIDI files with its own copy of the encoding; the duplication is accepted, and the contract's bend vectors are the one encoding both are held to (core is checked here; cells doesn't run `midi-rx`).
