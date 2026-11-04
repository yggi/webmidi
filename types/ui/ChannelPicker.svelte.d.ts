/**
   * The channel of a crossing, chosen from 16 pads in their hues (docs/proposals/patchbay.md): a dot marks a channel
   * another row already sends on to this output; "As played" for an input's row; "Not sent" clears it. A small dialog
   * beside the jack it opened from; Escape or a press outside closes it.
   */
import { type Crossing } from '../core/setups';
interface Props {
    /** What is routed where, as a heading: "&lead → Minilogue xd". */
    label: string;
    value: Crossing | undefined;
    /** The channels other rows send on to this output. */
    busy?: readonly number[];
    /** Whether "As played" is offered: an input's row. */
    asPlayed?: boolean;
    /** Where the jack is, to sit beside it. */
    anchor: {
        readonly left: number;
        readonly right: number;
        readonly top: number;
        readonly bottom: number;
    };
    onpick: (value: Crossing | undefined) => void;
    onclose: () => void;
}
declare const ChannelPicker: import("svelte").Component<Props, {}, "">;
type ChannelPicker = ReturnType<typeof ChannelPicker>;
export default ChannelPicker;
