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
     * column itself added and removed). `direct`: the built-in plays MIDI itself (the standalone page's synth), so an
     * input's and a panel's row cross it on or off, where otherwise an input is heard through the row it plays. None:
     * no such column, and none offered.
     */
    builtIn?: {
        readonly label: string;
        readonly rows?: boolean;
        readonly direct?: boolean;
    } | null;
    /** The library's control panels, by id and name: those the setup has active are rows and columns, the others chips that add them. None: no panels here. */
    panels?: readonly {
        readonly id: string;
        readonly name: string;
    }[];
    /** A panel's head pressed, by its id: the frontend shows it to play. */
    onpanel?: (id: string) => void;
    onchange: (book: SetupBook) => void;
    /**
     * An output's head pressed, by key: the frontend shows its details itself (and may mark it with `selected`). Left
     * out, the matrix opens the output's details in a dialog of its own.
     */
    onselect?: (key: string) => void;
    /** In the matrix's own dialog: a test note to an output, and its notes off, by key; left out, not offered. */
    ontest?: (key: string) => void;
    onpanic?: (key: string) => void;
    /** The built-in's head pressed, where the matrix opens the details itself: its settings are the frontend's (decision 004). */
    onbuiltin?: () => void;
}
declare const PatchMatrix: import("svelte").Component<Props, {}, "">;
type PatchMatrix = ReturnType<typeof PatchMatrix>;
export default PatchMatrix;
