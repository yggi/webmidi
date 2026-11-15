<script lang="ts">
  /**
   * A panel to play (decision 005; `PlayView` in the proposal): the panel instantiated and laid out, each control a
   * widget, driven by core's `PanelRuntime`. A touch calls `onsend` with each message it makes, for the frontend to send
   * where the panel's row of the patch says (`forwardsOf`); a message the panel's column is sent goes to `receive`,
   * which moves its controls. Full screen on its button, or over the whole window where the browser has no full
   * screen (an iPhone). Leaving it, or taking it off the page, releases every note it holds.
   *
   * Layout: a group with no `columns` is a row, one with `columns: 1` a strip (its fader as tall as the panel), any
   * other a grid; a child's `cell` places it. What the panel couldn't resolve is said under its name.
   */
  import { PanelRuntime, type ControlInstance, type InstanceNode } from '../../core/panels/index';
  import { samePath, type Cell, type NodePath, type Panel } from '../../core/panels/index';
  import { isBlackKey } from '../../core/keyboard';
  import Fader from './Fader.svelte';
  import Keys from './Keys.svelte';
  import Knob from './Knob.svelte';
  import Pads from './Pads.svelte';
  import Toggle from './Toggle.svelte';
  import XYPad from './XYPad.svelte';

  interface Props {
    /** The panel to play, with a runtime of the view's own; or `runtime`. */
    panel?: Panel;
    /**
     * A runtime the frontend keeps (a `PanelRack`'s: the panel plays on, and follows what it is sent, while no view
     * shows it). The view draws it and plays it, and leaves its notes to the frontend when it goes.
     */
    runtime?: PanelRuntime;
    /** Each message a touch makes, in order: the frontend sends it on the panel's row. */
    onsend: (data: number[]) => void;
    /** Whether its name and the full-screen button are shown (true by default). */
    bar?: boolean;
    /**
     * Given, the view is an editor's: a control or a group pressed is chosen, not played (its place in the panel, the
     * same for every instance of one definition), and a press on the panel's ground chooses none.
     */
    onselect?: (source: NodePath | null) => void;
    /** The place chosen: every instance of it is marked. */
    selected?: NodePath | null;
  }

  let { panel, runtime: given, onsend, bar = true, onselect, selected = null }: Props = $props();

  /** A press that chooses, in an editor: it goes no further, so a control in a group chooses the control. */
  const choose = (e: Event, source: NodePath | null) => {
    if (!onselect) return;
    e.stopPropagation();
    onselect(source);
  };
  const byKey = (e: KeyboardEvent, source: NodePath) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), choose(e, source));

  const NOTHING: Panel = { id: '', name: '', children: [] };
  const runtime = $derived(given ?? new PanelRuntime(panel ?? NOTHING));
  /** Bumped with every change of a value: the runtime keeps the values and says when one changes, and a widget reads its own through this. */
  let turn = $state(0);
  const valueOf = (key: string) => (void turn, runtime.value(key));
  const send = (messages: number[][]) => messages.forEach((m) => onsend(m));

  $effect(() => runtime.watch(() => turn++));
  // its own panel replaced, or the view gone: every note it holds is released (a runtime it was given is the frontend's)
  $effect(() => {
    const playing = runtime;
    const own = !given;
    return () => own && playing.silence().forEach((m) => onsend(m));
  });

  /** A message the panel's column was sent: its controls move (and nothing is sent back). */
  export function receive(data: ArrayLike<number>): void {
    runtime.receive(data);
  }

  /** Every note sounding released, as on leaving. */
  export function silence(): void {
    send(runtime.silence());
  }

  /** What a control reads as: the number its first binding has on the wire. */
  function readout(c: ControlInstance, x: number): string | undefined {
    const b = c.bindings[0];
    return b ? String(Math.round(b.lo + x * (b.hi - b.lo))) : undefined;
  }

  /** How much of the panel couldn't be resolved, in a line. */
  const unread = $derived.by(() => {
    const n = runtime.panel.errors.length;
    return `${n} ${n === 1 ? 'thing' : 'things'} in this panel couldn’t be read, and ${n === 1 ? 'is' : 'are'} left out`;
  });

  const place = (cell?: Cell) => (cell ? `grid-column: ${cell.column ?? 'auto'} / span ${cell.columns ?? 1}; grid-row: ${cell.row ?? 'auto'} / span ${cell.rows ?? 1};` : '');
  const grid = (columns?: number) => (columns && columns > 1 ? `grid-template-columns: repeat(${columns}, minmax(0, auto));` : '');
  const shape = (columns?: number) => (!columns ? 'row' : columns === 1 ? 'strip' : 'grid');

  let root: HTMLDivElement | undefined = $state();
  /** Shown over everything: in the browser's full screen, or filling the window where it has none. */
  let full = $state(false);
  let filling = $state(false);
  async function toggleFull() {
    if (!root) return;
    if (document.fullscreenElement === root) return void document.exitFullscreen?.();
    if (filling) return void ((filling = false), (full = false));
    try {
      if (!root.requestFullscreen) throw new Error('no full screen');
      await root.requestFullscreen();
    } catch {
      filling = full = true;
    }
  }
</script>

<svelte:document onfullscreenchange={() => (full = filling || document.fullscreenElement === root)} />
<svelte:window onkeydown={(e) => e.key === 'Escape' && filling && ((filling = false), (full = false))} />

{#snippet control(c: ControlInstance)}
  {@const v = valueOf(c.key)}
  {@const name = c.label || c.key}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
  <div
    class="ctl {c.type}"
    class:picked={samePath(c.source, selected)}
    style={place(c.cell)}
    style:--whites={c.type === 'keyboard' ? c.notes.filter((n) => !isBlackKey(n)).length : undefined}
    role={onselect ? 'button' : undefined}
    tabindex={onselect ? 0 : undefined}
    aria-label={onselect ? `Edit ${name}` : undefined}
    aria-pressed={onselect ? samePath(c.source, selected) : undefined}
    onclick={(e) => choose(e, c.source)}
    onkeydown={(e) => onselect && byKey(e, c.source)}
  >
    <div class="widget" inert={!!onselect}>
      {#if c.type === 'knob'}
        <Knob
          value={v.x}
          label={name}
          readout={readout(c, v.x)}
          rest={c.value}
          onpress={() => runtime.press(c.key)}
          onmove={(x) => send(runtime.move(c.key, { x }))}
          onlift={() => runtime.lift(c.key)}
        />
      {:else if c.type === 'fader'}
        <Fader
          value={v.x}
          label={name}
          readout={readout(c, v.x)}
          onpress={() => runtime.press(c.key)}
          onmove={(x) => send(runtime.move(c.key, { x }))}
          onlift={() => runtime.lift(c.key)}
        />
      {:else if c.type === 'xy'}
        <XYPad x={v.x} y={v.y} label={name} onpress={() => runtime.press(c.key)} onmove={(to) => send(runtime.move(c.key, to))} onlift={() => runtime.lift(c.key)} />
      {:else if c.type === 'button' || c.type === 'switch'}
        <Toggle on={v.x > 0} label={name} kind={c.type} onpress={() => runtime.press(c.key)} onmove={(x) => send(runtime.move(c.key, { x }))} onlift={() => runtime.lift(c.key)} />
      {:else if c.type === 'keyboard'}
        <Keys
          low={c.notes[0] ?? 48}
          high={c.notes.at(-1) ?? 72}
          label={name}
          onstrike={(n, vel) => send(runtime.strike(c.key, n, vel))}
          onunstrike={(n) => send(runtime.unstrike(c.key, n))}
        />
      {:else if c.type === 'pads'}
        <Pads notes={c.notes} label={name} onstrike={(n, vel) => send(runtime.strike(c.key, n, vel))} onunstrike={(n) => send(runtime.unstrike(c.key, n))} />
      {/if}
    </div>
    {#if c.label}<span class="name" class:text={c.type === 'label'}>{c.label}</span>{/if}
    {#if (c.type === 'knob' || c.type === 'fader') && c.bindings.length}<span class="num" aria-hidden="true">{readout(c, v.x)}</span>{/if}
  </div>
{/snippet}

{#snippet node(n: InstanceNode)}
  {#if n.kind === 'control'}
    {@render control(n)}
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex, a11y_click_events_have_key_events -->
    <section
      class="group {shape(n.columns)}"
      class:picked={samePath(n.source, selected)}
      style={place(n.cell)}
      aria-label={n.label || n.key}
      tabindex={onselect ? 0 : undefined}
      onclick={(e) => choose(e, n.source)}
      onkeydown={(e) => onselect && byKey(e, n.source)}
    >
      {#if n.label}<h4>{n.label}</h4>{/if}
      <div class="cells {shape(n.columns)}" style={grid(n.columns)}>
        {#each n.children as child (child.key)}{@render node(child)}{/each}
      </div>
    </section>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="wm-panel" class:full class:filling class:editing={!!onselect} bind:this={root} onclick={(e) => choose(e, null)}>
  {#if bar}
    <header>
      <span class="title">{runtime.panel.name}</span>
      <button type="button" class="fs" aria-pressed={full} onclick={toggleFull}>{full ? 'Exit full screen' : 'Full screen'}</button>
    </header>
  {/if}
  {#if runtime.panel.errors.length}
    <details class="errors">
      <summary>{unread}</summary>
      <ul>
        {#each runtime.panel.errors as e, i (i)}<li>{e}</li>{/each}
      </ul>
    </details>
  {/if}
  <div class="surface cells {shape(runtime.panel.columns)}" style={grid(runtime.panel.columns)}>
    {#each runtime.panel.children as child (child.key)}{@render node(child)}{/each}
  </div>
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-panel {
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
    .wm-panel {
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
  .wm-panel {
    --_unit: var(--wm-panel-unit, 52px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  /* shown over everything: the browser's full screen, or the whole window */
  .wm-panel:fullscreen,
  .wm-panel.filling {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: max(14px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) max(14px, env(safe-area-inset-bottom, 0px))
      max(14px, env(safe-area-inset-left, 0px));
    background: var(--wm-surface, var(--_panel));
    /* the controls take their size from the screen's height: smaller on a phone on its side, larger on a wall */
    --_unit: clamp(34px, 9.5vh, 68px);
    --_fader: 64px;
  }
  .wm-panel.filling {
    position: fixed;
    inset: 0;
    z-index: var(--wm-z-dialog, 1000);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .title {
    overflow: hidden;
    font: 700 15px/1.2 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fs {
    flex: none;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--_line);
    border-radius: 6px;
    background: var(--_panel);
    color: var(--_text);
    font: 600 13px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .fs:hover {
    border-color: var(--_faint);
  }
  .fs:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  .errors {
    color: var(--_warn);
    font-size: 13px;
  }
  .errors summary {
    cursor: pointer;
  }
  .errors ul {
    margin: 6px 0 0;
    padding-left: 18px;
    color: var(--_muted);
    font: 12px/1.5 var(--wm-font-num, ui-monospace, monospace);
  }
  /* children side by side (a row), one under another (a strip), or on a grid */
  .cells {
    display: flex;
    gap: 10px;
    min-width: 0;
  }
  .cells.row {
    align-items: stretch;
  }
  .cells.strip {
    flex: 1;
    flex-direction: column;
    align-items: center;
  }
  .cells.grid {
    display: grid;
    align-items: end;
    justify-items: center;
  }
  /* the panel's own children scroll sideways when there are more than fit; a control takes a touch, the gaps scroll */
  .surface {
    overflow-x: auto;
    padding: 2px;
  }
  .full .surface {
    flex: 1;
  }
  .full .surface.row {
    justify-content: safe center;
  }
  .group {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid color-mix(in oklab, var(--_line) 70%, transparent);
    border-radius: 12px;
    background: color-mix(in oklab, var(--_panel-2) 55%, var(--_panel));
  }
  /* a group's children take its whole height, so a fader in a row is as tall as the tallest group beside it */
  .group > .cells {
    flex: 1;
  }
  .group .group {
    background: color-mix(in oklab, var(--_panel-2) 90%, var(--_panel));
  }
  h4 {
    margin: 0;
    color: var(--_muted);
    font: 700 11px/1 var(--wm-font-num, ui-monospace, monospace);
    letter-spacing: 0.06em;
    text-align: center;
  }
  .ctl {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: var(--_unit);
  }
  /* a fader takes what height there is: in a strip what is left, down to its foot; in a row the row's */
  .cells.strip > .ctl.fader {
    flex: 1 0 auto;
  }
  .cells.row > .ctl.fader {
    align-self: stretch;
  }
  /* a keyboard is as wide as its white keys, each half a unit, and no wider than its place */
  .ctl.keyboard {
    width: calc(var(--_unit) * 0.5 * var(--whites));
    max-width: 100%;
    align-self: end;
  }
  /* the widget itself: no box of its own, so the control lays out as if it weren't there */
  .widget {
    display: contents;
  }
  /* an editor's: a control and a group are pressed to choose them, and every instance of the one chosen is marked */
  .editing :is(.ctl, .group) {
    cursor: pointer;
  }
  .editing .ctl {
    min-height: 28px;
    padding: 3px;
    border-radius: 8px;
    outline: 1px dashed transparent;
    outline-offset: 1px;
  }
  .editing .ctl:hover {
    outline-color: var(--_faint);
  }
  .editing :is(.ctl, .group).picked {
    outline: 2px solid var(--_accent);
    outline-offset: 1px;
  }
  .editing :is(.ctl, .group):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 3px;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    color: var(--_muted);
    font: 600 10.5px/1.1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
  /* a label on its own is text, as written */
  .name.text {
    color: var(--_text);
    font: 600 14px/1.3 var(--wm-font, system-ui, sans-serif);
    letter-spacing: 0;
    text-transform: none;
    white-space: normal;
  }
  .num {
    color: var(--_faint);
    font: 500 10.5px/1 var(--wm-font-num, ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
  }
</style>
