/**
   * The setups (docs/proposals/patchbay.md, `SetupPicker`): each a chip with its light and how many of its devices are
   * plugged in; a custom variant beside its named setup, marked (decision 002). Save… offers to overwrite the named setup
   * with it, to save it under a new name, or to discard it; Manage… renames or removes the named setup in use (a custom variant's named setup, with the variant); the last
   * removed leaves a blank one. A setup
   * whose every device is plugged in is suggested when the one in use misses one. Export writes the setup in use as a
   * file, Import reads one. It takes the book and calls back a new one (`onchange`).
   */
import type { PortOption } from '../core/port';
import { type SetupBook } from '../core/setups';
interface Props {
    book: SetupBook;
    /** The outputs plugged in now. */
    plugged: readonly PortOption[];
    onchange: (book: SetupBook) => void;
    /** A setup's file to save, by name; by default the browser downloads it. */
    onexport?: (text: string, filename: string) => void;
}
declare const SetupPicker: import("svelte").Component<Props, {}, "">;
type SetupPicker = ReturnType<typeof SetupPicker>;
export default SetupPicker;
