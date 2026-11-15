### Added

- **`PanelEditor`** (`@yggi/webmidi/ui/panels`; rung 6 of the control surfaces' proposal): a panel edited where it is drawn. A control or a group is pressed to choose it, every instance of one definition is marked, and a change is a change to all; a binding is one line (what it speaks, its number or an expression, its range, its channel) with what it comes to in each instance under it; a group's layout and repeat; add, move, duplicate, delete, undo and redo. It takes a panel and calls back the panel changed. `PanelView` takes `onselect` and `selected` for it. Core (`@yggi/webmidi/panels`): the editing operations (`nodeAt`, `updateNode`, `insertNode`, `removeNode`, `moveNode`, `duplicateNode`, `newControl`, `newGroup`, `containerOf`, `childrenAt`, `ofKind`, `samePath`), and each instance's `source`, its place in the panel (`NodePath`).
- **`ThruMeter`** (`@yggi/webmidi/core`): what a page adds to a message it passes on, from the port seeing it to the page sending it: the median, what 95 in 100 are within, the worst, over the last 256 (`delayText` says one).
- **`PatchMatrix`'s `builtIn.direct`**: for a built-in that plays MIDI itself, an input's and a panel's row cross it on or off. A frontend that doesn't pass it sees no change.

Nothing existing changes on the wire.

### Repository

- **The standalone page** edits a panel, makes a new one and deletes one; says what it adds to each message it passes on, measured; and has a sound of its own (`site/synth.ts`, a small Web Audio synth as the built-in of its setups), which a first visit's keys play, with no device and no Web MIDI needed.
