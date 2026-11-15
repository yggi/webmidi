### Changed

- **A port kept is found by its name, one port to one output** (decision 006): `matchPorts` in core, read by `outputNow`, `adoptPorts`, `portsOf`, `fit`, `isListened`, the matrix and the inspector. A kept id that is another device's now (ports numbered by place, replugged in another order) is no longer taken for the device; two devices of one name are two ports, and the second can be added. **On the wire:** a setup whose kept id is now another device's sends nothing to that device, where it sent the first device's notes to it; an output found by its id and name, or by its name, is found as before. No migration.
- **`PatchMatrix`: an output's details open in a dialog, and the matrix holds the patch alone.** A kit's members (`kind: 'member'`) are no longer rows, and their notes are no longer typed in the matrix: each drum's note on a device is set in its details. **Migration:** a frontend that passes `onselect` and docks its own `DeviceInspector` keeps working, and passes the inspector `members` (`{ label, note }` of each member) to get the drums' notes back; or it drops `onselect`, `selected` and its inspector, passes `ontest` and `onpanic` (by output key), and the matrix opens the dialog itself. The `+ Output` button is gone: the devices plugged in that the setup has no output for are chips over the matrix, each adding its device (into a slot with no device where the setup has one). An output's × takes it out at once when nothing is routed to it, and asks first when routes would go with it. A slot with no device and no routes is no column. Nothing on the wire changes.

### Added

- **`DeviceDialog`** (`@yggi/webmidi/ui`): the `DeviceInspector` as a dialog over the page, a sheet on a narrow screen. `DeviceInspector` takes `port` (the port its output is now) and `members`. `PatchMatrix` takes `ontest`, `onpanic` and `onbuiltin`. Core: `matchPorts`, `pluggedOf`, `spareOf`.

### Fixed

- **The inspector's port list shows the port an output is on after a replug** under another id, where it showed none chosen.
- An output's head is one height whatever it says, and a row's name stays beside its crossings in a wide room: the matrix is as wide as its columns.
