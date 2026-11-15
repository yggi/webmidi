interface Props {
    notes: readonly number[];
    label: string;
    /** The velocity a pad strikes at. */
    velocity?: number;
    onstrike: (note: number, velocity: number) => void;
    onunstrike: (note: number) => void;
}
declare const Pads: import("svelte").Component<Props, {}, "">;
type Pads = ReturnType<typeof Pads>;
export default Pads;
