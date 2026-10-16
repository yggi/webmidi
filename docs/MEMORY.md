# Memory

Entrypoint for humans and agents: slow-change, shared knowledge about webmidi, and pointers into the code. The full hierarchy is [INDEX.md](INDEX.md).

## The project

The family's MIDI layer as a package, `@yggi/webmidi`, public, MIT. It came out of Cell studio's `src/midi/` and `src/layout/keyboard.ts` (at `3813fbb`), which had lifted Jambot's at `8cdb6b8` and gone further (pitch bend, MPE rotation, glides, Continue and Song Position, a replugged port found by name). The inventory and the plan are [yggi/cells#63](https://github.com/yggi/cells/issues/63); where it lives is [decision 001](decisions/001-a-midi-layer-of-its-own.md).

Its frontends: Cell studio and Jambot, then KO-Multitool. The language, [yggi/cells](https://github.com/yggi/cells), is a sibling, not a dependency: cells keeps MIDI files and when a piece's clock ticks, webmidi the wire.

## The family

The hub, [yggi/music-commons](https://github.com/yggi/music-commons), holds the contracts; `midi-rx`, what a MIDI receiver must deliver from a byte stream, is the one core answers to.

## Map of src/core/

`index.ts` is the surface, `@yggi/webmidi/core`; every module is re-exported there.

- `surfaces.ts` a raw message to a note or the sustain pedal; the computer's keys and drum keys; `ignoreKeyEvent` (a field, a repeat, a modifier), duck-typed
- `keyboard.ts` the on-screen keyboard's layout, its keys' names, a strike's velocity by height
- `drum-presets.ts` drum maps by General MIDI note (GM, Novation Circuit), `deviceNote` out and `gmNotesFor` back
- `host.d.ts` the one host global core uses

## Gates

Gates that show themselves only by failing, and what fixes each: `types/` stale (`npm run types`); a host global in core (the purity typecheck: the code moves to `web`); an import of the language, a frontend or a layer above (`tools/layering.ts`: no command, the import goes); the boot set, `AGENTS.md` with this page, over 16 KB (`tools/reading-list.ts`: condense it, as a change of its own).

## Decisions

One line each; the record has the rationale. → [decisions/](decisions/README.md)

- 001 · A MIDI layer of its own: a repository beside cells, three layers (`core` pure, `web`, `ui`), never importing cells; cells keeps MIDI files and its ticks · → decisions/001-a-midi-layer-of-its-own.md
