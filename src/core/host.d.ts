// Lifted from yggi/cells src/host.d.ts @ 41ef16b, its first global only.
// The host globals `core` uses, and only these: every JavaScript host has them (browsers, workers, node). The purity
// gate (tsconfig.pure.json) typechecks with no host types at all, so a new one is a choice made here, on purpose.

/** A monotonic clock in milliseconds: the page's clock, which MIDI timestamps are read against. */
declare const performance: { now(): number };
