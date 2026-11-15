<script lang="ts">
  /**
   * A knob, 0 … 1 over three quarters of a turn: dragged up or to the right to turn it up, the arrows a step, a double
   * press back to where it rests. Drawn from the panel's palette (`PanelView`'s, or a parent's `--_*`).
   */
  import { drag, stepKey } from './drag';

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

  let { value, label, readout, rest = 0, onpress, onmove, onlift }: Props = $props();

  /** How far a drag goes for the whole range, in px. */
  const TRAVEL = 170;
  const R = 19;
  const ARC = 2 * Math.PI * R * 0.75;

  function down(e: PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus();
    onpress?.();
    const from = { value, x: e.clientX, y: e.clientY };
    drag(e, { move: (ev) => onmove(from.value + (from.y - ev.clientY + ev.clientX - from.x) / TRAVEL), end: () => onlift?.() });
  }

  function key(e: KeyboardEvent) {
    const to = stepKey(e.key, value);
    if (to === null) return;
    e.preventDefault();
    onmove(to);
  }
</script>

<div
  class="knob"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(value * 100)}
  aria-valuetext={readout}
  onpointerdown={down}
  onkeydown={key}
  ondblclick={() => onmove(rest)}
>
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <g transform="rotate(135 24 24)" fill="none" stroke-width="3.5" stroke-linecap="round">
      <circle class="track" cx="24" cy="24" r={R} stroke-dasharray="{ARC} 200" />
      {#if value > 0.004}<circle class="arc" cx="24" cy="24" r={R} stroke-dasharray="{ARC * value} 200" />{/if}
    </g>
    <circle class="cap" cx="24" cy="24" r="13.5" />
    <line class="mark" x1="24" y1="13" x2="24" y2="19.5" transform="rotate({-135 + 270 * value} 24 24)" />
  </svg>
</div>

<style>
  .knob {
    width: var(--_unit, 52px);
    aspect-ratio: 1;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .knob:active {
    cursor: grabbing;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .track {
    stroke: var(--_line);
  }
  .arc {
    stroke: var(--_tint, var(--_accent));
  }
  .cap {
    fill: var(--_panel);
    stroke: var(--_line);
    stroke-width: 1;
    filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.22));
  }
  .mark {
    stroke: var(--_text);
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .knob:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 3px;
  }
</style>
