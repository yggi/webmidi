### Added
- **`numberProblem(field, text)` and `MAX_GRID`** (`@yggi/webmidi/panels`, yggi/webmidi#66): why a text typed into a plain number field (`'start'`, `'note'`, `'notes'`, `'span'`) can't be taken, in words, or undefined. `MAX_GRID` (64, the most columns a grid has and the furthest cell) is exported for the span's range. Additive.

### Fixed
- **`PanelEditor`'s plain number fields take what is typed or say why not** (yggi/webmidi#66): *Starts at* turned a word into 0 and held 7 to 1, *Notes* dropped a word among the pads' notes (`36, abc, 40` made four pads two), and *Lowest note*, *Highest note* and *Spans columns/rows* rounded a fraction or made a word nothing. Each is now read strictly: a text that isn't a number in the field's range (*Starts at* 0 to 1, notes 0 to 127, spans 1 to 64) is refused, the field goes back to what the panel holds and the note says the range. Nothing on the wire changes.
