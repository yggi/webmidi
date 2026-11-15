/**
   * A panel edited (decision 005, the editor): the panel as it will be played, where a control or a group is pressed
   * to choose it, and beside it what is chosen, field by field. A control in a template, or in a group that repeats, is
   * one definition however many times it is drawn: all its instances are marked, and a change is a change to all.
   * A binding is one line (what it speaks, its number or an expression, its range), with what it comes to in each
   * instance said under it. Controlled: it takes the panel and calls back the panel changed (`onchange`), read
   * through `readPanel`, so what it gives is always a panel that keeps; it keeps only what is chosen, and what to undo.
   */
import { type Panel } from '../../core/panels/index';
interface Props {
    panel: Panel;
    onchange: (panel: Panel) => void;
}
declare const PanelEditor: import("svelte").Component<Props, {}, "">;
type PanelEditor = ReturnType<typeof PanelEditor>;
export default PanelEditor;
