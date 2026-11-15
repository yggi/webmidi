interface Props {
    value: number;
    label: string;
    readout?: string;
    onpress?: () => void;
    onmove: (x: number) => void;
    onlift?: () => void;
}
declare const Fader: import("svelte").Component<Props, {}, "">;
type Fader = ReturnType<typeof Fader>;
export default Fader;
