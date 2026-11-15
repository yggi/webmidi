<script lang="ts">
  /**
   * Drum pads, one for each note, four to a row: a press strikes its note, the lift releases it. Each pad keeps its
   * pointer, so several fingers play several pads. Drawn from the panel's palette.
   */
  import { keyName } from '../../core/keyboard';
  import { drag } from './drag';

  interface Props {
    notes: readonly number[];
    label: string;
    /** The velocity a pad strikes at. */
    velocity?: number;
    onstrike: (note: number, velocity: number) => void;
    onunstrike: (note: number) => void;
  }

  let { notes, label, velocity = 100, onstrike, onunstrike }: Props = $props();

  let down: number[] = $state([]);
  const hit = (note: number) => ((down = [...down, note]), onstrike(note, velocity));
  const lift = (note: number) => ((down = down.filter((n) => n !== note)), onunstrike(note));
  const isKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
</script>

<div class="pads" role="group" aria-label={label} style:--n={Math.min(4, notes.length)}>
  {#each notes as note (note)}
    <button
      type="button"
      class="pad"
      aria-pressed={down.includes(note)}
      aria-label="{label} {keyName(note)}"
      onpointerdown={(e) => (e.preventDefault(), hit(note), drag(e, { end: () => lift(note) }))}
      onkeydown={(e) => isKey(e) && !e.repeat && (e.preventDefault(), hit(note))}
      onkeyup={(e) => isKey(e) && (e.preventDefault(), lift(note))}>{note}</button
    >
  {/each}
</div>

<style>
  .pads {
    display: grid;
    grid-template-columns: repeat(var(--n), var(--_unit, 52px));
    gap: 8px;
  }
  .pad {
    aspect-ratio: 1;
    padding: 0 0 4px 6px;
    border: 1px solid var(--_line);
    border-radius: 10px;
    background: var(--_panel);
    box-shadow: 0 2px 0 color-mix(in oklab, var(--_text) 14%, transparent);
    color: var(--_faint);
    font: 600 10px/1 var(--wm-font-num, ui-monospace, monospace);
    text-align: left;
    display: grid;
    align-items: end;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .pad[aria-pressed='true'] {
    border-color: var(--_tint, var(--_accent));
    background: color-mix(in oklab, var(--_tint, var(--_accent)) 30%, var(--_panel));
    box-shadow: 0 0 12px color-mix(in oklab, var(--_tint, var(--_accent)) 45%, transparent);
    color: var(--_text);
    transform: translateY(2px);
  }
  .pad:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
