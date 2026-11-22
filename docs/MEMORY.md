# Memory

Entrypoint for humans and agents: slow-change, shared knowledge about webmidi, and pointers into the code. The full hierarchy is [INDEX.md](INDEX.md).

## The project

The family's MIDI layer as a package, `@yggi/webmidi`, public, MIT. It came out of Cell studio's `src/midi/` and `src/layout/keyboard.ts` (at `3813fbb`), which had lifted Jambot's at `8cdb6b8` and gone further (pitch bend, MPE rotation, glides, Continue and Song Position, a replugged port found by name). The inventory is [yggi/cells#63](https://github.com/yggi/cells/issues/63) (closed); the frontends' moves are the epic [#3](https://github.com/yggi/webmidi/issues/3); where it lives is [decision 001](decisions/001-a-midi-layer-of-its-own.md).

Its frontends: Cell studio and Jambot, then KO-Multitool. The language, [yggi/cells](https://github.com/yggi/cells), is a sibling, not a dependency: cells keeps MIDI files and when a piece's clock ticks, webmidi the wire.

## The family

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts. Core runs `midi-rx` version 1 (`src/contracts.test.ts`): 12 vectors pass (6 read as a player's notes, 6 more by the wire's reader, `readChannelMessage`), 5 are outside the layer core reads; the pitch-bend and transport vectors are checked against what core writes, and cells' own copy of the bend encoding is held to them too ([architecture.md](architecture.md#the-contracts)).

## Map

Module by module: [architecture.md](architecture.md).

- `src/core/` (`@yggi/webmidi/core`, pure): a message read (`surfaces.ts` for a player, `messages.ts` the wire both ways), the keyboard's layout, drum maps, ports and adopting them (`port.ts`, `routing.ts`), the clock offset (`clock.ts`), bends and MPE, notes out (`out.ts`, `MidiOut`), the clock out (`clock-out.ts`), the link measured and rated (`link.ts`, decision 009), the patchbay's book (`setups.ts` and its neighbours, decisions 002, 003 and 010), SysEx assembled (`sysex.ts`)
- `src/core/panels/` (`@yggi/webmidi/panels`, pure, decision 005): a control panel kept, its expressions, instantiated, played (`PanelRuntime`), the library
- `src/web/` (`@yggi/webmidi/web`): Web MIDI asked for and connected (`access.ts`), the ports in full (`ports.ts`), a SysEx transport (`transport.ts`), the book in `localStorage` (`book-store.ts`), the link probed (`link-probe.ts`)
- `src/ui/` (`@yggi/webmidi/ui`): the patchbay's Svelte components (Measure link among them: what is measured, what is assumed, the tiers speculative), presentational, coloured by `--wm-*` custom properties
- `src/ui/panels/` (`@yggi/webmidi/ui/panels`): a panel to play (`PanelView`), its widgets, the on-screen keyboard (`Keys`)
- `site/`: the standalone patchbay page (Vite; `npm run site`), published by hand (`.github/workflows/site.yml`); not in the package
- `src/testing/` (`@yggi/webmidi/testing`, tests only): core's and web's fakes re-exported, and a fake loop (`loop.ts`)

## Gates

Gates that show themselves only by failing, and what fixes each: `types/` stale (`npm run types`); a host global in core (the purity typecheck: the code moves to `web`); a Node global in web (`tsconfig.web.json`: the browser's instead); an import of the language, a frontend, a layer above or beside, a package in core, web or testing, or a fake outside a test (`tools/layering.ts`: no command, the import goes); a vector of the hub's `midi-rx` neither run nor recorded (`src/contracts.test.ts`: a decision, no command); the boot set, `AGENTS.md` with this page, over 16 KB (`tools/reading-list.ts`: condense it, as a change of its own).

## Decisions

One line each; the record has the rationale. → [decisions/](decisions/README.md)

- 001 · A MIDI layer of its own: a repository beside cells, three layers (`core` pure, `web`, `ui`), never importing cells; cells keeps MIDI files and its ticks · → decisions/001-a-midi-layer-of-its-own.md
- 002 · Setups: a device's profile by port name, shared by every setup; the routes in the setup, by context; the inputs as rows of the matrix, thru a crossing · → decisions/002-setups-device-profiles-and-inputs-as-rows.md
- 003 · What an input plays: one mechanism for heard and assigned (`none`, `default`, a row kept with its role), the setup's in every context; a preset fills it in by an input's kind; forwarding as played · → decisions/003-what-an-input-plays.md
- 004 · The built-in as an output: this device's own sound a column of the matrix, first, kept in the setup, its crossings the rows it plays; no device, no MIDI, not counted; the frontends' switches dissolve into it · → decisions/004-the-built-in-as-an-output.md
- 005 · Control panels: a panel is data and a virtual device (a row and a column of the matrix, no port named), its strips instances of one template, its formulas a total language parsed here; `@yggi/webmidi/panels`, outside 1.0 · → decisions/005-control-panels.md
- 006 · A port kept is its name's: found by its name once known (an id may be another device's after a replug), by its id only when kept without a name; one port to one output (`matchPorts`) · → decisions/006-a-port-kept-is-its-names.md
- 007 · Panels in the patch: a setup names its active panels (`Setup.panels`), each a row and a column under `panel:<id>`; a panel is no port (`panelForwardsOf`, a `PanelRack`), and only inputs' and panels' rows cross its column; amended: a panel's row takes a Plays choice as an input's does, `'none'` by default (`panelPlays`) · → decisions/007-panels-in-the-patch.md
- 008 · Silencing is two things: `panic(…, { tail })` the state-based stop (notes sent ahead sound on up to `tail` seconds, 0 cuts), `sweep` the stateless panic button (All notes off, All sound off, sustain off on every channel) · → decisions/008-silencing-is-two-things.md
- 009 · The link is measured in parts (loop, page lag; one way is an assumption), rated in two tiers (scheduled, played) from named limits that stay labelled speculative until hardware numbers replace them; the probe goes out only on a button · → decisions/009-the-link-measured-in-parts.md
- 010 · A crossing of several channels: `Crossing` is `AS_PLAYED`, a channel, or a set of 2+ distinct channels ascending (a set of one is the bare number); one message per channel; the file is version 3 only when it holds a set; the picker takes several pads, the chip says "1+3" · → decisions/010-a-crossing-of-several-channels.md
- 011 · An absent crossing sends nothing: the book does not say "still on the frontend's defaults"; Cell studio's old-store migration stays app-side (`legacy` routes), a resolver in `fromCellStudio` is left for an old store that needs it · → decisions/011-an-absent-crossing-sends-nothing.md
- 012 · What 1.0 promises: `core`, `web`, the patchbay's `ui` and `testing` (additive fakes), not the panels' subpaths; `ClockOut`'s wire as documented, no waiting for the hub's `sync`; source, not compiled JavaScript · → decisions/012-what-1-0-promises.md
