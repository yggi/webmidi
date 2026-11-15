import type { Panel } from '../../core/panels/index';
interface Props {
    panel: Panel;
    /** Each message a touch makes, in order: the frontend sends it on the panel's row. */
    onsend: (data: number[]) => void;
    /** Whether its name and the full-screen button are shown (true by default). */
    bar?: boolean;
}
declare const PanelView: import("svelte").Component<Props, {
    receive: (data: ArrayLike<number>) => void;
    silence: () => void;
}, "">;
type PanelView = ReturnType<typeof PanelView>;
export default PanelView;
