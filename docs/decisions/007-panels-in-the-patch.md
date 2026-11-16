# 007 · Panels in the patch: a setup names its active panels, each a row and a column under one key, and a panel is no port

**Date:** 2026-11-15 · **Status:** accepted (the owner's rulings on the proposal, 2026-11-14 and 2026-11-15: panels a library of their own referenced by the setup, a panel receiving as a column of the matrix, sending on its own channels) · Builds on [002](002-setups-device-profiles-and-inputs-as-rows.md), [004](004-the-built-in-as-an-output.md) and [005](005-control-panels.md)

## Context

Decision 005 made a panel a virtual device and left open how the book says so. Three things had to be chosen: where the active panels are kept, what a panel's column is in a setup whose outputs are ports, and who delivers a message to a panel.

## Decision

- **A setup names its active panels** (`Setup.panels`, ids in order; `withPanelActive`, `panelsOf`). The field is optional and additive: a book from before has none, and a reader from before drops it and keeps the rest. The panels themselves stay in their library.
- **One key for both sides**, `panel:<id>` (`panelKey`): as a row of `routes` it is what the panel sends, routed like an input's row (to an output on a channel, or as sent); as a column in another row's crossings it is what the panel is sent. Its column is not an entry of `outputs`: nothing that numbers, counts or sends to a setup's outputs sees it.
- **A panel is no port.** `forwardsOf` sends nothing to a panel's column, so a frontend's sending is as it was; `panelForwardsOf` says which active panels a row's message goes to, re-channelled as a crossing says, never to the row's own panel. A `PanelRack` keeps one runtime for each active panel and hands them the messages, so a panel follows its device whether or not a view shows it.
- **Only rows the setup routes cross a panel's column**: an input's and another panel's. A frontend's own rows (a voice, a kit) are sent by the frontend from its notes, not from bytes, so the matrix offers no crossing there.
- **Taking a panel out takes its routes with it** (its row, and its column in every row and context), as removing an output does; the matrix asks first when there are any. A panel the library lacks stays in the setup, shown as missing, its crossings kept, as an unplugged device is.
- **A panel taken out mid-note is released where its row was crossed before the change**: the page routes the rack's note-offs by the book of before.

## Consequences

- The standalone page (`site/`) is the first to wire it: inputs and panels down, outputs and panels across.
- A built-in that plays MIDI itself (the standalone page's synth) is crossed directly by an input's and a panel's row, on or off (`PatchMatrix`'s `builtIn.direct`, added 2026-11-15): the page plays such a row's messages on its own sound. What a panel plays among a frontend's rows is the amendment below.
- Two panels may send to each other; neither echoes what it receives, so nothing loops.

## Amendment, 2026-11-16: a panel's row takes a Plays choice ([#71](https://github.com/yggi/webmidi/issues/71))

Cell studio (yggi/cell-studio#665) and Jambot (yggi/jambot#699) shipped panels without it: a knob or a key on a panel could not play their voices, since only an input's row had decision 003's Plays.

- **`Setup.plays` takes a panel's row key** (`panel:<id>`) beside an input's name, with the same three forms (`'none'`, `'default'`, a row kept by id and role). `choiceOf`, `playsOf`, `withPlays` and the matrix's Plays choice read it as they read an input's.
- **A panel is by default `'none'`**, and it does not follow `ANY_INPUT`'s choice: what every input plays is the inputs', and a setup that doesn't ask changes nothing. No preset fills a panel in (a preset assigns by an input's kind). Taking a panel out of the setup takes its choice with its routes.
- **The rule and its limit: what a panel's messages play is what the same bytes from an input play, nothing more.** One function, `playedBy`, answers for both; `panelPlays(book, id, rows, data)` is the frontend's one call per message a `PanelRuntime` sends. Only channel voice messages play (a `note` or a `cc` binding, and the other six kinds' messages, as an input's), and a message a panel is *sent* (feedback, `panelForwardsOf`) is played by no one: it only moves controls.
- **Where it goes after playing is the row's crossings**, as for an input (`forwardsAsPlayed` takes a panel's row too).
- **No version bump.** The book stays version 1 and a setup's file version 2: a reader from before keeps only `in:` rows of `plays` and drops a panel's, keeping every other field, which is the forward reading decision 003 asks for. The loss is silent in a reader that cannot know it; a reader of now keeps it.
- **The standalone page is as it was**: its synth plays panel rows directly (`builtIn.direct`), so it shows no Plays.
