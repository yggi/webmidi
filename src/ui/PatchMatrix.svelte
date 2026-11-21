<script lang="ts">
  /**
   * The patch (docs/proposals/patchbay.md, `PatchMatrix`): the frontend's rows and the inputs down, the setup's outputs
   * across, each crossing a jack (empty, or a chip in its channel's hue). A jack opens the channel picker; an input's
   * row has its Plays choice (decision 003: not heard, the default, or one of the frontend's rows), and a preset fills
   * in the inputs with no choice; a panel's row has the same choice, not heard by default (decision 007, #71); empty rows (seats no part sits in) wait behind a button; the first row is the clock,
   * the outputs the setup sends it to, the same in every context.
   *
   * Over the matrix, the devices plugged in that the setup has no output for, each a chip that adds it; an output's ×
   * takes it out of the matrix and back among them (asking first only when it has routes to lose). An output is the
   * port plugged in under its name (`pluggedOf`), each port one output's.
   *
   * The setup's active control panels (decision 007) are rows and columns too, where the frontend gives the library's
   * panels (`panels`): a panel's row is what it sends, routed like an input's; its column is what it is sent, an input's
   * or another panel's row crossed on or off. Panels not active are chips beside the devices, and a panel's head calls
   * `onpanel`.
   *
   * The matrix holds the patch and nothing of a device's settings: an output's head opens its details in a dialog
   * (`DeviceDialog`: its port, its profile, each drum's note where a kit is routed to it, its channels), unless the
   * frontend takes the head itself (`onselect`). A kit's members are therefore not rows here. It takes the book and
   * calls back a new one (`onchange`): a change to a named setup becomes its custom variant there (decision 002).
   */
  import type { ComponentProps } from 'svelte';
  import type { LinkReport } from '../core/link';
  import { presetNameOf } from '../core/drum-presets';
  import type { PortOption } from '../core/port';
  import { applyPreset, type InputPreset } from '../core/input-kinds';
  import { choiceOf, playsOf } from '../core/plays';
  import {
    activeSetup,
    addOutput,
    chooseDevice,
    forgetDevice,
    pluggedOf,
    spareOf,
    ANY_INPUT,
    hardwareOutputs,
    hasBuiltIn,
    HEARD,
    isBuiltIn,
    withBuiltIn,
    removeOutput,
    AS_PLAYED,
    channelsOf,
    inputRow,
    isPanelKey,
    panelKey,
    panelsOf,
    withPanelActive,
    profileOf,
    withClock,
    withCrossing,
    withPlays,
    withProfile,
    type Crossing,
    type DeviceProfile,
    type SetupBook,
    type SetupOutput,
  } from '../core/setups';
  import ChannelPicker from './ChannelPicker.svelte';
  import { channelHue, crossingText, crossingWords } from './channels';
  import DeviceDialog from './DeviceDialog.svelte';
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
    /**
     * This device's own sound as a column (`BUILT_IN`), first: what the frontend calls it ("Synth"), and whether its
     * crossings are edited here, row by row (`rows`, by default; false: shown as the frontend wrote them in `book`, the
     * column itself added and removed). `direct`: the built-in plays MIDI itself (the standalone page's synth), so an
     * input's and a panel's row cross it on or off, where otherwise an input is heard through the row it plays. None:
     * no such column, and none offered.
     */
    builtIn?: { readonly label: string; readonly rows?: boolean; readonly direct?: boolean } | null;
    /** The library's control panels, by id and name: those the setup has active are rows and columns, the others chips that add them. None: no panels here. */
    panels?: readonly { readonly id: string; readonly name: string }[];
    /** A panel's head pressed, by its id: the frontend shows it to play. */
    onpanel?: (id: string) => void;
    onchange: (book: SetupBook) => void;
    /**
     * An output's head pressed, by key: the frontend shows its details itself (and may mark it with `selected`). Left
     * out, the matrix opens the output's details in a dialog of its own.
     */
    onselect?: (key: string) => void;
    /** In the matrix's own dialog: a test note to an output, and its notes off, by key; left out, not offered. */
    ontest?: (key: string) => void;
    onpanic?: (key: string) => void;
    /** In the matrix's own dialog: measure the link to an output, by key (`DeviceInspector`'s `onmeasure`, which has `inputs` to pick the loop from); left out, not offered. */
    onmeasure?: (
      key: string,
      run: Parameters<NonNullable<ComponentProps<typeof DeviceDialog>['onmeasure']>>[0],
    ) => ReturnType<NonNullable<ComponentProps<typeof DeviceDialog>['onmeasure']>>;
    /** A link report made there. */
    onlinkreport?: (report: LinkReport) => void;
    /** The built-in's head pressed, where the matrix opens the details itself: its settings are the frontend's (decision 004). */
    onbuiltin?: () => void;
  }

  let {
    book,
    context,
    rows,
    inputs = [],
    outputs,
    heardBy = null,
    preset = null,
    selected,
    lit,
    locked = false,
    clock = true,
    builtIn = null,
    panels = [],
    onpanel,
    onchange,
    onselect,
    ontest,
    onpanic,
    onmeasure,
    onlinkreport,
    onbuiltin,
  }: Props = $props();

  const setup = $derived(activeSetup(book));
  const routes = $derived(Object.hasOwn(setup.routes, context) ? setup.routes[context]! : {});
  /** Whether anything is sent to an output here: the clock, or a row of this context. */
  const routedHere = (key: string) => setup.clock.includes(key) || Object.values(routes).some((c) => Object.hasOwn(c, key));
  /** Whether a removal would lose something: the clock, or a crossing in any context. */
  const routedAnywhere = (key: string) =>
    setup.clock.includes(key) || Object.values(setup.routes).some((r) => Object.hasOwn(r, key) || Object.values(r).some((c) => Object.hasOwn(c, key)));
  /**
   * The columns: the built-in first where the frontend has one, then the outputs that send MIDI. A slot with no device
   * is one only while routes wait on it for a device: an empty one is filled by the next device added.
   */
  const columns = $derived((builtIn ? setup.outputs : hardwareOutputs(setup)).filter((o) => o.id !== 'none' || routedHere(o.key)));
  /** Each output's port as it is plugged in now, by key: by its name, one port to one output (`pluggedOf`). */
  const live = $derived(new Map(pluggedOf(setup.outputs, outputs).map((port, i) => [setup.outputs[i]!.key, port])));
  /** An output's number, counting the outputs that send MIDI (a piece's MIDI cards name them so); the built-in has none. */
  const slotOf = (o: SetupOutput) => hardwareOutputs(setup).findIndex((h) => h.key === o.key) + 1;
  /** The rows the built-in can play: the frontend's voices and kits, but those that say it can't (`builtIn: false`). */
  const audible = (r: MatrixRow) => (r.kind === 'voice' || r.kind === 'kit') && r.builtIn !== false;
  let showEmpty = $state(false);
  /** The setup's active panels, each with its name in the library (none: it is missing there, and said so). */
  const active = $derived(panelsOf(setup).map((id) => ({ id, key: panelKey(id), name: panels.find((p) => p.id === id)?.name })));
  /** The library's panels the setup hasn't active: chips that add them. */
  const idle = $derived(panels.filter((p) => !panelsOf(setup).includes(p.id)));
  const panelRows = $derived(
    active.map((p, i): MatrixRow => ({
      id: p.key,
      label: p.name ?? p.id,
      kind: 'panel',
      ...(p.name === undefined ? { sub: 'not in the library' } : {}),
      ...(i === 0 ? { group: true } : {}),
    })),
  );
  /** A row with a Plays choice of its own: an input's, and a panel's. */
  const hasPlays = (r: MatrixRow) => r.kind === 'input' || r.kind === 'panel';
  /** A row routed by the setup whatever the frontend routes: an input's, a panel's. */
  const free = (r: MatrixRow) => r.kind === 'input' || r.kind === 'panel';
  const empties = $derived(rows.filter((r) => r.kind === 'empty').length);
  /** The rows drawn, each id once: a keyed list with an id twice throws, and stops the page redrawing. */
  const shown = $derived(
    [...rows.filter((r) => r.kind !== 'member' && (showEmpty || r.kind !== 'empty')), ...panelRows, ...inputRows(inputs, routes, setup.plays)].filter(
      (r, i, all) => all.findIndex((x) => x.id === r.id) === i,
    ),
  );
  const crossing = (row: string, key: string): Crossing | undefined => (Object.hasOwn(routes, row) && Object.hasOwn(routes[row]!, key) ? routes[row]![key] : undefined);
  const kitHere = (key: string) => rows.some((r) => r.kind === 'kit' && crossing(r.id, key) !== undefined);
  const isPlugged = (o: SetupOutput) => isBuiltIn(o) || !!live.get(o.key);
  /** The devices plugged in that the setup has no output for: what the chips over the matrix add. */
  const spare = $derived(spareOf(setup, outputs));
  /** A port's name on its chip, its place after it when another port plugged in has the same ("USB MIDI (2)"). */
  const portLabel = (p: PortOption) => {
    const name = p.name || p.id;
    const same = outputs.filter((q) => (q.name || q.id) === name);
    return same.length > 1 ? `${name} (${same.indexOf(p) + 1})` : name;
  };
  /** A kit's members, by General MIDI note, each note once: what the details set a device's note for. */
  const members = $derived(
    rows
      .flatMap((r) => (r.kind === 'member' && r.note !== undefined ? [{ label: r.label, note: r.note }] : []))
      .filter((m, i, all) => all.findIndex((x) => x.note === m.note) === i),
  );
  /** The rows an input can play: the frontend's voices and kits, but those it says can't be played (`playable: false`). */
  const playable = $derived(rows.filter((r) => r.playable ?? (r.kind === 'voice' || r.kind === 'kit')));
  /** Inputs plugged in with no choice of their own, which a preset would fill in. */
  const unassigned = $derived(inputs.filter((p) => !Object.hasOwn(setup.plays, inputRow(p))));
  /** An input row's Plays value: its own choice (a row as the row it finds here), else '' (as every input's), else none; a panel's, its own, else none. */
  function playsValue(row: string): string {
    if (isPanelKey(row) && !Object.hasOwn(setup.plays, row)) return 'none';
    if (row !== ANY_INPUT && !Object.hasOwn(setup.plays, row)) return Object.hasOwn(setup.plays, ANY_INPUT) ? '' : 'none';
    const played = playsOf(book, row, playable);
    return played === null ? 'none' : played;
  }
  /** What every input without its own choice plays, in words, for an input's "as every input" option. */
  const everyInput = $derived.by(() => {
    const c = choiceOf(setup, ANY_INPUT);
    return c === 'none' ? 'none' : c === 'default' ? 'default' : (playable.find((r) => r.id === c.row)?.label ?? c.row);
  });

  let picking: { row: MatrixRow; key: string; name: string; anchor: DOMRect } | null = $state(null);

  /** A channel picked: the picker closes first, whatever the frontend then does with the change; it stays open while a set is built (`more`). */
  function pick(value: Crossing | undefined, more = false) {
    if (!picking) return;
    const { row, key } = picking;
    if (!more) picking = null;
    onchange(withCrossing(book, context, row.id, key, value));
  }

  /** The output whose removal is being asked about, by key. */
  let removing: string | null = $state(null);
  /** Whether an output's × is offered: not on a piece's outputs, nor on a lone output with no device, which is all a removal would leave. */
  const removable = (o: SetupOutput) => !locked && (setup.outputs.length > 1 || o.id !== 'none');
  function remove(key: string) {
    removing = null;
    if (detail === key) detail = null;
    onchange(isPanelKey(key) ? withPanelActive(book, key.slice('panel:'.length), false) : removeOutput(book, key));
  }
  /** An output's × pressed: out at once when nothing is routed to it (it is back among the devices to add), asked about first when routes would go with it. */
  const askRemove = (key: string) => (routedAnywhere(key) ? (removing = key) : remove(key));

  /** The output whose details are open in the matrix's own dialog, by key. */
  let detail: string | null = $state(null);
  const detailed = $derived(setup.outputs.find((o) => o.key === detail && !isBuiltIn(o)) ?? null);
  /** Whether a head is pressed for something: the frontend's `onselect`, the matrix's own dialog, or the built-in's `onbuiltin`. */
  const opens = (o: SetupOutput) => !!onselect || !isBuiltIn(o) || !!onbuiltin;
  function open(o: SetupOutput) {
    if (onselect) onselect(o.key);
    else if (isBuiltIn(o)) onbuiltin?.();
    else detail = o.key;
  }
  /** The channels this context routes to an output, and those sounding on it now (`lit`). */
  const usedOn = (key: string) => [...new Set(Object.values(routes).flatMap((c) => (Object.hasOwn(c, key) ? channelsOf(c[key]!) : [])))].sort((a, b) => a - b);
  const litOn = (key: string) => new Set([...(lit ?? [])].flatMap((id) => (id.endsWith(`|${key}`) ? channelsOf(crossing(id.slice(0, -key.length - 1), key) ?? AS_PLAYED) : [])));
  /** A drum map on a head: a device's own by its name ("Novation Circuit"), General MIDI and one edited by hand as "GM drums", "Custom drums". */
  const drumsText = (preset: string) => (preset === 'GM' || preset === 'Custom' ? `${preset} drums` : preset);
  /** What a head says under its name: where it is, what is missing, how its device takes notes. */
  function facts(o: SetupOutput): { text: string; gone?: boolean }[] {
    if (isBuiltIn(o)) return [{ text: 'This device' }];
    if (o.id === 'none') return [{ text: 'Routes kept' }];
    const profile = profileOf(book, o.name);
    return [
      ...(isPlugged(o) ? [] : [{ text: 'Not plugged in', gone: true }]),
      ...(profile.mpe ? [{ text: 'MPE' }] : []),
      ...(kitHere(o.key) ? [{ text: drumsText(presetNameOf(profile.drums)) }] : []),
    ];
  }

  /** The channels other rows send on to an output. */
  function busy(row: string, key: string): number[] {
    return Object.entries(routes).flatMap(([r, c]) => (r !== row && Object.hasOwn(c, key) ? channelsOf(c[key]!) : []));
  }

  /** What an input row plays, chosen: as every input (''), not heard, the default, or a row (kept with its role). */
  function choosePlays(row: string, value: string) {
    if (value === '') return onchange(withPlays(book, row, undefined));
    if (value === 'none' || value === 'default') return onchange(withPlays(book, row, value));
    const target = playable.find((r) => r.id === value);
    if (target) onchange(withPlays(book, row, target.role ? { row: target.id, role: target.role } : { row: target.id }));
  }

  /** The built-in added, hearing every row it can play: as the frontend's switch did, on. */
  function addBuiltIn() {
    onchange(withBuiltIn(book, true, { [context]: rows.filter(audible).map((r) => r.id) }));
  }

  /** What an input's row says in the built-in's column: the row it plays there through, or that it isn't heard. */
  function viaText(row: string): string {
    const value = playsValue(row);
    if (value === 'none') return 'not heard';
    if (value === 'default') return 'as default';
    if (value === '') return everyInput === 'none' ? 'not heard' : `as ${everyInput}`;
    return `as ${playable.find((r) => r.id === value)?.label ?? value}`;
  }

  /** What stands over a matrix with no column yet. */
  const nothing = $derived(
    locked
      ? 'This piece routes to no output.'
      : spare.length
        ? 'No output in this setup yet: add a device plugged in, above.'
        : 'No output in this setup yet, and no MIDI device plugged in.',
  );

  /** A device plugged in added: into a slot with no device where the setup has one (its routes waiting), else as a new output. */
  function add(port: PortOption) {
    const slot = hardwareOutputs(setup).find((o) => o.id === 'none');
    const { book: next, key } = slot ? { book: chooseDevice(book, slot.key, port), key: slot.key } : addOutput(book, port);
    onchange(next);
    onselect?.(key);
  }

  const outLabel = (o: { id: string; name: string }) => (isBuiltIn(o) ? (builtIn?.label ?? 'Built-in') : o.id === 'none' ? 'No device' : o.name || o.id);
</script>

{#snippet head(o: SetupOutput, slot: string)}
  <span class="top"><span class="led" class:on={isPlugged(o)} aria-hidden="true"></span><span class="slot">{slot}</span></span>
  <span class="name" title={outLabel(o)}>{outLabel(o)}</span>
  <span class="facts"
    >{#each facts(o) as f (f.text)}<span class="tag" class:gone={f.gone}>{f.text}</span>{/each}</span
  >
{/snippet}

<div class="wm-matrix">
  {#if !locked && (spare.length || (builtIn && !hasBuiltIn(setup)) || idle.length)}
    <div class="tray" role="group" aria-label="Not in this setup: devices plugged in, and panels">
      {#if spare.length || (builtIn && !hasBuiltIn(setup))}<span class="tray-label">Plugged in</span>{/if}
      {#each spare as p (p.id)}
        <button type="button" class="dev" title="Add {portLabel(p)} to the patch" onclick={() => add(p)}>+ {portLabel(p)}</button>
      {/each}
      {#if builtIn && !hasBuiltIn(setup)}
        <button type="button" class="dev here" title="Play on this device too" onclick={addBuiltIn}>+ {builtIn.label}</button>
      {/if}
      {#if idle.length}<span class="tray-label">Panels</span>{/if}
      {#each idle as p (p.id)}
        <button type="button" class="dev panel" title="Add the panel {p.name} to the patch" onclick={() => onchange(withPanelActive(book, p.id, true))}>+ {p.name}</button>
      {/each}
    </div>
  {/if}
  {#if !columns.length && !active.length}
    <p class="nothing" role="status">{nothing}</p>
  {/if}
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col"><span class="sr">Source</span></th>
          {#each columns as o (o.key)}
            {@const here = isPlugged(o)}
            {@const slot = isBuiltIn(o) ? 'BUILT-IN' : `OUT ${slotOf(o)}`}
            <th scope="col">
              {#if removing === o.key}
                <div class="col asking" role="group" aria-label="Remove {slot}?">
                  <span class="slot">{slot}</span>
                  <span class="name">Remove, with its routes?</span>
                  <span class="ask">
                    <button type="button" class="danger" onclick={() => remove(o.key)}>Remove</button>
                    <button type="button" onclick={() => (removing = null)}>Keep</button>
                  </span>
                </div>
              {:else}
                <span class="pin">
                  {#if opens(o)}
                    <button
                      type="button"
                      class="col"
                      class:builtin={isBuiltIn(o)}
                      class:absent={o.id !== 'none' && !here}
                      aria-pressed={onselect ? selected === o.key : undefined}
                      aria-haspopup={onselect || isBuiltIn(o) ? undefined : 'dialog'}
                      onclick={() => open(o)}
                      title="{outLabel(o)}: its settings"
                    >
                      {@render head(o, slot)}
                    </button>
                  {:else}
                    <span class="col builtin">{@render head(o, slot)}</span>
                  {/if}
                  {#if removable(o)}
                    <button type="button" class="x" aria-label="Remove {slot}, {outLabel(o)}" title="Take it out of the patch" onclick={() => askRemove(o.key)}>×</button>
                  {/if}
                </span>
              {/if}
            </th>
          {/each}
          {#each active as p (p.key)}
            <th scope="col">
              {#if removing === p.key}
                <div class="col asking" role="group" aria-label="Remove the panel {p.name ?? p.id}?">
                  <span class="slot">PANEL</span>
                  <span class="name">Remove, with its routes?</span>
                  <span class="ask">
                    <button type="button" class="danger" onclick={() => remove(p.key)}>Remove</button>
                    <button type="button" onclick={() => (removing = null)}>Keep</button>
                  </span>
                </div>
              {:else}
                <span class="pin">
                  {#if onpanel}
                    <button type="button" class="col ofpanel" class:absent={p.name === undefined} title="{p.name ?? p.id}: play it" onclick={() => onpanel(p.id)}>
                      <span class="top"><span class="led square" class:on={p.name !== undefined} aria-hidden="true"></span><span class="slot">PANEL</span></span>
                      <span class="name" title={p.name ?? p.id}>{p.name ?? p.id}</span>
                      <span class="facts"><span class="tag" class:gone={p.name === undefined}>{p.name === undefined ? 'Not in the library' : 'What it is sent'}</span></span>
                    </button>
                  {:else}
                    <span class="col ofpanel" class:absent={p.name === undefined}>
                      <span class="top"><span class="led square" class:on={p.name !== undefined} aria-hidden="true"></span><span class="slot">PANEL</span></span>
                      <span class="name" title={p.name ?? p.id}>{p.name ?? p.id}</span>
                      <span class="facts"><span class="tag" class:gone={p.name === undefined}>{p.name === undefined ? 'Not in the library' : 'What it is sent'}</span></span>
                    </span>
                  {/if}
                  <button type="button" class="x" aria-label="Remove the panel {p.name ?? p.id}" title="Take it out of the patch" onclick={() => askRemove(p.key)}>×</button>
                </span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if clock}
          <tr class="clock">
            <th scope="row"><span class="rowname"><span class="label">Clock</span><span class="tags"><span class="sub">24 ppq</span></span></span></th>
            {#each columns as o (o.key)}
              {@const on = setup.clock.includes(o.key)}
              <td class:here={isBuiltIn(o)}>
                {#if isBuiltIn(o)}
                  <span class="via" title="This device keeps its own time">—</span>
                {:else}
                  <button type="button" class="jack" aria-pressed={on} aria-label="Clock to {outLabel(o)}" onclick={() => onchange(withClock(book, o.key, !on))}>
                    {#if on}<span class="chip keep">CLK</span>{:else}<span class="hole"></span>{/if}
                  </button>
                {/if}
              </td>
            {/each}
            {#each active as p (p.key)}<td class="topanel"></td>{/each}
          </tr>
        {/if}
        {#each shown as row (row.id)}
          <tr class:empty={row.kind === 'empty'} class:group={row.group}>
            <th scope="row">
              <span class="rowname">
                <span class="title"
                  >{#if row.kind === 'input'}<span class="sub in">IN</span>{:else if row.kind === 'panel'}<span class="sub in pn">PANEL</span>{/if}<span class="label"
                    >{row.label}</span
                  ></span
                >
                {#if row.sub || (hasPlays(row) && heardBy)}
                  <span class="tags">
                    {#if row.sub}<span class="sub">{row.sub}</span>{/if}
                    {#if hasPlays(row) && heardBy}
                      {@const value = playsValue(row.id)}
                      <select
                        class="plays"
                        class:off={value === 'none'}
                        aria-label="What {row.label} plays, heard by {heardBy}"
                        {value}
                        onchange={(e) => choosePlays(row.id, e.currentTarget.value)}
                      >
                        <!-- (short, as a closed select shows them in a narrow drawer, #48: what it is says its label) -->
                        {#if row.kind === 'input' && row.id !== ANY_INPUT && Object.hasOwn(setup.plays, ANY_INPUT)}<option value="" title="As every input: {everyInput}"
                            >All: {everyInput}</option
                          >{/if}
                        <option value="none">Not heard</option>
                        <option value="default" title="Plays the default">Default</option>
                        {#each playable as r (r.id)}<option value={r.id} title="Plays {r.label}">{r.label}</option>{/each}
                      </select>
                    {/if}
                  </span>
                {/if}
              </span>
            </th>
            {#each columns as o (o.key)}
              {@const value = crossing(row.id, o.key)}
              <td class:here={isBuiltIn(o)}>
                {#if isBuiltIn(o)}
                  {#if (row.kind === 'input' || (row.kind === 'panel' && heardBy)) && !builtIn?.direct}
                    <span class="via" title="An input plays here through the row it plays">{viaText(row.id)}</span>
                  {:else if audible(row) || (builtIn?.direct && free(row))}
                    {#if builtIn?.rows !== false}
                      <button
                        type="button"
                        class="jack"
                        aria-pressed={value !== undefined}
                        aria-label="{row.label} to {outLabel(o)}: {value === undefined ? 'not heard' : 'heard'}"
                        onclick={() => onchange(withCrossing(book, context, row.id, o.key, value === undefined ? HEARD : undefined))}
                      >
                        {#if value !== undefined}<span class="chip on" class:lit={lit?.has(`${row.id}|${o.key}`)}>ON</span>{:else}<span class="hole"></span>{/if}
                      </button>
                    {:else}
                      <span class="jack" aria-label="{row.label} to {outLabel(o)}: {value === undefined ? 'not heard' : 'heard'}">
                        {#if value !== undefined}<span class="chip on">ON</span>{:else}<span class="hole"></span>{/if}
                      </span>
                    {/if}
                  {:else if row.kind === 'panel'}
                    <span class="via" title="A panel sends MIDI: route it to an output">—</span>
                  {:else if row.kind !== 'empty'}
                    <span class="via" title="Heard here through the part it plays">—</span>
                  {/if}
                {:else}
                  {@const chip = value === undefined ? null : crossingText(value)}
                  {@const words = value === undefined ? 'not sent' : crossingWords(value)}
                  {#if locked && !free(row)}
                    <span class="jack" aria-label="{row.label} to {outLabel(o)}: {words}">
                      {#if chip}<span class="chip" class:keep={value === AS_PLAYED} title={words} style:--h={channelHue(channelsOf(value ?? 1)[0] ?? 1)}>{chip}</span>{:else}<span
                          class="hole"
                        ></span>{/if}
                    </span>
                  {:else}
                    <button
                      type="button"
                      class="jack"
                      aria-label="{row.label} to {outLabel(o)}: {words}"
                      onclick={(e) => (picking = { row, key: o.key, name: outLabel(o), anchor: e.currentTarget.getBoundingClientRect() })}
                    >
                      {#if chip}
                        <span
                          class="chip"
                          class:keep={value === AS_PLAYED}
                          class:lit={lit?.has(`${row.id}|${o.key}`)}
                          title={words}
                          style:--h={channelHue(channelsOf(value ?? 1)[0] ?? 1)}>{chip}</span
                        >
                      {:else}<span class="hole"></span>{/if}
                    </button>
                  {/if}
                {/if}
              </td>
            {/each}
            {#each active as p (p.key)}
              {@const value = crossing(row.id, p.key)}
              <td class="topanel">
                {#if row.id === p.key}
                  <span class="via" title="A panel isn’t sent what it sends">—</span>
                {:else if free(row)}
                  <button
                    type="button"
                    class="jack"
                    aria-pressed={value !== undefined}
                    aria-label="{row.label} to the panel {p.name ?? p.id}: {value === undefined ? 'not sent' : 'sent'}"
                    onclick={() => onchange(withCrossing(book, context, row.id, p.key, value === undefined ? AS_PLAYED : undefined))}
                  >
                    {#if value !== undefined}<span class="chip on">ON</span>{:else}<span class="hole"></span>{/if}
                  </button>
                {/if}
              </td>
            {/each}
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
    asPlayed={free(picking.row)}
    anchor={picking.anchor}
    onpick={pick}
    onclose={() => (picking = null)}
  />
{/if}

{#if detailed}
  {@const o = detailed}
  <DeviceDialog
    output={o}
    slot={slotOf(o)}
    ports={outputs}
    port={live.get(o.key) ?? null}
    profile={profileOf(book, o.name)}
    {members}
    drums={kitHere(o.key)}
    used={usedOn(o.key)}
    lit={litOn(o.key)}
    canRemove={removable(o)}
    onport={(port: PortOption) => onchange(chooseDevice(book, o.key, port))}
    onprofile={(change: Partial<DeviceProfile>) => onchange(withProfile(book, o.name, change))}
    ontest={ontest && (() => ontest(o.key))}
    onpanic={onpanic && (() => onpanic(o.key))}
    onmeasure={onmeasure && ((run) => onmeasure(o.key, run))}
    {inputs}
    {onlinkreport}
    onremove={locked ? undefined : () => remove(o.key)}
    onforget={Object.hasOwn(book.devices, o.name) ? () => onchange(forgetDevice(book, o.name)) : undefined}
    onclose={() => (detail = null)}
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
    gap: 10px;
    min-width: 0;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  /* the devices plugged in that the setup has no output for: a chip each, which adds it */
  .tray {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .tray-label {
    margin-right: 4px;
    color: var(--_muted);
    font: 600 11px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .dev {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 0 12px 0 10px;
    border: 1px dashed var(--_line);
    border-radius: 999px;
    background: transparent;
    color: var(--_text);
    font: 600 13px/1 var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
    transition:
      border-color 0.12s,
      background 0.12s;
  }
  .dev::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--_live);
  }
  .dev.here::before {
    background: var(--_accent);
  }
  /* a panel is no device: a square where a device has a light */
  .dev.panel::before,
  .led.square {
    border-radius: 2px;
    background: var(--_accent);
  }
  .col.ofpanel {
    border-color: color-mix(in oklab, var(--_accent) 30%, var(--_line));
  }
  .sub.in.pn {
    background: color-mix(in oklab, var(--_accent) 14%, transparent);
    color: var(--_accent);
  }
  td.topanel {
    background: linear-gradient(var(--_row, transparent), var(--_row, transparent)), color-mix(in oklab, var(--_accent) 3%, transparent);
  }
  .dev:hover {
    border-style: solid;
    border-color: var(--_accent);
    background: color-mix(in oklab, var(--_accent) 9%, transparent);
  }
  .nothing {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--_line);
    border-radius: 10px;
    color: var(--_muted);
    text-align: center;
  }
  .scroll {
    overflow-x: auto;
  }
  /* as wide as its columns, not as the room it is given: a crossing stays under its head and beside its row's name */
  table {
    border-collapse: separate;
    border-spacing: 0;
  }
  th,
  td {
    padding: 0;
  }
  thead th {
    vertical-align: bottom;
    padding: 0 3px 10px;
  }
  /* an output's head: where it is, its name, what its device is; pressed for its details */
  .col {
    box-sizing: border-box;
    display: grid;
    gap: 3px;
    width: 128px;
    min-width: 104px;
    padding: 8px 10px 9px;
    border: 1px solid var(--_line);
    border-radius: 10px;
    background: color-mix(in oklab, var(--_panel-2) 55%, var(--_panel));
    color: inherit;
    font: inherit;
    text-align: left;
    transition:
      border-color 0.12s,
      background 0.12s;
  }
  button.col {
    cursor: pointer;
  }
  button.col:hover {
    border-color: var(--_faint);
    background: var(--_panel);
  }
  /* the head and its ×, one box as wide as the head: a matrix wider than its columns stretches the column, not the head */
  .pin {
    position: relative;
    display: inline-block;
    vertical-align: bottom;
  }
  /* the head's ×: in its top right corner, over the head's own button */
  .x {
    position: absolute;
    top: 3px;
    right: 3px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--_faint);
    font: 500 17px/1 var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .x:hover {
    background: color-mix(in oklab, var(--_text) 9%, transparent);
    color: var(--_text);
  }
  .asking {
    border-color: var(--_warn);
    background: var(--_panel);
  }
  .asking .name {
    font-size: 13px;
    white-space: normal;
  }
  .ask {
    display: flex;
    gap: 4px;
  }
  .ask button {
    flex: 1;
    min-height: 30px;
    padding: 0 4px;
    border: 1px solid var(--_line);
    border-radius: 6px;
    background: var(--_panel);
    color: var(--_text);
    font: 600 13px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .ask .danger {
    border-color: var(--_warn);
    color: var(--_warn);
  }
  .col.builtin {
    border-color: color-mix(in oklab, var(--_accent) 45%, var(--_line));
    background: color-mix(in oklab, var(--_accent) 9%, var(--_panel));
  }
  .col.builtin .slot {
    color: var(--_accent);
  }
  .col[aria-pressed='true'] {
    border-color: var(--_accent);
    box-shadow: 0 0 0 1px var(--_accent) inset;
    background: var(--_panel);
  }
  /* not plugged in: kept, and drawn as waiting */
  .col.absent {
    border-style: dashed;
    background: transparent;
  }
  .absent .name {
    color: var(--_muted);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    /* (clear of the ×) */
    padding-right: 18px;
  }
  .slot {
    color: var(--_muted);
    font: 700 10.5px/1 var(--wm-font-num, ui-monospace, monospace);
    letter-spacing: 0.06em;
  }
  .name {
    overflow: hidden;
    font-weight: 600;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .facts {
    overflow: hidden;
    min-height: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--_muted);
    font-size: 11.5px;
    line-height: 15px;
  }
  .tag + .tag::before {
    content: '·';
    margin: 0 4px;
    color: var(--_faint);
  }
  .tag.gone {
    color: var(--_warn);
  }
  .led {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--_off);
  }
  .led.on {
    background: var(--_live);
  }
  .absent .led {
    background: transparent;
    box-shadow: 0 0 0 1.5px var(--_warn) inset;
  }
  /* a row under the pointer is tinted across, its name too, which stays opaque over what scrolls under it */
  tbody tr:hover > * {
    --_row: color-mix(in oklab, var(--_text) 4%, transparent);
  }
  tbody th {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 0;
    padding: 5px 12px 5px 6px;
    /* the names stay as the matrix scrolls sideways, over the ground the frontend draws it on */
    background: linear-gradient(var(--_row, transparent), var(--_row, transparent)), var(--wm-surface, var(--_panel));
    text-align: left;
  }
  /* a name wraps within at most 36 % of the matrix (96 px at least), its tags (IN, Plays, a seat's part) on a line under it */
  .rowname {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    width: max-content;
    max-width: max(96px, 36cqi);
    overflow-wrap: anywhere;
  }
  .rowname > * {
    max-width: 100%;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  @container (max-width: 480px) {
    .col {
      width: 94px;
      min-width: 88px;
      padding: 7px 8px 8px;
    }
    .jack {
      min-width: 52px;
    }
  }
  .label {
    font: 600 14.5px var(--wm-font-num, ui-monospace, monospace);
  }
  .sub {
    font-size: 12px;
    color: var(--_muted);
  }
  .sub.in {
    padding: 2px 5px;
    border-radius: 4px;
    background: color-mix(in oklab, var(--_live) 15%, transparent);
    color: var(--_live);
    font: 700 10px/1 var(--wm-font-num, ui-monospace, monospace);
    letter-spacing: 0.06em;
    flex: none;
    white-space: nowrap;
    /* (on the label's line, a little above its baseline) */
    transform: translateY(-1px);
  }
  tr.empty .label {
    font-weight: 500;
    color: var(--_faint);
  }
  tbody tr + tr > * {
    border-top: 1px solid color-mix(in oklab, var(--_line) 45%, transparent);
  }
  tbody tr.group > * {
    border-top: 1px solid var(--_line);
  }
  /* the clock, first: a rule under it, over the frontend's rows */
  tbody tr.clock + tr > * {
    border-top: 1px solid var(--_line);
  }
  td {
    padding: 3px 4px;
    background: var(--_row, transparent);
    text-align: center;
  }
  td.here {
    background: linear-gradient(var(--_row, transparent), var(--_row, transparent)), color-mix(in oklab, var(--_accent) 5%, transparent);
  }
  .jack {
    display: grid;
    place-items: center;
    width: 100%;
    min-width: 64px;
    height: 38px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  span.jack {
    cursor: default;
  }
  /* an empty crossing: a dot, which opens into a ring under the pointer */
  .hole {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--_off);
    transition:
      transform 0.12s,
      background 0.12s,
      box-shadow 0.12s;
  }
  button.jack:hover .hole,
  button.jack:focus-visible .hole {
    background: transparent;
    box-shadow: 0 0 0 1px var(--_accent);
    transform: scale(2.6);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    background: oklch(var(--wm-chip-l, 0.72) var(--wm-chip-c, 0.13) var(--h));
    color: var(--wm-chip-ink, #10131a);
    font: 700 13.5px var(--wm-font-num, ui-monospace, monospace);
    transition: transform 0.12s;
  }
  button.jack:hover .chip {
    transform: scale(1.06);
  }
  .chip.keep {
    box-shadow: 0 0 0 1px var(--_line) inset;
    background: var(--_panel-2);
    color: var(--_text);
    font-size: 12px;
  }
  /* heard on this device: the accent, quieter than a channel */
  .chip.on {
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--_accent) 45%, transparent) inset;
    background: color-mix(in oklab, var(--_accent) 16%, transparent);
    color: var(--_accent);
    font-size: 12px;
  }
  .chip.lit {
    filter: brightness(1.2) saturate(1.3);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_live) 45%, transparent);
  }
  .via {
    color: var(--_muted);
    font-size: 12px;
    font-style: italic;
  }
  /* on a line of its own under the name and IN, the name's whole width, so a short label is shown whole (#48) */
  .plays {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
    min-height: 26px;
    padding: 0 4px;
    border: 1px solid color-mix(in oklab, var(--_live) 55%, var(--_line));
    border-radius: 6px;
    background: color-mix(in oklab, var(--_live) 8%, transparent);
    color: var(--_live);
    font: 600 11.5px/1 var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .plays.off {
    border-color: var(--_line);
    background: transparent;
    color: var(--_muted);
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
    border-radius: 6px;
    background: transparent;
    color: var(--_muted);
    font: 600 13px var(--wm-font, system-ui, sans-serif);
    cursor: pointer;
  }
  .more:hover {
    background: color-mix(in oklab, var(--_text) 6%, transparent);
    color: var(--_text);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  :is(button, select):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .dev,
    .col,
    .hole,
    .chip {
      transition: none;
    }
  }
</style>
