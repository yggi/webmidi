<script lang="ts">
  /**
   * The standalone patchbay, drawn: the connection, the setups, the patch (inputs and panels down, outputs and panels
   * across), the panel being played, and the last messages that went through. Everything it does is `Bay`'s.
   */
  import { activeSetup, panelsOf } from '../src/core/index';
  import { panelOf } from '../src/core/panels/index';
  import { MidiStatus, PatchMatrix, SetupPicker } from '../src/ui/index';
  import { PanelView } from '../src/ui/panels/index';
  import { CONTEXT, type Bay } from './bay.svelte';

  let { bay }: { bay: Bay } = $props();

  const active = $derived(panelsOf(activeSetup(bay.book)).flatMap((id) => panelOf(bay.library, id) ?? []));
  const runtime = $derived(bay.runtimeOf(bay.shown));
  let problem: string | null = $state(null);
  let file: HTMLInputElement | undefined = $state();

  async function chosen() {
    const picked = file?.files?.[0];
    if (!picked) return;
    problem = bay.importPanel(await picked.text());
    if (file) file.value = '';
  }

  function save() {
    const out = bay.shown === null ? null : bay.exportPanel(bay.shown);
    if (!out) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.text], { type: 'application/json' }));
    a.download = out.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
</script>

<main>
  <header>
    <h1>webmidi patchbay</h1>
    <p>Route MIDI between the devices plugged in, and play control panels of your own, in the browser.</p>
  </header>

  <section class="card">
    <MidiStatus
      message={bay.message}
      connected={bay.connected}
      connecting={bay.connecting}
      missing={bay.missing}
      onconnect={() => bay.connect()}
      onrefresh={() => bay.refresh()}
      onpanic={() => bay.panic()}
      connectLabel="Connect MIDI"
    />
  </section>

  <section class="card">
    <SetupPicker book={bay.book} plugged={bay.outputs} onchange={(book) => bay.keep(book)} />
  </section>

  <section class="card">
    <h2>Patch</h2>
    <PatchMatrix
      book={bay.book}
      context={CONTEXT}
      rows={[]}
      inputs={bay.inputs}
      outputs={bay.outputs}
      panels={bay.library.panels}
      clock={false}
      onchange={(book) => bay.keep(book)}
      onpanel={(id) => (bay.shown = id)}
      ontest={(key) => bay.test(key)}
      onpanic={(key) => bay.panic(key)}
    />
  </section>

  <section class="card">
    <div class="bar">
      <h2>Panels</h2>
      <div class="tabs" role="tablist" aria-label="The panels in this setup">
        {#each active as p (p.id)}
          <button type="button" role="tab" aria-selected={bay.shown === p.id} onclick={() => (bay.shown = p.id)}>{p.name}</button>
        {/each}
      </div>
      <span class="grow"></span>
      <button type="button" onclick={() => file?.click()}>Open a panel’s file…</button>
      <button type="button" onclick={save} disabled={!runtime}>Save this panel’s file</button>
      <input bind:this={file} type="file" accept=".json,application/json" hidden onchange={chosen} />
    </div>
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    {#if runtime && bay.shown !== null}
      {@const id = bay.shown}
      {#key runtime}
        <PanelView {runtime} onsend={(data) => bay.played(id, data)} />
      {/key}
    {:else}
      <p class="hint">No panel in this setup yet: add one from the chips over the patch, then route its row to an output.</p>
    {/if}
  </section>

  <section class="card">
    <h2>Through the patch</h2>
    {#if bay.seen.length}
      <ol class="seen">
        {#each bay.seen as s, i (i)}<li><code>{s.bytes}</code><span>{s.from} → {s.to}</span></li>{/each}
      </ol>
    {:else}
      <p class="hint">Nothing yet. A message appears here when a crossing sends it on.</p>
    {/if}
    <p class="hint">A browser passes each message on when the page gets to it, so this adds a little time to every one: fine for a fader, audible on tight drums.</p>
  </section>
</main>

<style>
  :global(:root) {
    --bg: #eceef2;
    --card: #f8f9fb;
    --ink: #1c2029;
    --muted: #5a6172;
    --line: #c9ced8;
    --warn: #c47a12;
    --wm-surface: var(--card);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #15171c;
      --card: #1d2027;
      --ink: #e9ebf0;
      --muted: #a2a8b6;
      --line: #343945;
      --warn: #f0a63a;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font:
      15px/1.45 system-ui,
      sans-serif;
  }
  main {
    display: grid;
    gap: 14px;
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px max(16px, env(safe-area-inset-right, 0px)) 40px max(16px, env(safe-area-inset-left, 0px));
  }
  h1 {
    margin: 0;
    font-size: 26px;
    line-height: 1.1;
  }
  header p {
    margin: 4px 0 0;
    color: var(--muted);
  }
  h2 {
    margin: 0;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .card {
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--card);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .grow {
    flex: 1;
  }
  button {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: inherit;
    font:
      600 13px system-ui,
      sans-serif;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button[aria-selected='true'] {
    border-color: currentColor;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .problem {
    margin: 0;
    color: var(--warn);
  }
  .seen {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
  }
  .seen li {
    display: flex;
    gap: 12px;
  }
  .seen code {
    min-width: 9ch;
    font:
      500 13px ui-monospace,
      monospace;
  }
  .seen span {
    color: var(--muted);
  }
</style>
