# 005 · Control panels: a panel is data and a virtual device, its strips instances of one definition, its formulas a total language

**Date:** 2026-11-15 · **Status:** accepted (the owner's rulings of 2026-11-14 and 2026-11-15, on the proposal: [yggi/webmidi#57](https://github.com/yggi/webmidi/pull/57)) · Builds on [002](002-setups-device-profiles-and-inputs-as-rows.md) and [004](004-the-built-in-as-an-output.md)

## Context

The owner asked for user-configurable control surfaces, importable and standalone, with TouchOSC as the reference: a layout of buttons, switches, knobs, faders, the keyboard and the drum pads, each sending and receiving MIDI, easy for the common case (an 8-channel mixer whose controllers are offset by the channel), scriptable for the advanced one, and safe to share between users.
Three things had to be chosen: what a panel is to the patchbay, how eight strips stay one, and what "scripting" may be when a panel comes from a stranger.

## Decision

- **A panel is a virtual device, and names no port.** An active panel is a row of the matrix for what it sends and a column for what it receives (`panelRow`, `panel:<id>`), as an input is a row and the built-in a column. It sends on its own channels, its row's crossing "as sent" by default. The patch is therefore the permission boundary of a shared panel: it reaches what its crossings give it.
- **A panel is data, never code** (`readPanel`, as `readBook`: junk dropped field by field). A control has a type, a value 0 … 1 and bindings.
- **A binding is two-way by construction**: `{ kind, number, range }`, the value linear over the range, so what is sent reads back. Kinds: `cc`, `cc14`, `note`, `program`, `bend`, `pressure`, `nrpn`, `rpn`. The file has one form of each thing, with no shorthand, so the editor, the reader and a hand-written file agree.
- **Groups nest, lay out on a grid, and repeat over a parameter; a template is used with its parameters given.** Eight strips are a group repeated for `ch` 1 … 8 using one template: there are no copies to keep in step, and an edit to the template is an edit to all. A template sees its own parameters alone (not the scope of where it is used), so it can be checked on its own. An instance that differs carries an override by its parameter's value, a label for now: the reader keeps one only for a value the repeat gives (where its ends are plain numbers), at most 64 to a group.
- **A number may be an expression** over the parameters in scope: arithmetic, comparison, a conditional, eight functions. The language is total and parsed here, never `eval`ed: it can compute a number and nothing else.
- **Instantiation resolves everything to numbers** (`instantiate`), and what can't be resolved is said in words and left out binding by binding: a panel with a mistake still plays the rest.
- **The runtime is pure** (`PanelRuntime`): a touch in, bytes out; a message in, the controls moved. It sends only when the number on the wire changes, never echoes what it received, leaves a held control where the finger is, and can release every note sounding.
- **Panels are a library of their own** (`PanelLibrary`, behind a `PanelStore`), and a file to share (`.midipanel.json`, `webmidi-panel` version 1; a newer one refused in words).
- **Where it lives:** `src/core/panels/`, under core's gate, exported apart as `@yggi/webmidi/panels`, outside what 1.0 promises ([#56](https://github.com/yggi/webmidi/issues/56)). The word is *panel*; "page" is kept for the tabs inside one.

The bounds, named: an expression of at most 200 characters, nested at most 32 deep; groups at most 16 deep; at most 2,000 controls and groups once instantiated; a file of at most 256 KB; a name, id or label of at most 64 characters; a grid of at most 64 columns.

## Rejected

- **Linked clones** (copies that follow an original): two sources of truth and a sync to get wrong, where an instance of a definition has one.
- **JavaScript in a panel**, sandboxed or not: a shared panel would be a program. Rules and variables (when a signal, do an action) are the next tier, still data; real code waits until a real panel shows the two tiers too small.
- **A free value expression in a binding**: it doesn't invert, so the control couldn't follow what the device sends back. What doesn't invert will be a rule.
- **A "listens to" choice on the panel** for what it receives: a second routing beside the matrix.

## Consequences

- Core reads and writes every channel message (`messages.ts`), which the runtime speaks.
- Not yet: the widgets and the play view, the panels' rows and columns in `PatchMatrix` and a setup naming its active panels (which adds a field to `Setup`), the editor, rules and variables, and SysEx as a capability asked about on import (no binding sends SysEx, so nothing asks yet).
- A rate bound (messages a second from one panel) comes with rules: until then a panel sends only what a finger moves, each binding once per changed number.
- Pickup (soft takeover) is not built: a control on a screen moves to what the device sends.
