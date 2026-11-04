import type { PortOption } from '../core/port';
import type { DeviceProfile, SetupOutput } from '../core/setups';
interface Props {
    output: SetupOutput;
    /** Its place in the setup, from 1. */
    slot: number;
    /** The outputs plugged in now. */
    ports: readonly PortOption[];
    profile: DeviceProfile;
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
}
declare const DeviceInspector: import("svelte").Component<Props, {}, "">;
type DeviceInspector = ReturnType<typeof DeviceInspector>;
export default DeviceInspector;
