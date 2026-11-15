/**
   * A panel to play (decision 005; `PlayView` in the proposal): the panel instantiated and laid out, each control a
   * widget, driven by core's `PanelRuntime`. A touch calls `onsend` with each message it makes, for the frontend to send
   * where the panel's row of the patch says (`forwardsOf`); a message the panel's column is sent goes to `receive`,
   * which moves its controls. Full screen on its button, or over the whole window where the browser has no full
   * screen (an iPhone). Leaving it, or taking it off the page, releases every note it holds.
   *
   * Layout: a group with no `columns` is a row, one with `columns: 1` a strip (its fader as tall as the panel), any
   * other a grid; a child's `cell` places it. What the panel couldn't resolve is said under its name.
   */
import { PanelRuntime } from '../../core/panels/index';
import { type NodePath, type Panel } from '../../core/panels/index';
interface Props {
    /** The panel to play, with a runtime of the view's own; or `runtime`. */
    panel?: Panel;
    /**
     * A runtime the frontend keeps (a `PanelRack`'s: the panel plays on, and follows what it is sent, while no view
     * shows it). The view draws it and plays it, and leaves its notes to the frontend when it goes.
     */
    runtime?: PanelRuntime;
    /** Each message a touch makes, in order: the frontend sends it on the panel's row. */
    onsend: (data: number[]) => void;
    /** Whether its name and the full-screen button are shown (true by default). */
    bar?: boolean;
    /**
     * Given, the view is an editor's: a control or a group pressed is chosen, not played (its place in the panel, the
     * same for every instance of one definition), and a press on the panel's ground chooses none.
     */
    onselect?: (source: NodePath | null) => void;
    /** The place chosen: every instance of it is marked. */
    selected?: NodePath | null;
}
declare const PanelView: import("svelte").Component<Props, {
    receive: (data: ArrayLike<number>) => void;
    silence: () => void;
}, "">;
type PanelView = ReturnType<typeof PanelView>;
export default PanelView;
