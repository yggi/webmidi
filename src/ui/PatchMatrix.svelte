<script lang="ts">
  /**
   * The patch (docs/proposals/patchbay.md, `PatchMatrix`): the frontend's rows and the inputs down, the setup's outputs
   * across, each crossing a jack (empty, or a chip in its channel's hue). A jack opens the channel picker; a kit's members
   * show the note each output's drum map sends them as; an input's row has its Plays choice (decision 003: not heard,
   * the default, or one of the frontend's rows), and a preset fills in the inputs with no choice; empty rows (seats no part
   * sits in) wait behind a button; the first row is the clock, the outputs the setup sends it to, the same in every context. An output's head selects it (for the `DeviceInspector`). It takes the book and calls
   * back a new one (`onchange`): a change to a named setup becomes its custom variant there (decision 002).
   */
  import { deviceNote, presetNameOf } from '../core/drum-presets';
  import type { PortOption } from '../core/port';
  import { applyPreset, type InputPreset } from '../core/input-kinds';
  import { choiceOf, playsOf } from '../core/plays';
  import {
    activeSetup,
    addOutput,
    ANY_INPUT,
    AS_PLAYED,
    inputRow,
    profileOf,
    withClock,
    withCrossing,
    withPlays,
    withProfile,
    type Crossing,
    type SetupBook,
  } from '../core/setups';
  import ChannelPicker from './ChannelPicker.svelte';
  import { channelHue, clamp } from './channels';
  import { inputRows, type MatrixRow } from './rows';

  interface Props {
    book: SetupBook;
    /** Whose routes these are: `piece:<title>`, `band`, `bay`. */
    context: string;
    /** The frontend's rows, in order; the inputs follow. */
    rows: readonly MatrixRow[];
    /** The inputs plugged in now. */
    inputs?: readonly PortOption[];
    /** The outputs plugged in now. */
    outputs: readonly PortOption[];
    /** Who hears an input ("the Muse", "the keys"): each input's row gets its Plays choice; null for none (standalone). */
    heardBy?: string | null;
    /** A preset to fill in what the inputs with no choice play (`DEFAULT_PRESET`), by the rows' roles; none: no button. */
    preset?: InputPreset | null;
    /** The output selected, by key. */
    selected?: string;
    /** The crossings sounding now, as `row|output key`. */
    lit?: ReadonlySet<string>;
    /**
     * The frontend's rows routed by the piece itself (its MIDI cards): shown, not changed. The inputs and the clock stay
     * the setup's, and editable; no output is added, since the outputs are the piece's (yggi/webmidi#22).
     */
    locked?: boolean;
    /** Whether the clock row is shown: a frontend with no clock to send passes false. */
    clock?: boolean;
    onchange: (book: SetupBook) => void;
    onselect?: (key: string) => void;
  }

  let { book, context, rows, inputs = [], outputs, heardBy = null, preset = null, selected, lit, locked = false, clock = true, onchange, onselect }: Props = $props();

  const setup = $derived(activeSetup(book));
  const routes = $derived(Object.hasOwn(setup.routes, context) ? setup.routes[context]! : {});
  let showEmpty = $state(false);
  const empties = $derived(rows.filter((r) => r.kind === 'empty').length);
  const shown = $derived([...rows.filter((r) => showEmpty || r.kind !== 'empty'), ...inputRows(inputs, routes, setup.plays)]);
  const crossing = (row: string, key: string): Crossing | undefined => (Object.hasOwn(routes, row) && Object.hasOwn(routes[row]!, key) ? routes[row]![key] : undefined);
  const kitHere = (key: string) => rows.some((r) => r.kind === 'kit' && crossing(r.id, key) !== undefined);
  const isPlugged = (o: PortOption) => o.id !== 'none' && outputs.some((p) => p.id === o.id || (!!o.name && p.name === o.name));
  const spare = $derived(outputs.filter((p) => !setup.outputs.some((o) => o.id === p.id || (!!o.name && o.name === p.name))));
  /** The rows an input can play: the frontend's voices and kits, but those it says can't be played (`playable: false`). */
  const playable = $derived(rows.filter((r) => r.playable ?? (r.kind === 'voice' || r.kind === 'kit')));
  /** Inputs plugged in with no choice of their own, which a preset would fill in. */
  const unassigned = $derived(inputs.filter((p) => !Object.hasOwn(setup.plays, inputRow(p))));
  /** An input row's Plays value: its own choice (a row as the row it finds here), else '' (as every input's), else none. */
  function playsValue(row: string): string {
    if (row !== ANY_INPUT && !Object.hasOwn(setup.plays, row)) return Object.hasOwn(setup.plays, ANY_INPUT) ? '' : 'none';
    const played = playsOf(book, row, playable);
    return played === null ? 'none' : played;
  }
  /** What every input without its own choice plays, in words, for an input's "as every input" option. */
  const everyInput = $derived.by(() => {
    const c = choiceOf(setup, ANY_INPUT);
    return c === 'none' ? 'not heard' : c === 'default' ? 'default' : (playable.find((r) => r.id === c.row)?.label ?? c.row);
  });

  let picking: { row: MatrixRow; key: string; name: string; anchor: DOMRect } | null = $state(null);

  function pick(value: Crossing | undefined) {
    if (!picking) return;
    onchange(withCrossing(book, context, picking.row.id, picking.key, value));
    picking = null;
  }

  /** The channels other rows send on to an output. */
  function busy(row: string, key: string): number[] {
    return Object.entries(routes).flatMap(([r, c]) => (r !== row && Object.hasOwn(c, key) && c[key]! > 0 ? [c[key]!] : []));
  }

  /** What an input row plays, chosen: as every input (''), not heard, the default, or a row (kept with its role). */
  function choosePlays(row: string, value: string) {
    if (value === '') return onchange(withPlays(book, row, undefined));
    if (value === 'none' || value === 'default') return onchange(withPlays(book, row, value));
    const target = playable.find((r) => r.id === value);
    if (target) onchange(withPlays(book, row, target.role ? { row: target.id, role: target.role } : { row: target.id }));
  }

  function add() {
    const port = spare[0];
    if (!port) return;
    const { book: next, key } = addOutput(book, port);
    onchange(next);
    onselect?.(key);
  }

  /**
   * A kit member's note on an output typed: its device's drum map sends the General MIDI note `gm` as it (0–127), the
   * entry dropped when it is `gm` again. A device's profile, so no custom variant (decision 002; yggi/webmidi#24).
   */
  function setNote(e: Event & { currentTarget: HTMLInputElement }, name: string, gm: number) {
    const drums: Record<number, number> = { ...profileOf(book, name).drums };
    const n = clamp(e.currentTarget.valueAsNumber, 0, 127, drums[gm] ?? gm);
    e.currentTarget.value = String(n);
    if (n === gm) delete drums[gm];
    else drums[gm] = n;
    onchange(withProfile(book, name, { drums }));
  }

  const outLabel = (o: { id: string; name: string }) => (o.id === 'none' ? 'No device' : o.name || o.id);
</script>

<div class="wm-matrix">
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col"><span class="sr">Source</span></th>
          {#each setup.outputs as o, i (o.key)}
            {@const profile = profileOf(book, o.name)}
            {@const here = isPlugged(o)}
            <th scope="col">
              <button
                type="button"
                class="col"
                class:absent={o.id !== 'none' && !here}
                aria-pressed={selected === o.key}
                onclick={() => onselect?.(o.key)}
                title="{outLabel(o)}: its settings"
              >
                <span class="top"><span class="led" class:on={here} aria-hidden="true"></span><span class="slot">OUT {i + 1}</span></span>
                <span class="name">{outLabel(o)}</span>
                <span class="facts">
                  {#if o.id !== 'none' && !here}<span class="tag gone">Not plugged in</span>{/if}
                  {#if o.id !== 'none' && profile.mpe}<span class="tag">MPE</span>{/if}
                </span>
              </button>
            </th>
          {/each}
          {#if !locked}
            <th scope="col"
              ><button
                type="button"
                class="add"
                onclick={add}
                disabled={!spare.length}
                title={spare.length ? `Add ${outLabel(spare[0]!)}` : 'Every output plugged in is in this setup'}>+ Output</button
              ></th
            >
          {/if}
        </tr>
      </thead>
      <tbody>
        {#if clock}
          <tr class="clock">
            <th scope="row"><span class="rowname"><span class="label">Clock</span><span class="tags"><span class="sub">24 ppq</span></span></span></th>
            {#each setup.outputs as o (o.key)}
              {@const on = setup.clock.includes(o.key)}
              <td>
                <button type="button" class="jack" aria-pressed={on} aria-label="Clock to {outLabel(o)}" onclick={() => onchange(withClock(book, o.key, !on))}>
                  {#if on}<span class="chip keep">CLK</span>{:else}<span class="hole"></span>{/if}
                </button>
              </td>
            {/each}
            {#if !locked}<td></td>{/if}
          </tr>
        {/if}
        {#each shown as row (row.id)}
          <tr class:member={row.kind === 'member'} class:empty={row.kind === 'empty'} class:group={row.group}>
            <th scope="row">
              <span class="rowname">
                <span class="label">{row.label}</span>
                {#if row.kind === 'input' || row.sub}
                  <span class="tags">
                    {#if row.kind === 'input'}<span class="sub">IN</span>{/if}
                    {#if row.sub}<span class="sub">{row.sub}</span>{/if}
                    {#if row.kind === 'input' && heardBy}
                      {@const value = playsValue(row.id)}
                      <select
                        class="plays"
                        class:off={value === 'none'}
                        aria-label="What {row.label} plays, heard by {heardBy}"
                        {value}
                        onchange={(e) => choosePlays(row.id, e.currentTarget.value)}
                      >
                        {#if row.id !== ANY_INPUT && Object.hasOwn(setup.plays, ANY_INPUT)}<option value="">As every input: {everyInput}</option>{/if}
                        <option value="none">Not heard</option>
                        <option value="default">Plays the default</option>
                        {#each playable as r (r.id)}<option value={r.id}>Plays {r.label}</option>{/each}
                      </select>
                    {/if}
                  </span>
                {/if}
              </span>
            </th>
            {#each setup.outputs as o (o.key)}
              {@const value = crossing(row.id, o.key)}
              <td>
                {#if row.kind === 'member'}
                  {#if kitHere(o.key) && row.note !== undefined}
                    {@const n = deviceNote(profileOf(book, o.name).drums, row.note)}
                    {@const gm = row.note}
                    <input
                      type="number"
                      class="note"
                      class:mapped={n !== gm}
                      min="0"
                      max="127"
                      value={n}
                      aria-label="{row.label} on {outLabel(o)}: General MIDI {gm} goes out as"
                      title="General MIDI {gm} goes out as {n}"
                      onchange={(e) => setNote(e, o.name, gm)}
                    />
                  {/if}
                {:else}
                  {@const chip = value === undefined ? null : value === AS_PLAYED ? '=' : String(value)}
                  {#if locked && row.kind !== 'input'}
                    <span class="jack" aria-label="{row.label} to {outLabel(o)}: {chip ?? 'not sent'}">
                      {#if chip}<span class="chip" class:keep={value === AS_PLAYED} style:--h={channelHue(value ?? 1)}>{chip}</span>{:else}<span class="hole"></span>{/if}
                    </span>
                  {:else}
                    <button
                      type="button"
                      class="jack"
                      aria-label="{row.label} to {outLabel(o)}: {chip === null ? 'not sent' : value === AS_PLAYED ? 'as played' : `channel ${value}`}"
                      onclick={(e) => (picking = { row, key: o.key, name: outLabel(o), anchor: e.currentTarget.getBoundingClientRect() })}
                    >
                      {#if chip}
                        <span class="chip" class:keep={value === AS_PLAYED} class:lit={lit?.has(`${row.id}|${o.key}`)} style:--h={channelHue(value ?? 1)}
                          >{chip}{#if value === 10 && row.kind === 'kit' && presetNameOf(profileOf(book, o.name).drums) === 'GM'}<small>GM</small>{/if}</span
                        >
                      {:else}<span class="hole"></span>{/if}
                    </button>
                  {/if}
                {/if}
              </td>
            {/each}
            {#if !locked}<td></td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if empties || (preset && heardBy && unassigned.length)}
    <div class="below">
      {#if empties}
        <button type="button" class="more" onclick={() => (showEmpty = !showEmpty)}
          >{showEmpty ? 'Hide empty rows' : `Show ${empties} empty ${empties === 1 ? 'row' : 'rows'}`}</button
        >
      {/if}
      {#if preset && heardBy && unassigned.length}
        <button type="button" class="more" title="Fills in what each input with no choice plays, by its kind" onclick={() => onchange(applyPreset(book, preset, inputs, playable))}
          >Assign inputs: {preset.name}</button
        >
      {/if}
    </div>
  {/if}
</div>

{#if picking}
  <ChannelPicker
    label="{picking.row.label} → {picking.name}"
    value={crossing(picking.row.id, picking.key)}
    busy={busy(picking.row.id, picking.key)}
    asPlayed={picking.row.kind === 'input'}
    anchor={picking.anchor}
    onpick={pick}
    onclose={() => (picking = null)}
  />
{/if}

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-matrix {
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
    .wm-matrix {
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
  .wm-matrix {
    /* a container, so the names and the heads fit what the frontend gives it, not the window (yggi/webmidi#23) */
    container-type: inline-size;
    display: grid;
    gap: 6px;
    min-width: 0;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    min-width: 100%;
  }
  th,
  td {
    padding: 0;
  }
  thead th {
    vertical-align: bottom;
    padding: 0 4px 8px;
  }
  .col {
    display: grid;
    gap: 4px;
    width: 118px;
    min-width: 104px;
    padding: 8px 9px;
    border: 1px solid var(--_line);
    border-radius: 8px;
    background: var(--_panel-2);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .col[aria-pressed='true'] {
    border-color: var(--_accent);
    box-shadow: 0 0 0 1px var(--_accent) inset;
    background: var(--_panel);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .slot {
    font: 700 12px var(--wm-font-num, ui-monospace, monospace);
    color: var(--_muted);
  }
  .name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .absent .name {
    color: var(--_faint);
    text-decoration: line-through;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 18px;
  }
  .tag {
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--_panel);
    color: var(--_muted);
    font: 600 11px/1 var(--wm-font, system-ui, sans-serif);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tag.gone {
    color: var(--_warn);
    background: color-mix(in oklab, var(--_warn) 18%, transparent);
  }
  .led {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--_off);
  }
  .led.on {
    background: var(--_live);
  }
  .add {
    width: 96px;
    min-height: 84px;
    border: 1px dashed var(--_line);
    border-radius: 8px;
    background: transparent;
    color: var(--_muted);
    font-weight: 600;
    cursor: pointer;
  }
  .add:disabled {
    opacity: 0.5;
    cursor: default;
  }
  tbody th {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 0;
    padding: 3px 10px 3px 8px;
    /* the names stay as the matrix scrolls sideways, over the ground the frontend draws it on */
    background: var(--wm-surface, var(--_panel));
    text-align: left;
  }
  /* a name wraps within at most 36 % of the matrix (96 px at least), its tags (IN, Plays, a seat's part) on a line under it */
  .rowname {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: max-content;
    max-width: max(96px, 36cqi);
    overflow-wrap: anywhere;
  }
  .rowname > * {
    max-width: 100%;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  @container (max-width: 480px) {
    .col {
      width: 96px;
      min-width: 88px;
    }
    .add {
      width: 72px;
    }
    .jack {
      min-width: 56px;
    }
  }
  .label {
    font: 600 15px var(--wm-font-num, ui-monospace, monospace);
  }
  .sub {
    font-size: 12px;
    color: var(--_muted);
  }
  tr.member th {
    padding-left: 26px;
  }
  tr.member .label {
    font-size: 14px;
    color: var(--_muted);
  }
  tr.empty .label {
    font-weight: 500;
    color: var(--_faint);
  }
  tbody tr + tr > * {
    border-top: 1px solid color-mix(in oklab, var(--_line) 55%, transparent);
  }
  tbody tr.group > * {
    border-top: 1px solid var(--_line);
  }
  /* the clock, first: a rule under it, over the frontend's rows */
  tbody tr.clock + tr > * {
    border-top: 1px solid var(--_line);
  }
  td {
    padding: 4px;
    text-align: center;
  }
  .jack {
    display: grid;
    place-items: center;
    width: 100%;
    min-width: 64px;
    height: 36px;
    border: 1px dashed transparent;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  span.jack {
    cursor: default;
  }
  button.jack:hover {
    border-color: var(--_line);
  }
  .hole {
    width: 12px;
    height: 12px;
    border: 2px solid var(--_line);
    border-radius: 50%;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 46px;
    height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    background: oklch(var(--wm-chip-l, 0.72) var(--wm-chip-c, 0.13) var(--h));
    color: var(--wm-chip-ink, #10131a);
    font: 700 14px var(--wm-font-num, ui-monospace, monospace);
  }
  .chip small {
    font-size: 10px;
    opacity: 0.75;
  }
  .chip.keep {
    border: 1px solid var(--_line);
    background: var(--_panel-2);
    color: var(--_text);
  }
  .chip.lit {
    filter: brightness(1.25) saturate(1.3);
  }
  .note {
    display: inline-block;
    width: 56px;
    min-height: 28px;
    padding: 2px 6px;
    color: var(--_text);
    text-align: center;
    border: 1px solid var(--_line);
    border-radius: 6px;
    background: var(--_panel-2);
    font: 600 14px var(--wm-font-num, ui-monospace, monospace);
  }
  .note.mapped {
    border-color: var(--_accent);
    color: var(--_accent);
  }
  .note:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  .plays {
    max-width: 100%;
    min-height: 26px;
    padding: 0 4px;
    border: 1px solid var(--_live);
    border-radius: 999px;
    background: transparent;
    color: var(--_live);
    font: 600 11px/1 var(--wm-font, system-ui, sans-serif);
    letter-spacing: 0.03em;
    cursor: pointer;
  }
  .plays.off {
    border-color: var(--_line);
    color: var(--_faint);
  }
  .below {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .more {
    justify-self: start;
    min-height: 32px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--_muted);
    font: 600 14px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  button:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
