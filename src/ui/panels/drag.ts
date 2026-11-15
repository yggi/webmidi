// What the panel's widgets share: a drag that keeps its pointer, and a slider's keys.

/**
 * A drag begun on a control: the pointer is captured, so it stays this control's wherever the finger goes and several
 * fingers move several controls; `move` with each of its events, `end` once when it lifts, is cancelled or is lost.
 */
export function drag(e: PointerEvent, on: { move?: (e: PointerEvent) => void; end: () => void }): void {
  const el = e.currentTarget as HTMLElement;
  const id = e.pointerId;
  try {
    el.setPointerCapture?.(id);
  } catch {
    // (a pointer already gone: the drag still ends on its pointerup)
  }
  const move = (ev: PointerEvent) => ev.pointerId === id && on.move?.(ev);
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    for (const type of ENDS) el.removeEventListener(type, end);
    el.removeEventListener('pointermove', move);
    on.end();
  };
  for (const type of ENDS) el.addEventListener(type, end);
  el.addEventListener('pointermove', move);
}
const ENDS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

/** A step of a value 0 … 1, as MIDI's 127 make it: one step, and a coarse one. */
const STEP = 1 / 127;
const COARSE = 16 / 127;

/** The value a key takes a slider to, or null: the arrows a step, Page Up and Down a coarse one, Home and End its ends. */
export function stepKey(key: string, value: number): number | null {
  const by = { ArrowUp: STEP, ArrowRight: STEP, ArrowDown: -STEP, ArrowLeft: -STEP, PageUp: COARSE, PageDown: -COARSE }[key];
  if (by !== undefined) return Math.max(0, Math.min(1, value + by));
  return key === 'Home' ? 0 : key === 'End' ? 1 : null;
}
