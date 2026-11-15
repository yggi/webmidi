interface Props {
    value: number;
    label: string;
    /** What it reads as: the number on the wire. */
    readout?: string;
    /** Where a double press puts it. */
    rest?: number;
    onpress?: () => void;
    onmove: (x: number) => void;
    onlift?: () => void;
}
declare const Knob: import("svelte").Component<Props, {}, "">;
type Knob = ReturnType<typeof Knob>;
export default Knob;
