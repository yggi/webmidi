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
- A built-in that plays MIDI itself (the standalone page's synth) is crossed directly by an input's and a panel's row, on or off (`PatchMatrix`'s `builtIn.direct`, added 2026-11-15): the page plays such a row's messages on its own sound. Not yet: what a panel plays among a frontend's rows (decision 003's Plays), so in a frontend whose built-in plays its voices a panel is not heard on it.
- Two panels may send to each other; neither echoes what it receives, so nothing loops.
