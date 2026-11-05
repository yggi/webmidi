# Memory

Entrypoint for humans and agents: slow-change, shared knowledge about webmidi, and pointers into the code. The full hierarchy is [INDEX.md](INDEX.md).

## The project

The family's MIDI layer as a package, `@yggi/webmidi`, public, MIT. It came out of Cell studio's `src/midi/` and `src/layout/keyboard.ts` (at `3813fbb`), which had lifted Jambot's at `8cdb6b8` and gone further (pitch bend, MPE rotation, glides, Continue and Song Position, a replugged port found by name). The inventory is [yggi/cells#63](https://github.com/yggi/cells/issues/63) (closed); the frontends' moves are the epic [#3](https://github.com/yggi/webmidi/issues/3); where it lives is [decision 001](decisions/001-a-midi-layer-of-its-own.md).

Its frontends: Cell studio and Jambot, then KO-Multitool. The language, [yggi/cells](https://github.com/yggi/cells), is a sibling, not a dependency: cells keeps MIDI files and when a piece's clock ticks, webmidi the wire.

## The family

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts. Core runs `midi-rx` version 1 (`src/contracts.test.ts`): 6 vectors pass, 11 are outside the layer core reads; the pitch-bend and transport vectors are checked against what core writes, and cells' own copy of the bend encoding is held to them too ([architecture.md](architecture.md#the-contracts)).

## Map

Module by module: [architecture.md](architecture.md).

- `src/core/` (`@yggi/webmidi/core`, pure): a message read (`surfaces.ts`), the keyboard's layout, drum maps, ports and adopting them (`port.ts`, `routing.ts`), the clock offset (`clock.ts`), bends and MPE, notes out (`out.ts`, `MidiOut`), the clock out (`clock-out.ts`), the patchbay's book (`setups.ts` and its neighbours, decisions 002 and 003), SysEx assembled (`sysex.ts`)
- `src/web/` (`@yggi/webmidi/web`): Web MIDI asked for and connected (`access.ts`), the ports in full (`ports.ts`), a SysEx transport (`transport.ts`), the book in `localStorage` (`book-store.ts`)
- `src/ui/` (`@yggi/webmidi/ui`): the patchbay's Svelte components, presentational, coloured by `--wm-*` custom properties
- `src/testing/` (`@yggi/webmidi/testing`, tests only): core's and web's fakes re-exported

## Gates

Gates that show themselves only by failing, and what fixes each: `types/` stale (`npm run types`); a host global in core (the purity typecheck: the code moves to `web`); a Node global in web (`tsconfig.web.json`: the browser's instead); an import of the language, a frontend, a layer above or beside, a package in core, web or testing, or a fake outside a test (`tools/layering.ts`: no command, the import goes); a vector of the hub's `midi-rx` neither run nor recorded (`src/contracts.test.ts`: a decision, no command); the boot set, `AGENTS.md` with this page, over 16 KB (`tools/reading-list.ts`: condense it, as a change of its own).

## Decisions

One line each; the record has the rationale. → [decisions/](decisions/README.md)

- 001 · A MIDI layer of its own: a repository beside cells, three layers (`core` pure, `web`, `ui`), never importing cells; cells keeps MIDI files and its ticks · → decisions/001-a-midi-layer-of-its-own.md
- 002 · Setups: a device's profile by port name, shared by every setup; the routes in the setup, by context; the inputs as rows of the matrix, thru a crossing · → decisions/002-setups-device-profiles-and-inputs-as-rows.md
- 003 · What an input plays: one mechanism for heard and assigned (`none`, `default`, a row kept with its role), the setup's in every context; a preset fills it in by an input's kind; forwarding as played · → decisions/003-what-an-input-plays.md
