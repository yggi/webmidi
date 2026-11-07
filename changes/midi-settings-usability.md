### Fixed
- **Inputs plugged in under one name no longer break the page.** Android names every port of a multi-port device after the device, and the patch matrix drew a row per port keyed by its name: a keyed list with one key twice throws in Svelte, and the page stopped redrawing (a lobby's Solo did nothing, the channel picker stayed open, a device plugged in wasn't shown). They are one row now, "2 ports" under its name, since the book keeps an input by its name (`inputRows`); the matrix draws each row id once whatever it is handed, and the `DeviceInspector` tells such ports apart by their place ("USB MIDI (2)"). Nothing on the wire changes.
- **The channel picker closes before the frontend's change runs**, so a change that throws leaves no picker open over the matrix.
- **`MidiAccess.listen` listens to the other inputs when one refuses a listener** (a port gone mid-look), where it threw and left the rest unheard.
- **`SetupPicker` says why a setup's file couldn't be read** instead of an unhandled rejection.

### Changed
- **The last output removed is left with no device** (`removeOutput`), its routes kept for the next device chosen, where it stayed as it was; and **the last named setup removed leaves a blank one** (`removeSetup`), the devices' profiles kept, where it stayed. A frontend's `canRemove` can now offer removal of a lone output with a device. Nothing on the wire changes.
- **Manage… works on a custom variant too**, renaming or removing its named setup (removed, the variant goes with it), where it was disabled while a change was unsaved.

### Added
- **An output removed from the matrix:** its head's × asks, then removes it (`PatchMatrix`; not on a piece's own outputs, nor on a lone output with no device).
- **`forgetDevice(book, name)`** and `DeviceInspector`'s `onforget`: a device's profile forgotten, back to the book's defaults, offered when the frontend passes it.
