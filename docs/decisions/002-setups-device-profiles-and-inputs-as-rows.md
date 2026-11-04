# 002 · Setups: device profiles shared, routes in the setup, inputs as rows

**Date:** 2026-11-04 · **Status:** accepted (the owner, on the patchbay proposal, yggi/webmidi#12) · Issues: [#3](https://github.com/yggi/webmidi/issues/3)

## Context

Cell studio and Jambot each kept one MIDI configuration in a store of their own (`cell-studio:midi`, `jambot-midi-v1`), mixing what is true of a device (its drum map, clock, bend range, rotation), which devices are in use, and how the frontend's rows are routed to them.
Neither could keep a second configuration, say a home studio and a venue.
The patchbay proposal ([proposals/patchbay.md](../proposals/patchbay.md), with its mockup) moves the configuration and its components into webmidi, for both frontends and a standalone page.

## Decision

- **A device's profile is kept by its port's name, and shared by every setup:** its drum map, clock, bend range, MPE rotation and latency.
  A Circuit's drum map is set once. A device with no profile takes the book's defaults.
- **A setup** is named and holds the outputs in order (each under a key its routes are kept by), the inputs the frontend hears, and **the routes**, by a context the frontend names (`piece:<title>`, `band`, `bay`).
  A venue's setup carries the band's patch with it.
- **The inputs are rows of the matrix, in every mode** (`in:<port name>`): routed like any row, to any outputs, on a channel 1–16 or as played (`AS_PLAYED`, 0).
  Thru is one crossing of the matrix, not an option of its own.
  Which inputs the frontend listens to (its keys, MIDI learn, the Muse) is the setup's `heard`, apart from where they are sent.
- **A change to a named setup makes its custom variant**, "Home - custom", saved at once and put in use; the named setup stays as it was saved (the owner, 2026-11-04).
  Save then offers to overwrite the named setup with it, or to save it under a new name; or it is discarded.
  A named setup has one variant at most: a change made again from the named setup starts from what was saved, and replaces it.
  A device's profile is not part of a setup, so a change to one makes no variant.
- **The book** holds the profiles, the setups (at least one) and the one in use.
  It is pure (`core`, `setups.ts`), each change a new book.
  It is kept through a `BookStore`: web's `localBookStore`, or a frontend's own.
- **A setup goes between devices as a file** (`.midisetup.json`, `format: 'webmidi-setup'`, version 1), with its devices' profiles.
  An imported profile is taken only where the book has none, since the book's own describe this rig.
  Sharing between users (through Jambot's lobby, say) comes later.
- **Each frontend's store is migrated once** (`setups-from.ts`), on a first load with nothing kept, so nothing a person chose is lost.

## Consequences

- The two frontends' stores and their readers go when each moves onto the book (the proposal's rungs 4 and 5).
- A device plugged in under another name (a second Circuit, a renamed IAC bus) has a profile of its own. That is accepted: the name is what both frontends already keep.
- Cell studio's thru echoes the keys where the matrix sends the voice they play. That needs a crossing "with the voice played", which comes with Cell studio's move.
