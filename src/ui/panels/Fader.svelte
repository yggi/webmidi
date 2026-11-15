<script lang="ts">
  /**
   * A fader, 0 at the bottom, 1 at the top: pressed anywhere on its track it goes there and follows the finger; the
   * arrows a step. It takes the height its place gives it (a strip's is as tall as the panel), so a panel shown full
   * screen has long faders. Drawn from the panel's palette.
   */
  import { drag, stepKey } from './drag';

  interface Props {
    value: number;
    label: string;
    readout?: string;
    onpress?: () => void;
    onmove: (x: number) => void;
    onlift?: () => void;
  }

  let { value, label, readout, onpress, onmove, onlift }: Props = $props();

  /** The cap's height, in px: the finger's place is the cap's middle. */
  const CAP = 22;

  function down(e: PointerEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.focus();
    onpress?.();
    const rect = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => (rect.height > CAP ? 1 - (ev.clientY - rect.top - CAP / 2) / (rect.height - CAP) : value);
    onmove(at(e));
    drag(e, { move: (ev) => onmove(at(ev)), end: () => onlift?.() });
  }

  function key(e: KeyboardEvent) {
    const to = stepKey(e.key, value);
    if (to === null) return;
    e.preventDefault();
    onmove(to);
  }
</script>

<div
  class="fader"
  role="slider"
  tabindex="0"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(value * 100)}
  aria-valuetext={readout}
  style:--x={value}
  style:--cap="{CAP}px"
  onpointerdown={down}
  onkeydown={key}
>
  <span class="slot" aria-hidden="true"></span>
  <span class="cap" aria-hidden="true"></span>
</div>

<style>
  .fader {
    position: relative;
    flex: 1;
    width: 44px;
    min-height: var(--_fader, 132px);
    border-radius: 8px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .fader:active {
    cursor: grabbing;
  }
  /* the slot the cap runs in, filled up to it */
  .slot {
    position: absolute;
    top: calc(var(--cap) / 2);
    bottom: calc(var(--cap) / 2);
    left: calc(50% - 3px);
    width: 6px;
    border-radius: 3px;
    background: linear-gradient(to top, var(--_tint, var(--_accent)) calc(var(--x) * 100%), var(--_line) 0);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--_text) 8%, transparent) inset;
  }
  .cap {
    position: absolute;
    left: 3px;
    right: 3px;
    bottom: calc(var(--x) * (100% - var(--cap)));
    height: var(--cap);
    border: 1px solid var(--_line);
    border-radius: 5px;
    background: var(--_panel);
    box-shadow:
      0 2px 4px rgb(0 0 0 / 0.22),
      0 1px 0 rgb(255 255 255 / 0.25) inset;
  }
  /* the line across the cap, where it reads */
  .cap::after {
    content: '';
    position: absolute;
    top: calc(50% - 1px);
    left: 5px;
    right: 5px;
    height: 2px;
    border-radius: 1px;
    background: var(--_text);
  }
  .fader:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
