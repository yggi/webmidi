/**
   * The patch (docs/proposals/patchbay.md, `PatchMatrix`): the frontend's rows and the inputs down, the setup's outputs
   * across, each crossing a jack (empty, or a chip in its channel's hue). A jack opens the channel picker; an input's
   * row has its Plays choice (decision 003: not heard, the default, or one of the frontend's rows), and a preset fills
   * in the inputs with no choice; empty rows (seats no part sits in) wait behind a button; the first row is the clock,
   * the outputs the setup sends it to, the same in every context.
   *
   * Over the matrix, the devices plugged in that the setup has no output for, each a chip that adds it; an output's ×
   * takes it out of the matrix and back among them (asking first only when it has routes to lose). An output is the
   * port plugged in under its name (`pluggedOf`), each port one output's.
   *
   * The setup's active control panels (decision 007) are rows and columns too, where the frontend gives the library's
   * panels (`panels`): a panel's row is what it sends, routed like an input's; its column is what it is sent, an input's
   * or another panel's row crossed on or off. Panels not active are chips beside the devices, and a panel's head calls
   * `onpanel`.
   *
   * The matrix holds the patch and nothing of a device's settings: an output's head opens its details in a dialog
   * (`DeviceDialog`: its port, its profile, each drum's note where a kit is routed to it, its channels), unless the
   * frontend takes the head itself (`onselect`). A kit's members are therefore not rows here. It takes the book and
   * calls back a new one (`onchange`): a change to a named setup becomes its custom variant there (decision 002).
   */
import type { ComponentProps } from 'svelte';
import type { LinkReport } from '../core/link';
import type { PortOption } from '../core/port';
import { type InputPreset } from '../core/input-kinds';
import { type SetupBook } from '../core/setups';
import DeviceDialog from './DeviceDialog.svelte';
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
    /** In the matrix's own dialog: measure the link to an output, by key (`DeviceInspector`'s `onmeasure`, which has `inputs` to pick the loop from); left out, not offered. */
    onmeasure?: (key: string, run: Parameters<NonNullable<ComponentProps<typeof DeviceDialog>['onmeasure']>>[0]) => ReturnType<NonNullable<ComponentProps<typeof DeviceDialog>['onmeasure']>>;
    /** A link report made there. */
    onlinkreport?: (report: LinkReport) => void;
    /** The built-in's head pressed, where the matrix opens the details itself: its settings are the frontend's (decision 004). */
    onbuiltin?: () => void;
}
declare const PatchMatrix: import("svelte").Component<Props, {}, "">;
type PatchMatrix = ReturnType<typeof PatchMatrix>;
export default PatchMatrix;
