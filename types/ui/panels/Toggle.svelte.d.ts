interface Props {
    on: boolean;
    label: string;
    /** `button`: on while held; `switch`: flipped by a press. */
    kind: 'button' | 'switch';
    onpress?: () => void;
    onmove: (x: number) => void;
    onlift?: () => void;
}
declare const Toggle: import("svelte").Component<Props, {}, "">;
type Toggle = ReturnType<typeof Toggle>;
export default Toggle;
