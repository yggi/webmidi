### Fixed

- **`PanelEditor` says why a binding isn't read, refuses what it would lose, and never shows a field the panel doesn't hold.** A binding that couldn't be resolved said only "see what couldn't be read, under the panel's name", where the panel gave a count; the reasons (an unknown name, a channel out of 1 to 16, a number out of range) are now listed under the control, once each. A change the reader would keep only in part (an expression over 200 characters, say) is refused with a note, where it was taken and dropped what it couldn't keep; and a field whose change isn't taken is put back to what the panel holds, where it kept the text typed. A Name that isn't one the reader keeps (`a/b c`) or that a sibling, a control or a group, already has is refused in words, where it was taken and the control lost its key (a duplicate left the second out, said only in the panel's list). Nothing on the wire changes.

### Added

- **`nameProblem(panel, path, wanted)`** (`@yggi/webmidi/panels`): why a name asked for can't be taken, in words, or undefined. Additive.
