interface Props {
    low: number;
    high: number;
    label?: string;
    /** Notes sounding from elsewhere (a sequence, another input), drawn as held. */
    lit?: ReadonlySet<number>;
    onstrike: (note: number, velocity: number) => void;
    onunstrike: (note: number) => void;
}
declare const Keys: import("svelte").Component<Props, {}, "">;
type Keys = ReturnType<typeof Keys>;
export default Keys;
