<script lang="ts">
  /**
   * The connection, in a strip (docs/proposals/patchbay.md, `MidiStatus`): a light, what Web MIDI said, and the actions
   * that fit it: Connect before, Refresh ports and All notes off after. A setup missing devices turns the light amber
   * and says how many. Presentational: the frontend owns the connection and passes what it says.
   */
  interface Props {
    /** What the connection says now (core's `portsMessage`, or why it couldn't connect). */
    message: string;
    connected: boolean;
    /** Asking for access: Connect waits. */
    connecting?: boolean;
    /** How many devices of the setup in use aren't plugged in. */
    missing?: number;
    onconnect: () => void;
    onrefresh?: () => void;
    /** All notes off, every output: for hardware left sounding. */
    onpanic?: () => void;
    /** Whether there is anything to silence. */
    canPanic?: boolean;
  }

  let { message, connected, connecting = false, missing = 0, onconnect, onrefresh, onpanic, canPanic = true }: Props = $props();
</script>

<div class="wm-status">
  <span class="led" class:on={connected && !missing} class:warn={connected && missing > 0} aria-hidden="true"></span>
  <p role="status">
    {message}{#if connected && missing > 0}<span class="missing">{' · '}{missing} of this setup’s devices {missing === 1 ? 'isn’t' : 'aren’t'} plugged in</span>{/if}
  </p>
  <div class="actions">
    {#if !connected}
      <button type="button" onclick={onconnect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button>
    {:else}
      {#if onrefresh}<button type="button" onclick={onrefresh}>Refresh ports</button>{/if}
      {#if onpanic}<button type="button" onclick={onpanic} disabled={!canPanic}>All notes off</button>{/if}
    {/if}
  </div>
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-status {
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
    .wm-status {
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
  .wm-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_muted);
  }
  p {
    flex: 1 1 220px;
    min-width: 0;
    margin: 0;
  }
  .missing {
    color: var(--_warn);
  }
  .led {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--_off);
  }
  .led.on {
    background: var(--_live);
  }
  .led.warn {
    background: var(--_warn);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  button {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: var(--_text);
    font: 600 14px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
