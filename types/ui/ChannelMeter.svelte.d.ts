interface Props {
    /** The channels routed to this output. */
    used?: readonly number[];
    /** The channels sounding now. */
    lit?: ReadonlySet<number>;
    label?: string;
}
declare const ChannelMeter: import("svelte").Component<Props, {}, "">;
type ChannelMeter = ReturnType<typeof ChannelMeter>;
export default ChannelMeter;
