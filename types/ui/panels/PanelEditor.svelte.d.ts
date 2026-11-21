/**
   * A panel edited (decision 005, the editor): the panel as it will be played, where a control or a group is pressed
   * to choose it, and beside it what is chosen, field by field. A control in a template, or in a group that repeats, is
   * one definition however many times it is drawn: all its instances are marked, and a change is a change to all.
   * A binding is one line (what it speaks, its number or an expression, its range), with what it comes to in each
   * instance said under it. Controlled: it takes the panel and calls back the panel changed (`onchange`), read
   * through `readPanel`, so what it gives is always a panel that keeps; it keeps only what is chosen, and what to undo.
   * Given `onsend`, a Try toggle plays the panel as it stands (a press plays and chooses nothing) through it, and
   * only while it is on: with Try off nothing the stage does reaches `onsend`; without one there is nothing to try and the
   * editor only edits. A node moves into a group of its choice or out of its own
   * (`moveNode`), refused in words where the move would change what it means. Where the two columns stack (a phone),
   * what is chosen is edited in a sheet docked to the bottom, with its name and a close control, its bindings first, so
   * the control and its first binding are in view at once; the panel's own fields stay where they are.
   */
import { type Panel } from '../../core/panels/index';
interface Props {
    panel: Panel;
    onchange: (panel: Panel) => void;
    /** Where Try sends what a press makes (a frontend's: the panel's row of the patch); without it there is no Try. */
    onsend?: (data: number[]) => void;
}
declare const PanelEditor: import("svelte").Component<Props, {}, "">;
type PanelEditor = ReturnType<typeof PanelEditor>;
export default PanelEditor;
