/**
 * The connection, in a strip (docs/proposals/patchbay.md, `MidiStatus`): a light, what Web MIDI said, and the actions
 * that fit it: Connect before, Refresh ports and All notes off after. A setup missing devices turns the light amber
 * and says how many. Presentational: the frontend owns the connection and passes what it says.
 */
interface Props {
    /** What the connection says now (core's `portsMessage`, or why it couldn't connect). */
    message: string;
    connected: boolean;
    /** Asking for access: Connect waits. */
    connecting?: boolean;
    /** How many devices of the setup in use aren't plugged in. */
    missing?: number;
    onconnect: () => void;
    onrefresh?: () => void;
    /** All notes off, every output: for hardware left sounding. */
    onpanic?: () => void;
    /** Whether there is anything to silence. */
    canPanic?: boolean;
    /** The connect button's name, before ("Connect MIDI", say) and while asking (yggi/webmidi#31). */
    connectLabel?: string;
    connectingLabel?: string;
}
declare const MidiStatus: import("svelte").Component<Props, {}, "">;
type MidiStatus = ReturnType<typeof MidiStatus>;
export default MidiStatus;
