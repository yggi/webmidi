# Proposal · Control surfaces: panels of controls a person lays out, plays and shares

**Status:** ruled by the owner (2026-11-14 and 2026-11-15, below) · **Date:** 2026-11-14 · Mockup: [control-surfaces-mockup.html](control-surfaces-mockup.html) (published: <https://claude.ai/artifact/TqbXC3bGysFBcmJ2mg3tst>) · Builds on [patchbay.md](patchbay.md) and decisions 002 to 004 · Independent of 1.0 ([#56](https://github.com/yggi/webmidi/issues/56))

The goal is user-configurable control surfaces in webmidi, importable by the frontends and usable standalone: a person lays out a panel of controls (buttons, switches, knobs, faders, XY pads, the keyboard, the drum pads), each sending and receiving MIDI, and plays it, full screen if they like.
The reference is TouchOSC.
Panels are meant to be made by users and shared, so a panel is data, never code.

## Why it belongs here

- **The matrix already has the slot.** Inputs are rows (decision 002) and the built-in is a column that is no device (decision 004). An active panel is both: a row for what it sends, a column for what it receives.
- **Forwarding exists.** `forwardsOf` turns a row's message into bytes for each output crossed; a panel's row uses it unchanged.
- **Playing exists.** A panel's row is an input like any other, so Heard and Plays (decision 003) let a panel's keyboard play a voice in Cell studio.
- **Two open lines of [#3](https://github.com/yggi/webmidi/issues/3) are absorbed:** the on-screen keyboard (a widget) and `site/` (the standalone page hosts the play view).
- **The layers hold as they are.** The model and its runtime are pure (`core`), other signal sources later are the browser's (`web`), the widgets and the editor are Svelte (`ui`). Nothing imports cells or a frontend.

## The model

### A panel is a virtual device

A panel never names a port.
It sends messages on its row and receives them on its column, and the user's patch says where they go and where they come from.
That makes the matrix the permission boundary of a shared panel: an imported panel reaches only what its crossings give it.

- Row and column id: `panel:<id>`.
- A crossing of the row is "as sent" (`AS_PLAYED`) by default, the panel sending on its own channels, or a channel that replaces them, as an input's (ruling 6).
- A crossing of the column is an input (or a frontend's row) sent to the panel: a mixer's own fader moves come back this way.

### Controls and their value

A control has a type, a place in its group's grid (a cell, with spans; each nested group has a grid of its own; ruling 4), a label and a **value**: `x` from 0 to 1, or `x` and `y` for an XY pad.
The first set: button (momentary), switch (toggle), knob, fader, XY pad, label, keyboard, drum pads.
The keyboard and the pads are `core/keyboard.ts` and the drum maps with a component over them; they send notes, with the strike's velocity by height as today.

### A binding: the easy case, both ways

Most controls need one line: a message kind, its number, and a range.

```json
{ "type": "fader", "label": "Level", "bind": [{ "kind": "cc", "number": "ch", "range": [0, 127] }] }
```

A binding is two-way by construction: moving the control sends the message, and the same message arriving on the panel's column moves the control.
The range is linear, so it inverts; anything that doesn't invert is a rule (below).
Kinds: `cc`, `note`, `program`, `bend`, `pressure`, `nrpn` (and 14-bit `cc`).
The channel is the panel's (1 by default), a group's, or the control's own, and the row's crossing may still replace it.

### Groups, parameters, repeat: the mixer

A group holds controls and other groups (nesting), and may declare **parameters**.
`repeat` instantiates the group once per value of a parameter, and a group holds its children inline or takes them from a **template**, `with` its parameters given.
The eight strips are eight instances of one template, so an edit to the strip changes all eight: there are no copies to keep in step.
An instance that must differ carries an override (its label, its colour), keyed by the parameter's value.

```json
{
  "templates": {
    "strip": {
      "params": ["ch"],
      "children": [
        { "type": "knob", "label": "High", "bind": [{ "kind": "cc", "number": "10 + ch" }] },
        { "type": "knob", "label": "Mid", "bind": [{ "kind": "cc", "number": "20 + ch" }] },
        { "type": "switch", "label": "Mute", "bind": [{ "kind": "cc", "number": "30 + ch" }] },
        { "type": "fader", "label": "Level", "bind": [{ "kind": "cc", "number": "ch" }] }
      ]
    }
  },
  "children": [{ "group": "strips", "label": "{ch}", "repeat": { "name": "ch", "from": 1, "to": 8 }, "use": "strip", "with": { "ch": "ch" } }]
}
```

A template sees its own parameters alone, so it can be checked on its own; the same template is used once elsewhere by a group without `repeat` (`{ "group": "aux", "use": "strip", "with": { "ch": 9 } }`).
The file has one form of each thing, with no shorthand, as built in [#58](https://github.com/yggi/webmidi/pull/58).

### Expressions (scripting, tier 1)

Wherever a number is expected, an expression may stand: arithmetic, comparison, a conditional, and a fixed set of functions (`min`, `max`, `round`, `floor`, `clamp`, `scale`), over the names in scope (the group's parameters, `x` and `y`, the panel's variables).
The language is total: no loops, no recursion, no assignment, no host access, so an expression always ends and can do nothing but compute a number.
It is parsed, never `eval`ed, and is pure, so it lives in `core` and is tested there.

### Rules and variables (tier 2)

A control (and the panel) may carry **rules**, which is the "matrix of its own" in full: *when* a signal, *do* an action.

- Signals: touch down, touch up, value changed, a message received (matched by kind and number), the panel opened; later a game controller's axis, a level from the microphone (`web` supplies those as sources, the model only names them).
- Actions: send a message, set a control's value, set a panel variable, show another page of the panel (a panel may hold several, as tabs; the first rungs have one).
- Panel variables are numbers (`bank`, `shift`), read by any expression.

A binding is shorthand for two rules (changed → send; received → set).
The editor shows a control's rules as a table of signals against actions; the usual control never opens it.
Shift layers, banks of eight and radio groups are rules and a variable, with no code.

### Real code (tier 3): not now

Deferred until the first two tiers are shown too small by a real panel.
If it comes, it runs in a worker with no network and no DOM, speaks only messages, and is budgeted; nothing in tiers 1 and 2 is designed around it.

### Safe by design

- A panel is JSON, read by a validating reader (`readPanel`, as `readBook`): unknown fields dropped, a newer version refused in words.
- No port names, no URLs, no HTML in a panel; labels are text.
- **SysEx is a capability.** A panel that sends SysEx says so in its head, and importing it asks first: SysEx can overwrite a device's memory.
- Bounds, checked on import and at run time (proposed; choose and name them in rung 3): a file of at most 256 KB, at most 2,000 controls once instantiated, an expression of at most 200 characters, at most 500 messages a second from one panel.

### What the runtime does beyond the model

- A control sends only when the number on the wire changes, so a slow drag across one step sends once.
- A value received is not sent back (no echo), and a control being touched is not moved by what arrives.
- Pickup (soft takeover) is an option of a binding, for a device that sends no feedback.

### Storage (ruled)

Panels live in a **library of their own** (`PanelLibrary`, behind a store interface like `BookStore`), and a panel is a file to export and import (`.midipanel.json`, with a `version`).
A **setup names the panels it has active**, by id; a panel missing from the library is shown as such, its crossings kept, as an unplugged device is.
This adds an optional field to `Setup`, read forward by older books.

## Where it lives

No change to the layering; folders inside the layers, and two more subpath exports, outside what 1.0 promises (ruled):

- `src/core/messages.ts`, in core's own surface: every channel message read and written (control change, program change, bend, pressure, NRPN, 14-bit). Core reads notes and the sustain pedal today. Useful to MIDI learn too. Additive; nothing existing changes on the wire.
- `src/core/panels/` → `@yggi/webmidi/panels`: the model, expressions, instantiation, the runtime (a signal in, the state and the messages out), the reader, the library. Pure, under core's gate.
- `src/ui/panels/` → `@yggi/webmidi/ui/panels`: the widgets, `<PlayView>`, and later the editor. `<PatchMatrix>` gains the panels' rows and columns.
- `site/`: the standalone page, the patchbay with its panels.

## Risks

- **Size.** `ui` is about 1,800 lines today; an editor in TouchOSC's manner is several times that. Hence the editor late, and play before edit.
- **iPad.** Safari on iOS has no Web MIDI as far as known, so the tablet this kind of tool is known on is out; Android and desktop are in. A panel can still play a frontend's built-in sound there.
- **Jitter.** A touch is sent when the page gets to it; fine for a fader, audible for drum pads next to a sequenced part. The standalone page already owes a measurement of what it adds (patchbay.md).
- **A name.** `core/surfaces.ts` already means the computer's keys read as notes. Hence *panel* (ruling 7): a control panel is one layout, "control surfaces" the feature.

## Rungs (each a pull request)

1. **This proposal and its mockup**, then decision 005 with the first code.
2. **`core/messages.ts`**: the codec and its tests; the hub's `midi-rx` vectors it now meets move from "outside" to run.
3. **`core/panels`**: model, expressions, instantiation, runtime, reader, library. The mixer above is the test: 8 strips, 32 controls, the bytes of each.
4. **Widgets and `<PlayView>`** over hand-written panels: button, switch, knob, fader, XY pad, label, keyboard, drum pads; multi-touch; full screen.
5. **The panels in the matrix** (rows, columns, a setup's active panels), and `site/`.
6. **The editor**: layout, the inspector, groups and repeat, a binding in one line.
7. **Rules and variables**, with their table in the editor.
8. **Sharing** (import with the SysEx question), then other signal sources.

Play comes before edit on purpose: hand-written panels prove the model before an editor is built on it.

## Rulings (the owner)

2026-11-14:

1. **The editor is importable**, part of the package, and late (rung 6).
2. **Panels are a library of their own, referenced by the setup.**
3. **Independent of 1.0**: the new subpaths are outside what [#56](https://github.com/yggi/webmidi/issues/56) promises.

2026-11-15:

4. **Layout is a grid** (cells and spans), each nested group with its own; free rectangles are not built first.
5. **A panel receives as a column of the matrix**, like the built-in: one model, no "listens to" of its own.
6. **A panel sends on its own channels**, its row's crossing "as sent" by default; a crossing on a channel replaces them.
7. **The word is *panel*** (a control panel): `panel:<id>`, `@yggi/webmidi/panels`, `.midipanel.json`. "Page" stays free for the tabs inside a panel.

The decision record is 005, written with rung 3, the first code of the model.
