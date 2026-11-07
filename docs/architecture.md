# Architecture

What lives where, module by module, layer by layer; the layers' rules are in [../AGENTS.md](../AGENTS.md), and [MEMORY.md](MEMORY.md) keeps the short map.

## Map of src/core/

`index.ts` is the surface, `@yggi/webmidi/core`; every module is re-exported there.

- `surfaces.ts` a raw message to a note or the sustain pedal; the computer's keys and drum keys; `ignoreKeyEvent` (a field, a repeat, a modifier), duck-typed
- `keyboard.ts` the on-screen keyboard's layout, its keys' names, a strike's velocity by height
- `drum-presets.ts` drum maps by General MIDI note (GM, Novation Circuit), `deviceNote` out and `gmNotesFor` back
- `port.ts` what a port and a connection are (`MidiPort`, `PortOption`, `PortAccess`); `routing.ts` adopting the ports chosen (`ChosenPorts`), a replugged one by its name; a frontend that keeps no port names passes `''` as `outPortName` and `inPortName`, and a port is adopted by its id alone; `fixtures.ts` the fake ports, access and connection, shipped through `@yggi/webmidi/testing`
- `clock.ts` the audio clock against the page's (`clockOffset`): the pair estimate, its slew, jumps confirmed, a `leap` followed at once
- `bend.ts` cents as 14-bit bends, a note's bends with ramps sampled; `rotation.ts` MPE channels
- `out.ts` `MidiOut`: `OutNote`s to a port, timestamped, note-offs kept after their note-ons, retriggers, drum maps, silencing that cuts nothing sent since; a run (a glide) struck as the horizon reaches each note
- `clock-out.ts` `ClockOut`: 24 ticks a beat from the times a frontend passes in, Start, Stop, Continue and Song Position
- `setups.ts` the patchbay's book (decision 002): device profiles by port name, named setups with their outputs, what each input plays (`plays`, decision 003), routes per context (inputs as rows, `AS_PLAYED`) and the outputs sent clock, a setup's fit to the ports plugged in, a setup as a file; `setups-from.ts` Cell studio's and Jambot's stores migrated once; `setup-ports.ts` a setup's live ports by id or name (`portsOf`), and ports kept by id named once they're seen (`namePorts`), neither making a custom variant; `plays.ts` what an input plays among a frontend's rows (`playsOf`, by row, else role), heard (`isHeard`, `heardOf`), listened to (`listenOf`); `input-kinds.ts` an input's kind by its port's name, presets (`applyPreset`); `forward.ts` what an input row's crossing sends (`forwardsOf`, `forwardsOfInput`): a channel message re-channelled or as played, no system message
- `sysex.ts` whole SysEx messages out of a byte stream (`SysexAssembler`, lifted from ep133-sysex)
- `host.d.ts` the one host global core uses

## Map of src/web/

`index.ts` is the surface, `@yggi/webmidi/web`. Lifted from Cell studio's `src/midi/access.ts` @ 85175ce and KO-Multitool's `src/lib/transport/midi.ts` @ 8b4b49e, merged: one place asks for Web MIDI.

- `access.ts` `requestAccess(sysex)` (the browser's `MIDIAccess`, or a throw) and `MidiAccess.connect` (a connection, or in words why none: never throws), the permission query (`granted`), the ports plugged in (a disconnected one isn't listed), an input listened to (notes parsed, every message raw), `close`; `readEnvironment` for a diagnostic. `MidiAccess` is core's `PortAccess`, so `connectMidi` and `adoptPorts` take it.
- `ports.ts` every port in full, unplugged ones too (`listPorts`), and `guessPort` by patterns a frontend gives (KO-Multitool keeps the EP-133's)
- `transport.ts` `SysexTransport`, the shape a device's protocol needs (ep133-sysex's `Transport`, met structurally: `transport.test.ts` holds it to a copy), and `MidiTransport` over an input (by `addEventListener`, so `onmidimessage` stays `MidiAccess`'s) and an output, capturing each message and counting how the browser delivered it
- `book-store.ts` `localBookStore`: the book in `localStorage`, nothing thrown when storage is refused
- `fixtures.ts` the fake `navigator.requestMIDIAccess` and a listened input, shipped through `@yggi/webmidi/testing`

## Map of src/ui/

`index.ts` is the surface, `@yggi/webmidi/ui`: the patchbay's components ([proposals/patchbay.md](proposals/patchbay.md)), presentational. A frontend owns the connection and the book, and passes in what they say; a component calls back with what was asked. Colours come from `--wm-*` custom properties, falling back to a neutral palette in both themes; `--wm-surface` is the ground the matrix's sticky names sit on.

- `MidiStatus.svelte` the connection: a light, the message, Connect, or Refresh ports and All notes off; the setup's devices missing
- `DeviceInspector.svelte` one output: its port (one not plugged in kept), its device's profile (clock, drum map, bend, MPE, latency, forgetting it), the channels routed to it, test note, notes off, remove; ports under one name told apart by their place
- `PatchMatrix.svelte` the patch: the clock first, then the frontend's rows (`rows.ts`, `MatrixRow`) and the inputs (`inputRows`, one row per name) down, the outputs across, each head with its × to remove it; a jack opens `ChannelPicker.svelte`; kit members' notes by each drum map; Heard per input; it takes the book and calls back a new one
- `SetupPicker.svelte` the setups as chips (devices plugged in, the custom variant marked), Save… (overwrite, save as new, discard), Manage… (rename or remove the named setup in use, a variant's too; the last removed leaves a blank one), the setup suggested, export and import
- `ChannelMeter.svelte` the 16 channels of an output, used and sounding; `channels.ts` a channel's hue, the same in every component
- `ui.svelte.test.ts` the components mounted in jsdom (`// @vitest-environment jsdom`; Svelte's browser build)

## src/testing/

`index.ts` is `@yggi/webmidi/testing`, for tests only: core's and web's `fixtures.ts` re-exported, so a frontend's tests drive the fakes webmidi's own do (yggi/webmidi#6). `testing.test.ts` holds it to its surface, to the web gate and to `npm pack`.

## The contracts

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts. Core runs `midi-rx` version 1 (`src/contracts.test.ts`, the vectors copied into `fixtures/contracts/` with the hub's commit): 6 vectors pass, a note-off's release velocity among them, and 11 are outside the layer core reads (framing is the browser's; core reads notes and the sustain pedal, and a frontend gets every other message raw). The pitch-bend and transport vectors are checked against what core writes. Cells writes pitch bends into MIDI files with its own copy of the encoding; the duplication is accepted, and the contract's bend vectors are the one encoding both are held to (core is checked here; cells doesn't run `midi-rx`).
