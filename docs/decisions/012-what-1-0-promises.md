# 012 · What 1.0 promises: core, web, the patchbay's ui and testing; not the panels; the clock as it is; source, not compiled

**Date:** 2026-11-22 · **Status:** accepted (the owner's rulings in session, on the questions of [#56](https://github.com/yggi/webmidi/issues/56)) · Issues: [#56](https://github.com/yggi/webmidi/issues/56), [#26](https://github.com/yggi/webmidi/issues/26), [#3](https://github.com/yggi/webmidi/issues/3) · Builds on [001](001-a-midi-layer-of-its-own.md), [005](005-control-panels.md), [011](011-an-absent-crossing-sends-nothing.md)

## Context

#56 asked what a webmidi 1.0 would promise, with five questions for the owner (2026-11-12: "each project's 1.0.0 is its own", with no fixed numbers and no fixed order; nothing marked stable arbitrarily).
By 2026-11-22 both frontends pin v0.12.0 and play MIDI through `core` and `web`, and the patchbay's `ui` and the panels have been through many releases, several of which broke a frontend at its pin (`PatchMatrix`'s migration at v0.5.0, `Crossing` at v0.10.0, the control wrapper's role at v0.12.0).

## Decision

- **`core` and `web` are promised**: a break is a major with its migration, an addition a minor, a fix a patch (as #56 said).
- **The patchbay's `ui` is promised**: `MidiStatus`, `DeviceInspector`, `DeviceDialog`, `ChannelMeter`, `PatchMatrix`, `ChannelPicker`, `SetupPicker`, what `ui` exports beside them (`inputRows`, `MatrixRow`, `CHANNELS`, `channelHue`, `crossingText`, `crossingWords`), their props and events, the `--wm-*` custom properties and a Svelte 5 peer. A break there is a major with its migration.
- **The panels stay outside it**: `@yggi/webmidi/panels` and `@yggi/webmidi/ui/panels` (decision 005), which have changed in most of the releases since v0.5.0 and will go on changing.
- **`@yggi/webmidi/testing` is promised, with additive fakes**: names and signatures follow the same rule as `core` and `web`; a fake may gain options and behaviours as long as a call that worked keeps working, its defaults keeping the old behaviour. Both frontends' suites import it.
- **1.0 does not wait for the hub's `sync` contract** (named, not written). It promises `ClockOut`'s documented wire as it is: Start 2 ms before the first tick, Continue with Song Position from a sixteenth, Stop just after the last tick sent, no Stop outside a run. If `sync` is written and disagrees, meeting it is a major with the change named, as a change to the wire always is.
- **1.0 ships source**, as now: `exports` point at `src/*.ts`, which both frontends' bundlers read, and `ui` is Svelte source with Svelte a peer, which cannot be precompiled. A compiled `core` and `web` under new export conditions is an additive release for the day a consumer that is no bundler needs it (KO-Multitool, a Node tool); none does.
- **The book's rule is [011](011-an-absent-crossing-sends-nothing.md)**: an absent crossing sends nothing, and the book gains no marker for "the frontend's defaults".

## Consequences

- #56's questions are answered; what is left before 1.0 is the owner's choice of when: nothing in the code or the issues blocks it (#25 and #26 are settled, the README says what `ui` is).
- A change to a promised component's props, events or `--wm-*` properties now costs a major, so the patchbay's changes are weighed as the wire's are.
- The panels' editor can go on changing at the pace it has, and a frontend takes each change at its pin without a version signal beyond the changelog.
