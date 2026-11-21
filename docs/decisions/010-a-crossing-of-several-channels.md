# 010 · A crossing of several channels: the book widens, a set of one is the bare number

**Date:** 2026-11-21 · **Status:** accepted (the owner, in session: "multiple channels per output should be possible") · Issues: [#25](https://github.com/yggi/webmidi/issues/25), [#3](https://github.com/yggi/webmidi/issues/3) · Amends [002](002-setups-device-profiles-and-inputs-as-rows.md) and [003](003-what-an-input-plays.md)

## Context

A `Crossing` was one channel 1–16 or `AS_PLAYED`.
A cells piece's MIDI cards can send one voice on several channels of one output (a layered patch), which Cell studio's locked matrix showed as the first channel only (yggi/cell-studio#538).
The issue named two ways: widen `Crossing` through the book, the picker and the chip, or widen only what a locked row shows and leave the book at one channel a crossing.
The first changes an exported type, so a frontend's typecheck breaks at its next pin; the owner chose it, since the second leaves the setup unable to say what the piece plays.

## Decision

1. **A crossing is `AS_PLAYED`, a channel 1–16, or a readonly array of 2 or more distinct channels, ascending.**
   A set of one is always the bare number, so every crossing of one channel is spelled one way, and every book and file that uses one channel reads and writes as before (the law of generalization: one channel is the case of a set of one, so nothing special-cases it).
   `crossingFrom` is the one reader and `withCrossing` its writer: it sorts, drops duplicates and elements that are no channel 1–16, turns one element into its number and none into no crossing.
   `channelsOf(crossing)` is a crossing's channels (a crossing's channels are not "a channel": the law of true names), none for `AS_PLAYED`.
2. **`AS_PLAYED` and explicit channels don't mix.**
   A 0 inside an array is dropped as no channel, so a crossing is one or the other; in the picker, a channel pressed on an as-played crossing replaces it and "As played" replaces a set.
3. **A channel voice message goes out once per channel, ascending, each re-channelled.**
   `forwardsOf`, `forwardsOfInput`, `forwardsAsPlayed` and `panelForwardsOf` send so; a system or clock message is not forwarded at all, as before, so it is never duplicated; a message that would be the same bytes to one output or panel is sent once, as before.
   What an input or a panel plays (`Plays`) is unaffected, and so is a setup with no set: the same bytes, outputs and order (tests on a book as v0.9.0 kept it).
4. **Persistence.**
   *The setup's file* is written at version 3 only when its setup holds a set, and at version 2 otherwise: a reader before this one reads version 2 files as always and refuses a version 3 in words ("update the app"), where it would have dropped the crossing and read the setup as sending nothing there.
   This reader takes 1, 2 and 3.
   *The book* a frontend keeps stays version 1 (decision 003: an older reader would drop a book of another version whole).
   A reader before this one drops a set it finds in the book, its crossing silently becoming none, and writes it back so at its next change: accepted, since the book is the frontend's own and is read by the version of webmidi it pins, so only a frontend that moves its pin back after saving a set meets it.
5. **The picker takes several pads; the chip says "1+3".**
   A pad pressed picks that channel and closes, as before, so the common case is no slower.
   "Several" turns the pads into toggles that change the crossing at once with the picker open until "Done"; it is on already when the crossing is a set.
   The chip joins 2 or 3 channels with "+" ("1+3", "1+3+5") and shows a count from 4 ("×4"), to stay a chip's width; its label and title give every channel ("channels 1, 3 and 5").
   Ranges ("1–3") are not used: they read as a count and a set is seldom a run.
   The chip's hue is the first channel's.
   The inspector's channels routed to an output and the meter list every channel of every set; the picker marks each as busy.
6. **A frontend changes at its pin**, as the changelog's migration says: `Crossing` is no longer `number`, so code that reads a crossing as a number (`crossingOf`, `Routes`, `setup.routes`, `withCrossing`'s argument and result) narrows it with `channelsOf` or `typeof`; `ChannelPicker`'s `value` and `onpick` take a `Crossing` and `onpick` has a second argument.

## Consequences

- A minor version, v0.10.0, since a frontend's typecheck can break.
- Nothing on the wire changes for a setup with no set.
- Cells' MIDI cards can now be shown as they are; reading them into a book is the frontend's migration.
