# 003 · What an input plays: one mechanism for heard and assigned, kept by row and role, filled in by preset

**Date:** 2026-11-04 · **Status:** accepted (the owner, on #43) · Issues: [#43](https://github.com/yggi/webmidi/issues/43), [#29](https://github.com/yggi/webmidi/issues/29) · Amends [002](002-setups-device-profiles-and-inputs-as-rows.md)

## Context

Decision 002 kept, for each setup, the inputs the frontend hears (`heard`), apart from where they are sent (the input rows' crossings).
The owner then asked for MIDI in to be assignable per part, as in Cell studio, with presets ("keyboard to lead, drum-pads to drums"), the generic part in webmidi (yggi/jambot#560).
Cell studio had one "plays" choice for every input; Jambot sent whatever it heard to the Muse and the instruments.
An input that plays a part must be heard, so a separate `heard` and a separate assignment could contradict each other.

## Decision

- **One mechanism: what an input plays** (`Setup.plays`, by input row): `'none'` (not heard), `'default'` (heard, playing what the frontend plays by default), or one of the frontend's rows. It replaces `heard`.
  `ANY_INPUT`'s choice is every input's without one of its own, and an input with neither is not heard. A setup kept before reads as its `heard` inputs playing the default (`'all'` as `ANY_INPUT`).
- **Like the clock, it is the setup's, the same in every context.** A change to a named setup makes its custom variant, as any.
- **A chosen row is kept by its id and its role** (`'lead'`, `'drums'`). A frontend that lacks the row finds its row of that role, else the default. So "the Launchkey plays the lead" carries from one Cell studio piece to another, and from Cell studio to Jambot, whose row ids differ.
  The frontend gives its rows' roles (`MatrixRow.role`, `PlayableRow`), since webmidi doesn't know what a lead is.
- **A preset fills in what an input plays from its kind.** The kind (keyboard, pads, controller) is guessed from the port's name; a preset gives each kind a role (`DEFAULT_PRESET`: keyboard → lead, pads → drums, a controller nothing).
  It fills in only an input with no choice of its own: never over a person's, a "not heard" too.
- **Where an input is sent stays its row's crossings.** "Every input" (`ANY_INPUT`) forwards only inputs that are heard.
  **Sent as played** (`forwardsAsPlayed`) answers #29: an input's messages go wherever the row it plays is sent, as Cell studio's keys thru does. It needs no new kind of crossing.

## Consequences

- `Setup.heard` and `withHeard` go: a frontend reads `heardOf(setup)` or `isHeard`, and changes `withPlays`. That breaks a frontend's code at its next pin, so it is a minor version, the migration named in the changelog.
- `PatchMatrix`'s Heard switch becomes a Plays choice on each input row, and a preset's button fills in the rest.
- What a part *is* and playing it stay the frontends': Cell studio's keys, Jambot's instruments and Muse.
