/**
   * The channels of a crossing, chosen from 16 pads in their hues (docs/proposals/patchbay.md): a dot marks a channel
   * another row already sends on to this output; "As played" for an input's row; "Not sent" clears it. A pad pressed
   * picks that channel and closes, as it always did; "Several" (open already on a crossing that is a set) makes the pads
   * toggles instead, each press changing the crossing at once with the picker left open until "Done" (decision 010),
   * and a channel pressed on an as-played crossing replaces it. A small dialog beside the jack it opened from;
   * Escape or a press outside closes it.
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
    /** A crossing picked (`more`: in Several mode, the picker stays open for the next press). */
    onpick: (value: Crossing | undefined, more?: boolean) => void;
    onclose: () => void;
}
declare const ChannelPicker: import("svelte").Component<Props, {}, "">;
type ChannelPicker = ReturnType<typeof ChannelPicker>;
export default ChannelPicker;
