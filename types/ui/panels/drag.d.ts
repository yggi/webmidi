/**
 * A drag begun on a control: the pointer is captured, so it stays this control's wherever the finger goes and several
 * fingers move several controls; `move` with each of its events, `end` once when it lifts, is cancelled or is lost.
 */
export declare function drag(e: PointerEvent, on: {
    move?: (e: PointerEvent) => void;
    end: () => void;
}): void;
/** The value a key takes a slider to, or null: the arrows a step, Page Up and Down a coarse one, Home and End its ends. */
export declare function stepKey(key: string, value: number): number | null;
