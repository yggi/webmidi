<script lang="ts">
  /**
   * A pad with two values, x to the right and y up, each 0 … 1: pressed, the dot goes under the finger and follows
   * it; the arrows a step each way. Drawn from the panel's palette.
   */
  import { drag, stepKey } from './drag';

  interface Props {
    x: number;
    y: number;
    label: string;
    readout?: string;
    onpress?: () => void;
    onmove: (to: { x?: number; y?: number }) => void;
    onlift?: () => void;
  }

  let { x, y, label, readout, onpress, onmove, onlift }: Props = $props();

  function down(e: PointerEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.focus();
    onpress?.();
    const rect = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => (rect.width > 0 && rect.height > 0 ? { x: (ev.clientX - rect.left) / rect.width, y: 1 - (ev.clientY - rect.top) / rect.height } : {});
    onmove(at(e));
    drag(e, { move: (ev) => onmove(at(ev)), end: () => onlift?.() });
  }

  function key(e: KeyboardEvent) {
    const across = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const to = stepKey(e.key, across ? x : y);
    if (to === null || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    onmove(across ? { x: to } : { y: to });
  }
</script>

<div
  class="xy"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(x * 100)}
  aria-valuetext={readout ?? `${Math.round(x * 100)}, ${Math.round(y * 100)}`}
  style:--x={x}
  style:--y={y}
  onpointerdown={down}
  onkeydown={key}
>
  <span class="line across" aria-hidden="true"></span>
  <span class="line up" aria-hidden="true"></span>
  <span class="dot" aria-hidden="true"></span>
</div>

<style>
  .xy {
    position: relative;
    width: calc(var(--_unit, 52px) * 3.2);
    max-width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--_line);
    border-radius: 10px;
    /* a grid of quarters */
    background:
      repeating-linear-gradient(to right, transparent 0 calc(25% - 1px), color-mix(in oklab, var(--_line) 60%, transparent) 0 25%),
      repeating-linear-gradient(to bottom, transparent 0 calc(25% - 1px), color-mix(in oklab, var(--_line) 60%, transparent) 0 25%), var(--_panel);
    cursor: crosshair;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  /* the two lines that cross under the dot */
  .line {
    position: absolute;
    background: color-mix(in oklab, var(--_tint, var(--_accent)) 55%, transparent);
  }
  .line.across {
    left: 0;
    right: 0;
    top: calc((1 - var(--y)) * 100%);
    height: 1px;
  }
  .line.up {
    top: 0;
    bottom: 0;
    left: calc(var(--x) * 100%);
    width: 1px;
  }
  .dot {
    position: absolute;
    left: calc(var(--x) * 100%);
    top: calc((1 - var(--y)) * 100%);
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: 2px solid var(--_panel);
    border-radius: 50%;
    background: var(--_tint, var(--_accent));
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
  }
  .xy:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
