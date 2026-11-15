interface Props {
    x: number;
    y: number;
    label: string;
    readout?: string;
    onpress?: () => void;
    onmove: (to: {
        x?: number;
        y?: number;
    }) => void;
    onlift?: () => void;
}
declare const XYPad: import("svelte").Component<Props, {}, "">;
type XYPad = ReturnType<typeof XYPad>;
export default XYPad;
