# 006 · A port kept is its name's: found by name once the name is known, one port to one output

**Date:** 2026-11-15 · **Status:** accepted (the owner asked for it in session: "device-port association seems flakey") · Amends [002](002-setups-device-profiles-and-inputs-as-rows.md)

## Context

A setup keeps each output as a port's id and name, and every reader found the port plugged in "by id, or by name": `outputNow`, `fit`, the matrix's and the inspector's own tests of "plugged in", `isListened`.
That is wrong in three ways a person meets:

- **An id is not always a device's.** Some systems number their ports by place (`output-0`, `output-1`). After a replug in another order the kept id is another device's, and "by id first" sent one synth's notes to the other.
- **Two outputs could resolve to one port.** Two devices of one name (two TD-3s; Android names a device's every port after the device) each matched the first port of that name, and the second device could not be added at all, since its name was "already in the setup".
- **The readers disagreed.** The matrix called an output plugged in by its name while the inspector's port list, keyed by id, had no entry for the kept id and showed none chosen.

## Decision

- **One rule, in core** (`matchPorts`): a port kept with its name is that name's. It is the port plugged in with its id and its name, else another of its name; an id under another name is not it. A port kept by id alone (a store from before names were kept) is found by its id.
- **One port serves one port kept**, so two devices of one name are two ports, each its own id first, then in the order listed.
- **Everything reads through it**: `outputNow`, `adoptPorts`, `portsOf`, `fit`, `pluggedOf` and `spareOf` (new: a setup's live ports, and the ports plugged in that it has no output for), the matrix and the inspector. An input is listened to by its name where it has one (`isListened`), every port of that name, as the book keeps an input by its name.
- **An input not plugged in whose id is another device's now is not listened to**; one whose id is nowhere is kept as asked, for when it comes.

## Consequences

- **On the wire:** a setup whose kept id is now another device's sends nothing to that device, where it sent the first device's notes to it. Nothing else changes: an output found by id and name, or by name, is found as before.
- A device renamed by its system reads as not plugged in until it is chosen again; its routes are kept, as an unplugged device's are.
- The book keeps the ids it has (decision 002: a replug is no change to the setup); the name finds the port.
