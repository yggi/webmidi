import type { PortOption } from '../core/port';
import { type InputPreset } from '../core/input-kinds';
import { type SetupBook } from '../core/setups';
import { type MatrixRow } from './rows';
interface Props {
    book: SetupBook;
    /** Whose routes these are: `piece:<title>`, `band`, `bay`. */
    context: string;
    /** The frontend's rows, in order; the inputs follow. */
    rows: readonly MatrixRow[];
    /** The inputs plugged in now. */
    inputs?: readonly PortOption[];
    /** The outputs plugged in now. */
    outputs: readonly PortOption[];
    /** Who hears an input ("the Muse", "the keys"): each input's row gets its Plays choice; null for none (standalone). */
    heardBy?: string | null;
    /** A preset to fill in what the inputs with no choice play (`DEFAULT_PRESET`), by the rows' roles; none: no button. */
    preset?: InputPreset | null;
    /** The output selected, by key. */
    selected?: string;
    /** The crossings sounding now, as `row|output key`. */
    lit?: ReadonlySet<string>;
    /**
     * The frontend's rows routed by the piece itself (its MIDI cards): shown, not changed. The inputs and the clock stay
     * the setup's, and editable; no output is added, since the outputs are the piece's (yggi/webmidi#22).
     */
    locked?: boolean;
    /** Whether the clock row is shown: a frontend with no clock to send passes false. */
    clock?: boolean;
    /**
     * This device's own sound as a column (`BUILT_IN`), first: what the frontend calls it ("Synth"), and whether its
     * crossings are edited here, row by row (`rows`, by default; false: shown as the frontend wrote them in `book`, the
     * column itself added and removed). None (standalone): no such column, and none offered.
     */
    builtIn?: {
        readonly label: string;
        readonly rows?: boolean;
    } | null;
    onchange: (book: SetupBook) => void;
    onselect?: (key: string) => void;
}
declare const PatchMatrix: import("svelte").Component<Props, {}, "">;
type PatchMatrix = ReturnType<typeof PatchMatrix>;
export default PatchMatrix;
