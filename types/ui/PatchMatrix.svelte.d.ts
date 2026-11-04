import type { PortOption } from '../core/port';
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
    /** Who hears an input ("the Muse"): each input's row gets its Heard switch; null for none (standalone). */
    heardBy?: string | null;
    /** The output selected, by key. */
    selected?: string;
    /** The crossings sounding now, as `row|output key`. */
    lit?: ReadonlySet<string>;
    /** Routed by the piece itself (its MIDI cards): shown, not changed. */
    locked?: boolean;
    /** Whether the clock row is shown: a frontend with no clock to send passes false. */
    clock?: boolean;
    onchange: (book: SetupBook) => void;
    onselect?: (key: string) => void;
}
declare const PatchMatrix: import("svelte").Component<Props, {}, "">;
type PatchMatrix = ReturnType<typeof PatchMatrix>;
export default PatchMatrix;
