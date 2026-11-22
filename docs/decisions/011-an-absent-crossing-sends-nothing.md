# 011 · An absent crossing sends nothing: the book does not say "still on the frontend's defaults"

**Date:** 2026-11-22 · **Status:** accepted (the owner, in session, on [#26](https://github.com/yggi/webmidi/issues/26): "settle it: the book stays as is") · Issues: [#26](https://github.com/yggi/webmidi/issues/26), [#56](https://github.com/yggi/webmidi/issues/56) · Confirms [002](002-setups-device-profiles-and-inputs-as-rows.md)

## Context

Cell studio's store from before the book meant two things by a crossing: one absent on the first output meant "cells' default channel", and 0 meant "not sent".
In the book an absent crossing sends nothing and 0 is `AS_PLAYED` (decision 002), so `fromCellStudio` cannot say "this context is still on the frontend's defaults", and a piece routed only in part migrated to routes that play differently (found moving Cell studio onto `ui`, yggi/cell-studio#538).
The issue named two ways out: a context the book marks as on the frontend's defaults, which the frontend resolves; or a migration that takes a resolver and writes the defaults out once.
It also asked whether a row the routes don't name falls to the frontend's defaults (as in Cell studio's old store) or to nothing (as in the book).

## Decision

- **The book is as it is.** A crossing that is absent sends nothing, in every context, and a row the routes don't name falls to nothing. The book gains no marker for "the frontend's defaults".
- **The migration is the frontend's.** Cell studio keeps its old matrix as `legacy` routes and treats a context with no routes as on the defaults until its first edit writes them into the setup (`src/ui/state/patch.ts`). A store from before the book is read once per browser, so that code goes when old stores do.
- **Not done, and cheap later:** a resolver in `fromCellStudio(stored, defaultsOf)`, additive and out of the book. It is left until an old store turns up that the app-side handling misses.

## Why

- The case arises only when an old store is migrated, once per browser; everyone who opened Cell studio since the book landed has migrated.
- A marker would widen the book and `.midisetup.json` for a shrinking population, make "absent" mean two things again, and be a breaking change to the formats 1.0 would promise (decision 003's forward-reading rule).
- The book's rule is one line a person can read from the matrix: a dot sends nothing.

## Consequences

- The cost Cell studio found stays: in a piece routed before its first edit, a voice added later goes nowhere until routed, where it used to take the next default channel. It is an edge of a migration, and it is said here.
- #26 closes, and leaves [#56](https://github.com/yggi/webmidi/issues/56)'s list of what stands in the way of 1.0.
