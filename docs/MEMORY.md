# Memory

Entrypoint for humans and agents: slow-change, shared knowledge about webmidi, and pointers into the code. The full hierarchy is [INDEX.md](INDEX.md).

## The project

The family's MIDI layer as a package, `@yggi/webmidi`, public, MIT. It came out of Cell studio's `src/midi/` and `src/layout/keyboard.ts` (at `3813fbb`), which had lifted Jambot's at `8cdb6b8` and gone further (pitch bend, MPE rotation, glides, Continue and Song Position, a replugged port found by name). The inventory and the plan are [yggi/cells#63](https://github.com/yggi/cells/issues/63); where it lives is [decision 001](decisions/001-a-midi-layer-of-its-own.md).

Its frontends: Cell studio and Jambot, then KO-Multitool. The language, [yggi/cells](https://github.com/yggi/cells), is a sibling, not a dependency: cells keeps MIDI files and when a piece's clock ticks, webmidi the wire.

## The family

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts. Core runs `midi-rx` version 1 (`src/contracts.test.ts`, the vectors copied into `fixtures/contracts/` with the hub's commit): 6 vectors pass, a note-off's release velocity among them, and 11 are outside the layer core reads (framing is the browser's; core reads notes and the sustain pedal, and a frontend gets every other message raw). The pitch-bend and transport vectors are checked against what core writes. Cells writes pitch bends into MIDI files with its own copy of the encoding; the duplication is accepted, and the contract's bend vectors are the one encoding both are held to (core is checked here; cells doesn't run `midi-rx`).

## Map of src/core/

`index.ts` is the surface, `@yggi/webmidi/core`; every module is re-exported there.

- `surfaces.ts` a raw message to a note or the sustain pedal; the computer's keys and drum keys; `ignoreKeyEvent` (a field, a repeat, a modifier), duck-typed
- `keyboard.ts` the on-screen keyboard's layout, its keys' names, a strike's velocity by height
- `drum-presets.ts` drum maps by General MIDI note (GM, Novation Circuit), `deviceNote` out and `gmNotesFor` back
- `port.ts` what a port and a connection are (`MidiPort`, `PortOption`, `PortAccess`); `routing.ts` adopting the ports chosen, a replugged one by its name; `fixtures.ts` the tests' fake Web MIDI (not shipped)
- `clock.ts` the audio clock against the page's (`clockOffset`): the pair estimate, its slew, jumps confirmed, a `leap` followed at once
- `bend.ts` cents as 14-bit bends, a note's bends with ramps sampled; `rotation.ts` MPE channels
- `out.ts` `MidiOut`: `OutNote`s to a port, timestamped, note-offs kept after their note-ons, retriggers, drum maps, silencing that cuts nothing sent since; a run (a glide) struck as the horizon reaches each note
- `clock-out.ts` `ClockOut`: 24 ticks a beat from the times a frontend passes in, Start, Stop, Continue and Song Position
- `sysex.ts` whole SysEx messages out of a byte stream (`SysexAssembler`, lifted from ep133-sysex)
- `host.d.ts` the one host global core uses

## Map of src/web/

`index.ts` is the surface, `@yggi/webmidi/web`. Lifted from Cell studio's `src/midi/access.ts` @ 85175ce and KO-Multitool's `src/lib/transport/midi.ts` @ 8b4b49e, merged: one place asks for Web MIDI.

- `access.ts` `requestAccess(sysex)` (the browser's `MIDIAccess`, or a throw) and `MidiAccess.connect` (a connection, or in words why none: never throws), the permission query (`granted`), the ports plugged in (a disconnected one isn't listed), an input listened to (notes parsed, every message raw), `close`; `readEnvironment` for a diagnostic. `MidiAccess` is core's `PortAccess`, so `connectMidi` and `adoptPorts` take it.
- `ports.ts` every port in full, unplugged ones too (`listPorts`), and `guessPort` by patterns a frontend gives (KO-Multitool keeps the EP-133's)
- `transport.ts` `SysexTransport`, the shape a device's protocol needs (ep133-sysex's `Transport`, met structurally: `transport.test.ts` holds it to a copy), and `MidiTransport` over an input (by `addEventListener`, so `onmidimessage` stays `MidiAccess`'s) and an output, capturing each message and counting how the browser delivered it
- `fixtures.ts` the tests' fake `navigator.requestMIDIAccess` (not shipped)

## Gates

Gates that show themselves only by failing, and what fixes each: `types/` stale (`npm run types`); a host global in core (the purity typecheck: the code moves to `web`); a Node global in web (`tsconfig.web.json`: the browser's instead); an import of the language, a frontend, a layer above, or a package in core or web (`tools/layering.ts`: no command, the import goes); a vector of the hub's `midi-rx` neither run nor recorded (`src/contracts.test.ts`: a decision, no command); the boot set, `AGENTS.md` with this page, over 16 KB (`tools/reading-list.ts`: condense it, as a change of its own).

## Decisions

One line each; the record has the rationale. → [decisions/](decisions/README.md)

- 001 · A MIDI layer of its own: a repository beside cells, three layers (`core` pure, `web`, `ui`), never importing cells; cells keeps MIDI files and its ticks · → decisions/001-a-midi-layer-of-its-own.md
