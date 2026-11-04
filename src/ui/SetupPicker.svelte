<script lang="ts">
  /**
   * The setups (docs/proposals/patchbay.md, `SetupPicker`): each a chip with its light and how many of its devices are
   * plugged in; a custom variant beside its named setup, marked (decision 002). Save… offers to overwrite the named setup
   * with it, to save it under a new name, or to discard it; Manage… renames or removes the named setup in use. A setup
   * whose every device is plugged in is suggested when the one in use misses one. Export writes the setup in use as a
   * file, Import reads one. It takes the book and calls back a new one (`onchange`).
   */
  import type { PortOption } from '../core/port';
  import {
    activeSetup,
    changedFrom,
    discard,
    exportSetup,
    fit,
    importSetup,
    overwrite,
    removeSetup,
    renameSetup,
    saveAs,
    suggestSetup,
    useSetup,
    type SetupBook,
  } from '../core/setups';

  interface Props {
    book: SetupBook;
    /** The outputs plugged in now. */
    plugged: readonly PortOption[];
    onchange: (book: SetupBook) => void;
    /** A setup's file to save, by name; by default the browser downloads it. */
    onexport?: (text: string, filename: string) => void;
  }

  let { book, plugged, onchange, onexport = download }: Props = $props();

  const active = $derived(activeSetup(book));
  const base = $derived(changedFrom(book));
  const suggested = $derived(suggestSetup(book, plugged));
  const named = $derived(book.setups.filter((s) => s.base === undefined).length);
  let panel: 'save' | 'manage' | null = $state(null);
  let name = $state('');
  let confirming = $state(false);
  let problem: string | null = $state(null);
  let file: HTMLInputElement | undefined = $state();
  const uid = $props.id();

  /** A panel opened, its name field filled. */
  function open(which: 'save' | 'manage') {
    panel = panel === which ? null : which;
    confirming = false;
    name = which === 'save' ? `${base?.name ?? active.name} 2` : active.name;
  }

  /** A change made, and the panel closed. */
  function done(next: SetupBook) {
    panel = null;
    problem = null;
    onchange(next);
  }

  function download(text: string, filename: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    // revoked a moment later: an older Safari drops a download whose URL is revoked in the tick that clicked it
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function read(e: Event & { currentTarget: HTMLInputElement }) {
    const chosen = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!chosen) return;
    const next = importSetup(book, await chosen.text());
    if (typeof next === 'string') problem = next;
    else done(next);
  }

  const filename = (s: string) => `${s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'setup'}.midisetup.json`;
</script>

<div class="wm-setups">
  <span class="label" id="{uid}-label">Setup</span>
  <div class="chips" role="group" aria-labelledby="{uid}-label">
    {#each book.setups as s (s.id)}
      {@const f = fit(s, plugged)}
      {@const whole = f.of > 0 && f.plugged === f.of}
      <button type="button" class="chip" class:custom={s.base !== undefined} aria-pressed={s.id === book.active} onclick={() => done(useSetup(book, s.id))}>
        <span class="led" class:on={whole} class:warn={!whole && f.plugged > 0} aria-hidden="true"></span>
        {s.name}
        {#if s.base !== undefined}<span class="dot" title="Changed, kept as a custom variant">●</span>{/if}
        <span class="fit" class:whole title="Devices plugged in">{f.plugged}/{f.of}</span>
      </button>
    {/each}
  </div>
  <div class="actions">
    <button type="button" onclick={() => open('save')} disabled={!base} aria-expanded={panel === 'save'}>Save…</button>
    <button type="button" class="ghost" onclick={() => open('manage')} disabled={!!base} aria-expanded={panel === 'manage'}>Manage…</button>
    <button type="button" class="ghost" onclick={() => onexport(exportSetup(book), filename(active.name))}>Export</button>
    <button type="button" class="ghost" onclick={() => file?.click()}>Import</button>
    <input type="file" accept=".json,application/json" hidden bind:this={file} onchange={read} aria-label="A setup’s file" />
  </div>

  {#if suggested}
    <p class="line">
      <span class="led on" aria-hidden="true"></span>Every device of <b>{suggested.name}</b> is plugged in.
      <button type="button" onclick={() => done(useSetup(book, suggested.id))}>Switch to it</button>
    </p>
  {/if}
  {#if problem}<p class="line problem" role="alert">{problem}</p>{/if}

  {#if panel === 'save' && base}
    <form class="panel" onsubmit={(e) => (e.preventDefault(), done(saveAs(book, name)))}>
      <button type="button" class="primary" onclick={() => done(overwrite(book))}>Overwrite {base.name}</button>
      <span class="or">or</span>
      <input aria-label="Name of the new setup" bind:value={name} />
      <button type="submit">Save as new</button>
      <span class="grow"></span>
      <button type="button" class="ghost" onclick={() => done(discard(book))}>Discard changes</button>
    </form>
  {:else if panel === 'manage'}
    <form class="panel" onsubmit={(e) => (e.preventDefault(), done(renameSetup(book, active.id, name)))}>
      <input aria-label="Name of {active.name}" bind:value={name} />
      <button type="submit">Rename</button>
      <span class="grow"></span>
      {#if confirming}
        <span>Remove {active.name}?</span>
        <button type="button" class="danger" onclick={() => done(removeSetup(book, active.id))}>Remove</button>
        <button type="button" class="ghost" onclick={() => (confirming = false)}>Keep it</button>
      {:else}
        <button type="button" class="ghost" disabled={named < 2} title={named < 2 ? 'The last setup stays' : undefined} onclick={() => (confirming = true)}>Remove…</button>
      {/if}
    </form>
  {/if}
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-setups {
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
    .wm-setups {
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
  .wm-setups {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  .label {
    font: 600 12px/1 var(--wm-font, system-ui, sans-serif);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--_muted);
  }
  .chips {
    display: flex;
    flex: 1 1 420px;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 12px 0 10px;
    border: 1px solid var(--_line);
    border-radius: 999px;
    background: var(--_panel-2);
    color: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .chip.custom {
    border-style: dashed;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--_accent);
    box-shadow: 0 0 0 1px var(--_accent) inset;
    background: var(--_panel);
  }
  .dot {
    color: var(--_warn);
  }
  .fit {
    font: 500 12px var(--wm-font-num, ui-monospace, monospace);
    color: var(--_muted);
  }
  .fit.whole {
    color: var(--_live);
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
    gap: 6px;
  }
  .line {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--_muted);
  }
  .problem {
    color: var(--_warn);
  }
  .panel {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: var(--_panel-2);
  }
  .or {
    color: var(--_faint);
  }
  .grow {
    flex: 1 1 auto;
  }
  input {
    flex: 1 1 160px;
    min-width: 0;
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: inherit;
    font: inherit;
  }
  button:not(.chip) {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: var(--_text);
    font: 600 14px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  button.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--_muted);
  }
  button.primary {
    border-color: var(--_accent);
    background: var(--_accent);
    color: var(--_panel);
  }
  button.danger {
    border-color: var(--_warn);
    color: var(--_warn);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  :is(button, input):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
