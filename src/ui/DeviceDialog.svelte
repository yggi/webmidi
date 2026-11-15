<script lang="ts">
  /**
   * An output's details as a dialog over the page: the `DeviceInspector`, opened from the output's head in the matrix
   * (`PatchMatrix` opens it itself), so the matrix holds the patch and nothing of a device's settings. Escape, the ×
   * or a press outside closes it; the focus goes into it and stays there while it is open, and returns to where it
   * was. On a narrow screen it is a sheet from the bottom. It takes what the inspector takes, and `onclose`.
   */
  import type { ComponentProps } from 'svelte';
  import DeviceInspector from './DeviceInspector.svelte';

  type Props = ComponentProps<typeof DeviceInspector> & { onclose: () => void };

  let { onclose, ...inspector }: Props = $props();

  let box: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!box) return;
    const before = document.activeElement as HTMLElement | null;
    box.focus();
    return () => before?.focus?.();
  });

  /** Tab stays inside: past the last it comes back to the first, and the other way. */
  function keys(e: KeyboardEvent) {
    if (e.key === 'Escape') return (e.stopPropagation(), onclose());
    if (e.key !== 'Tab' || !box) return;
    const stops = [...box.querySelectorAll<HTMLElement>('button, select, input, [tabindex="0"]')].filter((el) => !(el as HTMLButtonElement).disabled);
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wm-dialog" onpointerdown={(e) => e.target === e.currentTarget && onclose()} onkeydown={keys}>
  <div
    class="box"
    role="dialog"
    aria-modal="true"
    aria-label="Details of {inspector.output.id === 'none' ? 'this output' : inspector.output.name || inspector.output.id}"
    tabindex="-1"
    bind:this={box}
  >
    <button type="button" class="close" aria-label="Close" onclick={onclose}>×</button>
    <DeviceInspector {...inspector} />
  </div>
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-dialog {
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
    .wm-dialog {
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
  .wm-dialog {
    position: fixed;
    inset: 0;
    z-index: var(--wm-z-dialog, 1000);
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(10 12 18 / 0.5);
    animation: fade 0.12s ease-out;
  }
  .box {
    position: relative;
    width: min(440px, 100%);
    max-height: min(100%, 720px);
    overflow-y: auto;
    border: 1px solid var(--_line);
    border-radius: 14px;
    background: var(--_panel);
    color: var(--_text);
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.35);
    animation: rise 0.16s ease-out;
  }
  .box:focus {
    outline: none;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--_muted);
    font: 500 22px/1 var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .close:hover {
    background: var(--_panel-2);
    color: var(--_text);
  }
  .close:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  @media (max-width: 520px) {
    .wm-dialog {
      place-items: end stretch;
      padding: 0;
    }
    .box {
      width: 100%;
      max-height: 88%;
      border-radius: 16px 16px 0 0;
      border-width: 1px 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .wm-dialog,
    .box {
      animation: none;
    }
  }
</style>
