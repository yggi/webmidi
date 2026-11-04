<script lang="ts">
  /**
   * The 16 channels of an output in a row (docs/proposals/patchbay.md): each in its hue when something is routed to it
   * there, brighter while it sounds, numbered under.
   */
  import { CHANNELS, channelHue } from './channels';

  interface Props {
    /** The channels routed to this output. */
    used?: readonly number[];
    /** The channels sounding now. */
    lit?: ReadonlySet<number>;
    label?: string;
  }

  let { used = [], lit = new Set(), label = 'Channels in use' }: Props = $props();
</script>

<div class="wm-meter" role="img" aria-label="{label}: {used.length ? [...used].sort((a, b) => a - b).join(', ') : 'none'}">
  {#each CHANNELS as ch (ch)}
    <span class="cell" class:on={used.includes(ch)} class:lit={lit.has(ch)} style:--h={channelHue(ch)} data-channel={ch}></span>
  {/each}
  {#each CHANNELS as ch (ch)}<span class="num" aria-hidden="true">{ch}</span>{/each}
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-meter {
    --_text: var(--wm-text, #1c2029);
    --_muted: var(--wm-muted, #5a6172);
    --_faint: var(--wm-faint, #8b91a0);
    --_off: var(--wm-off, #b8bdc8);
    --_line: var(--wm-line, #c9ced8);
    --_panel: var(--wm-panel, #f8f9fb);
    --_panel-2: var(--wm-panel-2, #e2e5eb);
    --_accent: var(--wm-accent, #2f62d8);
    --_live: var(--wm-live, #1f9d55);
    --_warn: var(--wm-warn, #c47a12);
  }
  @media (prefers-color-scheme: dark) {
    .wm-meter {
      --_text: var(--wm-text, #e9ebf0);
      --_muted: var(--wm-muted, #a2a8b6);
      --_faint: var(--wm-faint, #6c7282);
      --_off: var(--wm-off, #4a505e);
      --_line: var(--wm-line, #343945);
      --_panel: var(--wm-panel, #1d2027);
      --_panel-2: var(--wm-panel-2, #262a33);
      --_accent: var(--wm-accent, #7aa2ff);
      --_live: var(--wm-live, #3fd17f);
      --_warn: var(--wm-warn, #f0a63a);
    }
  }
  /* end palette */
  .wm-meter {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 3px;
  }
  .cell {
    height: 16px;
    border-radius: 3px;
    background: var(--_panel-2);
  }
  .cell.on {
    background: oklch(var(--wm-chip-l, 0.7) var(--wm-chip-c, 0.13) var(--h));
  }
  .cell.lit {
    background: oklch(var(--wm-chip-l, 0.7) var(--wm-chip-c, 0.13) var(--h));
    filter: brightness(1.35);
  }
  .num {
    font: 500 10px var(--wm-font-num, ui-monospace, monospace);
    text-align: center;
    color: var(--_faint);
  }
</style>
