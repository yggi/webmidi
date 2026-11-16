/**
   * One output of the setup in use, in full (docs/proposals/patchbay.md, `DeviceInspector`): the port it sends to (one
   * not plugged in kept and said so), then its device's profile, kept with the device in every setup (decision 002): drum
   * map, bend range, a channel per note (MPE), latency, and forgetting them. Under them the channels routed here, a test
   * note, notes off here, and removing the output. Where a kit is routed here and the frontend names its members, each
   * member's note on this device is set under the drum map (`members`): the matrix shows none of it. Ports plugged in
   * under one name are told apart by their place. Presentational: a change is a call back (`onport`, `onprofile`), which the frontend
   * makes with core's `chooseDevice` and `withProfile`.
   */
import type { ComponentProps } from 'svelte';
import { type PortOption } from '../core/port';
import type { DeviceProfile, SetupOutput } from '../core/setups';
import type { LinkReport } from '../core/link';
import LinkMeasure from './LinkMeasure.svelte';
interface Props {
    output: SetupOutput;
    /** Its place in the setup, from 1. */
    slot: number;
    /** The outputs plugged in now. */
    ports: readonly PortOption[];
    /**
     * The port plugged in that this output is now, or null (`pluggedOf`: with two devices of one name, each output its
     * own); left out, the inspector finds it among `ports` on its own.
     */
    port?: PortOption | null;
    profile: DeviceProfile;
    /** A kit's members, by General MIDI note: each one's note on this device is set here, where `drums`. */
    members?: readonly {
        readonly label: string;
        readonly note: number;
    }[];
    /** The channels routed to it. */
    used?: readonly number[];
    /** The channels sounding on it now. */
    lit?: ReadonlySet<number>;
    /** Whether a kit is routed here, so its drum map matters. */
    drums?: boolean;
    canRemove?: boolean;
    onport: (port: PortOption) => void;
    onprofile: (change: Partial<DeviceProfile>) => void;
    ontest?: () => void;
    onpanic?: () => void;
    onremove?: () => void;
    /**
     * Measure the link to this output (yggi/webmidi#75): given with `inputs`, the inspector offers "Measure link" (`LinkMeasure`),
     * which runs it with the input of the loop the person picks; web's `runLinkProbe` does it. Left out, no such block.
     */
    onmeasure?: ComponentProps<typeof LinkMeasure>['onmeasure'];
    /** The inputs plugged in, for the loop. */
    inputs?: readonly PortOption[];
    /** A link report made: the frontend may keep it for its timing export. */
    onlinkreport?: (report: LinkReport) => void;
    /** Forget the device's profile, back to the defaults: offered when the frontend passes it (the book keeps one). */
    onforget?: () => void;
}
declare const DeviceInspector: import("svelte").Component<Props, {}, "">;
type DeviceInspector = ReturnType<typeof DeviceInspector>;
export default DeviceInspector;
