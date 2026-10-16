# Agents

webmidi is the family's MIDI layer, shared by [Cell studio](https://github.com/yggi/cell-studio), [Jambot](https://github.com/yggi/jambot) and, later, [KO-Multitool](https://github.com/yggi/KO-Multitool): messages in, ports, the clock offset, notes and the clock out, as a package, `@yggi/webmidi`, each frontend consuming a tag. **Start with [docs/MEMORY.md](docs/MEMORY.md)**; [docs/INDEX.md](docs/INDEX.md) lists every page. The family of music projects and its rules: [yggi/music-commons](https://github.com/yggi/music-commons).

## Layers

Three, each a subpath export, the lower never importing the higher:

- **`core`** (`src/core/`, `@yggi/webmidi/core`): pure. No DOM, no Web MIDI, no timers: ports and clocks come in as interfaces (`MidiPort`, `PortAccess`, `OutputClock`), and the only host global is the one in `src/core/host.d.ts` (`performance`).
- **`web`** (`src/web/`, not yet written): the Web MIDI adapter (`requestMIDIAccess`, `onmidimessage`, the permission query). It may touch the browser.
- **`ui`** (`src/ui/`, not yet written): shared Svelte 5 components, shipped as source.

**Nothing here imports `@yggi/cells` or a frontend, and cells never imports webmidi.** The language keeps its own MIDI aspects, MIDI files and *when* a piece's clock ticks (`mainMeter`, `ticksBetween`); webmidi takes the wire. A frontend hands core its own events: a note as `OutNote` (time, duration, key, velocity, channel, a drum flag, cents and bends), the clock as the times of its ticks.

## Tools

- `npm run verify`: everything a push needs: `check` (the purity gate and the full typecheck), `lint`, `format:check`, `knip`, and the tests. A checkout with no `node_modules` (a fresh git worktree) is installed first (`tools/install-first.mjs`). A pre-push hook runs it (`.githooks/pre-push`; the first `npm run verify` in a clone points git at it, and so does the session-start hook: a `prepare` script would break a frontend's install, `tools/hooks.test.ts`) and blocks a push that fails, or one with an untracked file that verify would see and the commit lacks, keeping its whole output in the git directory (`webmidi-verify-failed.log`); a run that passes stamps its tree there (`tools/verified.sh`), so the push of that tree doesn't run it again, and the hook prints the count of tests that passed. Never bypass it with `--no-verify`.
- `npm run types`: rewrites `types/` (the declarations a frontend typechecks against, through the `types` condition of `exports`) from `src/`; a test fails when it is stale. Run it with any change to an exported signature.
- One file while iterating: `npx vitest run src/core/out.test.ts`.

## Rules

Enforced (a failing check says so):
- **Pure.** `src/core/` typechecks with no host types at all (`tsconfig.pure.json`); a host global beyond `src/core/host.d.ts` fails it.
- **Layered.** `tools/layering.ts`: nothing imports the language or a frontend, `core` imports no package and nothing above it, a relative import never leaves `src/`.
- The hub's `midi-rx` vectors run against core's parser (`src/contracts.test.ts`), each passing or recorded with its reason.
- `docs/INDEX.md` lists every page, relative links resolve, every decision is in `docs/MEMORY.md`'s list; the boot reading (this file and `docs/MEMORY.md`) stays under 16 KB (`tools/reading-list.ts`).
- Prettier owns whitespace; ESLint has no errors; knip finds no unused files, exports or dependencies.

Judgment (nothing checks these; you do):
- **The wire is what is shared.** A change to what goes out (a byte, a timestamp, an order) changes every frontend's hardware: say so in the pull request and in [CHANGELOG.md](CHANGELOG.md), and keep the tests' expected bytes unless the change is the point.
- **A release is a tag.** Frontends depend on `github:yggi/webmidi#vX.Y.Z`, never a branch, and read the changelog before they move it: a change a frontend would notice adds a line under *Unreleased*, and one that breaks a frontend's code names its migration. That is a minor version before 1.0.
- A decision with a rationale gets `docs/decisions/NNN-slug.md` and a line in `docs/MEMORY.md`.
- Code lifted from a sibling says where from in its first comment (`Lifted from yggi/<repo> <path> @ <commit>`); a JSON file, which has no comments, in a `lifted` field where it can take one, else in the commit that adds it.

## Working

- Work on the branch the session gives you; never push to `main`; **agents don't merge**. Open a pull request from the template (`Closes #n`, or `Part of #n` for one rung of an epic; what and why, the commit verified, follow-ups); keep it a draft while it moves, out of draft when it is ready.
- **Just do, no comment:** typos, nits, a local rename, an added test, fixing a check you broke. **Do and say in the pull request:** a fix beside your change that it needs. **File an issue instead of widening it:** anything out of scope you notice. **Stop, push back, recommend:** anything that changes what goes on the wire, a vector of the hub's contracts core would stop meeting, a change to the layering or to purity, anything that could break a frontend at its next pin (its install, its typecheck), a scope far beyond the issue, anything irreversible or outward-facing (a tag). Lifted from yggi/cells AGENTS.md @ 41ef16b.
- An issue meant for an agent states each bound as a number (a size, a count, a time), or says "choose it and name it".
- A tool's module and its test live side by side in `tools/` (`tools/<name>.ts`, `tools/<name>.test.ts`); the package's tests sit beside its code in `src/`.
- **CI is a witness, not the gate:** the workflow runs one job, only on pull requests out of draft. The gate is `npm run verify` before the push, which costs no Actions minutes. Say in the pull request which commit you verified.
