# Proposal · The patchbay: shared MIDI components, saved setups, a standalone page

**Status:** proposal, for the owner's ruling · **Date:** 2026-11-04 · Part of [#3](https://github.com/yggi/webmidi/issues/3) (its `ui` line) · Mockup: [patchbay-mockup.html](patchbay-mockup.html) (published: <https://claude.ai/artifact/De3y5arDh6bSTDfzESgYkt>)

The goal is to move Cell studio's MIDI device config and its patch matrix into webmidi as components that Cell studio and Jambot share.
The proposal also covers a visual and functional pass on those components, and a generic way to store and choose between several MIDI setups.
The same components could also run on their own, as a Web MIDI patch panel.

## What exists

| | Cell studio (`55c6a93`) | Jambot (`7113d55`) |
|---|---|---|
| Panel | `src/ui/MidiPanel.svelte`, 459 lines: outputs, input, the matrix, pitch, keys and learn | `apps/web/src/components/SoundPanel.svelte`, 293 lines: one output, input, thru |
| State | `src/ui/state/midi.svelte.ts`, 870 lines: connection, storage, migration, lanes, routing | `apps/web/src/midi/settings.svelte.ts` and `device.svelte.ts` |
| Rows | A piece's voices, the kit and its members (cells' `rowsOf`, `channelTable`); read only when the piece's MIDI cards route it | 5 fixed parts (`DEFAULT_CHANNELS`: lead 1, bass 2, pad 3, stab 3, drums 10) |
| Columns | Up to 16 outputs, each a device | 1 output |
| Device facts | Drum map, clock, bend range and MPE rotation, each kept **by port name** | Drum map, clock (one of each) |
| Storage | One `localStorage` key, `cell-studio:midi`; routes per piece title; migrates the store from before the matrix | One key, `jambot-midi-v1`; migrates the drum notes |
| Saved setups | None | None |

Each panel does three things in one file: device facts (true of the hardware), a setup (which devices are in use, the input, the routes) and the frontend's own rows.
Only the rows differ between the frontends.

The open issues ask more of this same model:
- **jambot#108**: seats, meaning 16 stable channels per port, the five parts seated in them, the rest empty. These are rows of the same matrix.
- **jambot#382**: a tuning table per seat (port and channel), which is a device fact.
- **jambot#472**: MIDI out latency measured per synth at the venue. This is a device fact too, and the venue's rig is a setup of its own.
- **cells#380**: "an out is a card's entry". Once cells gives `outs()`, Cell studio's rows come from it rather than from `rowsOf`.
- **webmidi#3**: the `ui` line is open ("choose and name which components").

## Proposed

### 1. The model, in `core` (pure, tested)

- **`DeviceProfile`**, kept by port name: the drum map, clock out, bend range, MPE rotation, a latency offset in milliseconds, and later the tuning table (jambot#382).
  A device's profile is the same in every setup, because it describes the hardware.
- **`Setup`**, named: its outputs in order (port id and name, as `ChosenPorts` already keeps them), the input, thru and its channel, and the routes.
  Routes are kept **per context**, a string the frontend names (`piece:<title>` in Cell studio, `band` in Jambot, `bay` standalone).
  Within a context, routes map a row's id to the channel it gets on each output: 1 to 16, 0 for "as played", absent for not sent.
- **`SetupBook`**: the setups, the active one, and the device profiles.
  - `fit(setup, plugged)` counts how many of a setup's devices are plugged in, so the panel can suggest a setup whose devices are all present.
  - Export and import use one JSON file (`.midisetup.json`) with a `version` field.
  - Each frontend's current store gets a one-time migration into the book, so nothing a person chose is lost.
- **`BookStore`**: an interface with `load` and `save`, so core touches no storage.
  `web` has the `localStorage` implementation, under a key the frontend gives.
  Tests use an in-memory one.
- **Rows** come from the frontend as `{ id, label, kind: 'voice' | 'kit' | 'member' | 'input' | 'clock' | 'empty', note?, locked? }`.
  webmidi doesn't know what a voice is (decision 001: it never imports cells).

### 2. The components, in `ui` (Svelte 5 source, `@yggi/webmidi/ui`)

Each component is named in the mockup ("Show which shared component each part is").

| Component | What it does | Replaces |
|---|---|---|
| `<MidiStatus>` | Connection light and message, Connect, Refresh ports, All notes off | The status section of both panels |
| `<SetupPicker>` | The saved setups as chips, each showing how many of its devices are plugged in, with Save, Save as new, rename, delete, export and import; suggests a setup whose devices are all present | Nothing (new) |
| `<PatchMatrix>` | Rows down, outputs across. Each crossing is a jack: an empty hole, or a chip in the channel's colour. A tap opens a picker of 16 channel pads, marking channels already used on that output. Kit members show the note each device's map sends. Rows can be read only (a piece routed by its MIDI cards). Activity flashes the chips. | Cell studio's matrix of `<select>`s; Jambot's 5 number fields |
| `<DeviceInspector>` | The selected output: its port, and its device facts (clock, drum map, bend, MPE, latency), marked as kept with the device in every setup. A meter shows the 16 channels in use and their activity. Test note, notes off on this output, remove the output | Cell studio's "Outputs" extras and its separate "Pitch" section; Jambot's output group |
| `<InputStrip>` | Listen to, thru and its channel | Both panels' input sections |

Rules for the components:
- Svelte is a `peerDependency`, and the components ship as source.
- They take their colours from `--wm-*` custom properties, which each frontend maps to its own tokens. Without them, they fall back to a neutral palette that works in both themes.
- MIDI learn, the keys and the built-in sound stay with the frontends.

### 3. The visual and functional pass, as the mockup shows

- Channel colours, one hue per channel, are the same in the matrix, the picker and the meter. In Cell studio today, a channel is a number in one of 16 dropdowns per row.
- A device that isn't plugged in is drawn as such: struck out and amber, its routes kept. Today it is the text "Not connected" in a select.
- A device's settings sit in one place, the inspector. Today Cell studio splits them between "Outputs" and a "Pitch" section numbered by slot.
- Activity is shown on the output's light, on the jack, and on the channel meter.
- Each output has a test note, so a device can be found without playing a piece.
- On a phone, the matrix scrolls sideways under the sticky row names, and the inspector drops under it.

### 4. Standalone: the patchbay page

The same components on a page of their own, with inputs as the rows:
- Route each input to any outputs, and each crossing to a channel or "as played".
- Clock is a row: send it to the chosen outputs.
- Setups are saved and switched exactly as in the frontends.

Browser thru adds the page's jitter to each message, so the page measures what it adds before it claims to be a router (latency, as jambot#472 measures it).
**Recommended home:** a `site/` folder in this repository, built with Vite and published on Pages.
It doubles as the components' catalogue and as the place their end-to-end test runs on the fakes (`@yggi/webmidi/testing`).
It would be the first thing webmidi deploys.

## Rungs (each a pull request)

1. **Core:**
   - `DeviceProfile`, `Setup`, `SetupBook`, `BookStore`, `fit`, export and import, with their tests.
   - The two migrations, tested on stores copied from both frontends.
   - Nothing changes on the wire.
2. **`ui`, the layer itself:**
   - Svelte as a peer, the layering gate extended to `src/ui/`.
   - `<MidiStatus>`, `<InputStrip>`, `<DeviceInspector>` with component tests (choose the runner: `@testing-library/svelte` on jsdom recommended).
3. **`<PatchMatrix>` and `<SetupPicker>`**, then a release (the owner's tag).
4. **Cell studio** moves its panel onto them; `MidiPanel.svelte` and the storage half of `state/midi.svelte.ts` go. Its `state/midi` tests pass unchanged.
5. **Jambot** moves its panel onto them, with the seats of jambot#108 as its rows (its first slice: 16 seats, the five parts seated). The e2e checks run.
6. **The standalone page** (`site/`), if the owner rules it in.

## For the owner

1. **Device facts by port name, shared by every setup** (recommended), or each setup keeps its own copy of the facts? A shared copy means a Circuit's drum map is set once. A copy per setup lets the same synth have a different bend range at the venue.
2. **Routes per context inside a setup** (recommended), or the routes kept outside the setup by each frontend? Inside means a venue setup carries the band's patch with it. Outside keeps Cell studio's routes per piece as they are now.
3. **The standalone page in this repository, `site/`** (recommended), or a repository of its own? Either way, it would be webmidi's first deploy.
4. **Sharing setups between devices:** a file to export and import now; or later, the host's setup sent to clients through the lobby, as jambot#108 wants the seat plan to be the host's.
