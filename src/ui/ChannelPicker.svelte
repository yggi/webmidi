<script lang="ts">
  /**
   * The channel of a crossing, chosen from 16 pads in their hues (docs/proposals/patchbay.md): a dot marks a channel
   * another row already sends on to this output; "As played" for an input's row; "Not sent" clears it. A small dialog
   * beside the jack it opened from; Escape or a press outside closes it.
   */
  import { AS_PLAYED, type Crossing } from '../core/setups';
  import { CHANNELS, channelHue } from './channels';

  interface Props {
    /** What is routed where, as a heading: "&lead → Minilogue xd". */
    label: string;
    value: Crossing | undefined;
    /** The channels other rows send on to this output. */
    busy?: readonly number[];
    /** Whether "As played" is offered: an input's row. */
    asPlayed?: boolean;
    /** Where the jack is, to sit beside it. */
    anchor: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
    onpick: (value: Crossing | undefined) => void;
    onclose: () => void;
  }

  let { label, value, busy = [], asPlayed = false, anchor, onpick, onclose }: Props = $props();

  let box: HTMLDivElement | undefined = $state();
  let place = $state({ left: 0, top: 0 });
  const WIDTH = 236;

  $effect(() => {
    if (!box) return;
    const h = box.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(vw - WIDTH - 12, Math.max(12, (anchor.left + anchor.right) / 2 - WIDTH / 2));
    const below = anchor.bottom + 6;
    place = { left, top: below + h > vh - 12 ? Math.max(12, anchor.top - h - 6) : below };
    (box.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? box.querySelector('button'))?.focus();
  });

  function outside(e: PointerEvent) {
    if (box && !box.contains(e.target as Node)) onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} onpointerdown={outside} />

<div class="wm-picker" role="dialog" aria-label="Channel of {label}" bind:this={box} style:left="{place.left}px" style:top="{place.top}px" style:width="{WIDTH}px">
  <p class="head">{label}</p>
  <div class="pads">
    {#each CHANNELS as ch (ch)}
      <button
        type="button"
        style:--h={channelHue(ch)}
        aria-pressed={value === ch}
        class:busy={busy.includes(ch)}
        title={busy.includes(ch) ? 'Another row already sends on this channel here' : undefined}
        onclick={() => onpick(ch)}>{ch}</button
      >
    {/each}
  </div>
  <div class="row">
    {#if asPlayed}<button type="button" class="plain" aria-pressed={value === AS_PLAYED} onclick={() => onpick(AS_PLAYED)}>= As played</button>{/if}
    <button type="button" class="plain" onclick={() => onpick(undefined)}>Not sent</button>
  </div>
  {#if busy.length}<p class="note">• another row already sends on it here</p>{/if}
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-picker {
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
    .wm-picker {
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
  .wm-picker {
    position: fixed;
    z-index: 20;
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--_line);
    border-radius: 10px;
    background: var(--_panel);
    color: var(--_text);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
  }
  p {
    margin: 0;
  }
  .head {
    font-weight: 600;
  }
  .note {
    font-size: 13px;
    color: var(--_muted);
  }
  .pads {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .pads button {
    height: 38px;
    border: 0;
    border-radius: 7px;
    background: oklch(var(--wm-chip-l, 0.72) var(--wm-chip-c, 0.13) var(--h));
    color: var(--wm-chip-ink, #10131a);
    font: 700 14px var(--wm-font-num, ui-monospace, monospace);
    cursor: pointer;
  }
  .pads button[aria-pressed='true'] {
    outline: 2px solid var(--_text);
    outline-offset: 1px;
  }
  .pads button.busy::after {
    content: '•';
    margin-left: 2px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .plain {
    flex: 1;
    min-height: 34px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: var(--_text);
    font: 600 14px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .plain[aria-pressed='true'] {
    border-color: var(--_accent);
  }
  button:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
