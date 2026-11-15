<script lang="ts">
  /**
   * A button, on while it is held, or a switch, which a press flips: a key with a light that is on with it. A
   * button's pointer is kept, so a finger that slides off it still releases it. Drawn from the panel's palette.
   */
  import { drag } from './drag';

  interface Props {
    on: boolean;
    label: string;
    /** `button`: on while held; `switch`: flipped by a press. */
    kind: 'button' | 'switch';
    onpress?: () => void;
    onmove: (x: number) => void;
    onlift?: () => void;
  }

  let { on, label, kind, onpress, onmove, onlift }: Props = $props();

  function down(e: PointerEvent) {
    if (kind !== 'button') return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus();
    hold();
    drag(e, { end: release });
  }
  const hold = () => (onpress?.(), onmove(1));
  const release = () => (onmove(0), onlift?.());
  const isKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
</script>

{#if kind === 'switch'}
  <button type="button" class="toggle" role="switch" aria-checked={on} aria-label={label} onclick={() => onmove(on ? 0 : 1)}><span class="light" aria-hidden="true"></span></button>
{:else}
  <button
    type="button"
    class="toggle"
    aria-pressed={on}
    aria-label={label}
    onpointerdown={down}
    onkeydown={(e) => isKey(e) && !e.repeat && (e.preventDefault(), hold())}
    onkeyup={(e) => isKey(e) && (e.preventDefault(), release())}><span class="light" aria-hidden="true"></span></button
  >
{/if}

<style>
  .toggle {
    display: grid;
    place-items: center;
    width: var(--_unit, 52px);
    height: calc(var(--_unit, 52px) * 0.8);
    padding: 0;
    border: 1px solid var(--_line);
    border-radius: 9px;
    background: var(--_panel);
    box-shadow:
      0 2px 0 color-mix(in oklab, var(--_text) 14%, transparent),
      0 1px 0 rgb(255 255 255 / 0.2) inset;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition:
      transform 0.06s,
      box-shadow 0.06s;
  }
  .light {
    width: 16px;
    height: 5px;
    border-radius: 3px;
    background: var(--_off);
    transition: background 0.08s;
  }
  /* on: pressed in, its light lit */
  .toggle:is([aria-pressed='true'], [aria-checked='true']) {
    border-color: color-mix(in oklab, var(--_tint, var(--_accent)) 60%, var(--_line));
    background: color-mix(in oklab, var(--_tint, var(--_accent)) 12%, var(--_panel));
    box-shadow: 0 0 0 color-mix(in oklab, var(--_text) 14%, transparent);
    transform: translateY(2px);
  }
  .toggle:is([aria-pressed='true'], [aria-checked='true']) .light {
    background: var(--_tint, var(--_accent));
    box-shadow: 0 0 8px color-mix(in oklab, var(--_tint, var(--_accent)) 70%, transparent);
  }
  .toggle:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .toggle,
    .light {
      transition: none;
    }
  }
</style>
