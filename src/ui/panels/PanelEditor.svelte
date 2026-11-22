<script lang="ts">
  /**
   * A panel edited (decision 005, the editor): the panel as it will be played, where a control or a group is pressed
   * to choose it, and beside it what is chosen, field by field. A control in a template, or in a group that repeats, is
   * one definition however many times it is drawn: all its instances are marked, and a change is a change to all.
   * A binding is one line (what it speaks, its number or an expression, its range), with what it comes to in each
   * instance said under it. Controlled: it takes the panel and calls back the panel changed (`onchange`), read
   * through `readPanel`, so what it gives is always a panel that keeps; it keeps only what is chosen, and what to undo.
   * Given `onsend`, a Try toggle plays the panel as it stands (a press plays and chooses nothing) through it, and
   * only while it is on: with Try off nothing the stage does reaches `onsend`; without one there is nothing to try and the
   * editor only edits. A node moves into a group of its choice or out of its own
   * (`moveNode`), refused in words where the move would change what it means. A group with its children inline is made
   * a template (a name asked in a field beside its button, Enter or Make to confirm, Escape to cancel: `extractTemplate`); a
   * group that uses one shows the template's name and its parameters as fields to rename, and Detach (`detachTemplate`),
   * each refused in words through the same note, and each one step of Undo. A group that repeats lists its instances
   * (`repeatValues`), up to 64 rows from a value of the reader's choice, each with a label field that is its override
   * (`setOverride`); the instance of the row focused is marked in the stage. Where the two columns stack (a phone),
   * what is chosen is edited in a sheet docked to the bottom, with its name and a close control, its bindings first, so
   * the control and its first binding are in view at once; the panel's own fields stay where they are.
   */
  import {
    BINDING_KINDS,
    childrenAt,
    containerOf,
    CONTROL_TYPES,
    detachProblem,
    detachTemplate,
    duplicateNode,
    extractTemplate,
    insertNode,
    instantiate,
    isGroup,
    MAX_VALUE,
    moveNode,
    moveOutOf,
    moveProblem,
    moveTargets,
    MAX_OVERRIDES,
    nameProblem,
    newControl,
    newGroup,
    nodeAt,
    numberHint,
    numberProblem,
    ofKind,
    overrideProblem,
    readPanel,
    removeNode,
    renameParam,
    renameParamProblem,
    renameTemplate,
    renameTemplateProblem,
    repeatValues,
    samePath,
    setOverride,
    templateProblem,
    updateNode,
    type Binding,
    type BindingKind,
    type Control,
    type ControlType,
    type Group,
    type NodePath,
    type Num,
    type NumberField,
    type Panel,
    type PanelNode,
  } from '../../core/panels/index';
  import PanelView from './PanelView.svelte';

  interface Props {
    panel: Panel;
    onchange: (panel: Panel) => void;
    /** Where Try sends what a press makes (a frontend's: the panel's row of the patch); without it there is no Try. */
    onsend?: (data: number[]) => void;
  }

  let { panel, onchange, onsend }: Props = $props();

  /** Whether the stage is played, not chosen from: a press plays the control (through `onsend`) and the choice stays as it was. */
  let trying = $state(false);
  let stage: { silence(): void } | undefined = $state();
  /**
   * What the stage sends, and the only way it reaches `onsend`: while Try is off nothing goes through, whatever made it
   * (a key on a widget, a drag begun while Try was on). The stage stays a view to choose from, its widgets inert; this gate
   * is read at each message, so no press, key or drag that outlives Try's turning off sends after it.
   */
  const stageSend = (data: number[]) => {
    if (trying) onsend?.(data);
  };
  function toggleTry() {
    // (turning it off lets go of every note held, as leaving the view does)
    if (trying) stage?.silence();
    trying = !trying;
  }

  /** The place chosen: a control or a group; none is the panel itself. */
  let selected: NodePath | null = $state(null);
  let past: Panel[] = $state.raw([]);
  let future: Panel[] = $state.raw([]);
  /** How many steps back are kept. */
  const STEPS = 100;

  /** Why the last change asked for wasn't taken, and for which place: said at the top of the inspector until something is taken or another place is chosen. */
  let note = $state<{ at: NodePath; message: string } | null>(null);

  /** A template's name being asked for, for the group at `at`: the text typed stays through a refusal, to be edited. */
  let naming = $state<{ at: NodePath; text: string } | null>(null);
  const asking = $derived(!!naming && samePath(naming.at, selected));
  let makeButton: HTMLButtonElement | undefined = $state();
  const node = $derived(selected ? nodeAt(panel, selected) : undefined);
  /** A name refused is said only at the place it was asked for. */
  const here = $derived(!!note && samePath(note.at, selected));
  const made = $derived(instantiate(panel));
  /** The instances of the control chosen, in the order drawn. */
  const instances = $derived(made.controls.filter((c) => samePath(c.source, selected)));
  const uid = $props.id();
  let editor: HTMLElement | undefined = $state();
  let sheet: HTMLElement | undefined = $state();
  /** What the sheet calls what is chosen. */
  const what = $derived(!node ? '' : isGroup(node) ? node.group : node.label || node.id || node.type);
  /** The instance of the group chosen whose label is being edited (its row has focus): marked in the stage. */
  let focused = $state<number | null>(null);
  /** Where the list of a large repeat's instances starts (a value), or null for its first. */
  let listFrom = $state<number | null>(null);
  $effect.pre(() => {
    void selected;
    focused = null;
    listFrom = null;
  });
  /** Closed: nothing is chosen, and focus stays in the editor, so its keys still work. */
  function close() {
    selected = null;
    note = null;
    naming = null;
    editor?.focus();
  }
  // a thing chosen where the inspector is a sheet is kept clear of it: scrolled into view above it
  $effect(() => {
    if (!selected || !sheet || getComputedStyle(sheet).position !== 'sticky') return;
    editor?.querySelector('.stage .picked')?.scrollIntoView?.({ block: 'nearest' });
  });

  // another panel given: nothing of the one before is chosen, or to undo
  let editing: string | null = null;
  $effect.pre(() => {
    if (panel.id === editing) return;
    editing = panel.id;
    selected = null;
    past = [];
    future = [];
  });

  /** Whether two panels, as plain data, are the same: a field left undefined is no field, and an object's keys have no order. */
  function same(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
    const [x, y] = [a, b].map((o) => Object.entries(o).filter(([, v]) => v !== undefined));
    return x.length === y.length && x.every(([k, v]) => same(v, (b as Record<string, unknown>)[k]));
  }

  /** A change made: kept as the reader keeps it, the panel of before kept to undo. False when nothing was taken (the reader refused it, or it changed nothing). */
  function commit(next: Panel, select: NodePath | null = selected): boolean {
    const read = readPanel(next);
    if (!read || read === panel) return false;
    // (a change the reader would keep only in part, a number too long or a value out of range: refused, not made to look taken)
    if (!same(read, next)) {
      if (selected) note = { at: selected, message: 'That can’t be kept as typed (a text or an expression too long, or a number the panel can’t hold), so nothing changed.' };
      return false;
    }
    past = [...past, panel].slice(-STEPS);
    future = [];
    selected = select;
    note = null;
    naming = null;
    onchange(read);
    return true;
  }
  /** A field whose change wasn't taken is put back to what the panel holds, so a field never says what the panel doesn't. */
  const settle = (e: Event, taken: unknown, held: string | number | undefined) => {
    if (taken === false) (e.currentTarget as HTMLInputElement).value = String(held ?? '');
  };
  /** A name asked for, the control's or the group's: refused in words beside the field, or set. */
  const named = (field: 'id' | 'group', wanted: string): boolean => {
    const t = wanted.trim();
    const problem = selected ? nameProblem(panel, selected, t) : undefined;
    if (selected && problem) {
      note = { at: selected, message: problem };
      return false;
    }
    return field === 'id' ? control('id', t) !== false : group('group', t) !== false;
  };
  /** A number typed into a plain field, read strictly (`numberProblem`): refused in words beside the field, or given to `take` as written. */
  const strict = (field: NumberField, wanted: string, take: (t: string) => boolean): boolean => {
    const problem = selected ? numberProblem(field, wanted) : undefined;
    if (selected && problem) {
      note = { at: selected, message: problem };
      return false;
    }
    return take(wanted.trim());
  };
  /** The panel a step goes to: the place chosen is kept where it is still there, else nothing is chosen. */
  const stepTo = (to: Panel) => {
    if (selected && !nodeAt(to, selected)) selected = null;
    note = null;
    naming = null;
    onchange(to);
  };
  function undo() {
    const back = past.at(-1);
    if (!back) return false;
    past = past.slice(0, -1);
    future = [...future, panel];
    stepTo(back);
    return true;
  }
  function redo() {
    const again = future.at(-1);
    if (!again) return false;
    future = future.slice(0, -1);
    past = [...past, panel];
    stepTo(again);
    return true;
  }
  /** Ctrl or Cmd with Z (Shift: redo) or Y, Delete and Backspace on the control chosen: only from inside the editor, and a text field or a select keeps its own keys. */
  function shortcut(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable]') || e.altKey) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const taken =
      mod && k === 'z'
        ? e.shiftKey
          ? redo()
          : undo()
        : mod && k === 'y'
          ? redo()
          : !mod && (e.key === 'Delete' || e.key === 'Backspace') && !!selected && !!node
            ? remove()
            : false;
    if (!taken) return;
    e.preventDefault();
    // (a control removed takes focus with it, once the panel is drawn again: focus goes to the editor, so the next key still reaches it)
    if (e.key === 'Delete' || e.key === 'Backspace') (e.currentTarget as HTMLElement).focus();
  }

  /** What a field holds as a number or an expression; nothing for an empty field. */
  const toNum = (text: string): Num | undefined => {
    const t = text.trim();
    return t === '' ? undefined : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
  };
  const text = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;
  /** A field's value, or the field left out when it is empty. */
  const set = <T extends object>(o: T, field: string, value: unknown): T => {
    const { [field as keyof T]: _old, ...rest } = o;
    return (value === undefined || value === '' ? rest : { ...rest, [field]: value }) as T;
  };

  const change = (to: (n: PanelNode) => PanelNode): boolean => (selected ? commit(updateNode(panel, selected, to)) : false);
  const control = (field: string, value: unknown) => change((n) => (isGroup(n) ? n : set(n, field, value)));
  const group = (field: string, value: unknown) => change((n) => (isGroup(n) ? set(n, field, value) : n));
  const binding = (i: number, to: (b: Binding) => Binding) => change((n) => (isGroup(n) ? n : { ...n, bind: (n.bind ?? []).map((b, j) => (j === i ? to(b) : b)) }));

  /** A change that is a core operation: refused in words at the group chosen when the core has a reason, else one change (one step of Undo). */
  function operate(problem: string | undefined, next: () => Panel): boolean {
    if (!selected) return false;
    if (problem) {
      note = { at: selected, message: problem };
      return false;
    }
    return commit(next());
  }
  /** The label of one instance of the group chosen set, or cleared by an empty text: one change, refused in words at the group. True when the text is as the panel holds it. */
  function labelled(value: number, wanted: string): boolean {
    if (!selected) return false;
    const problem = overrideProblem(panel, selected, value, wanted);
    if (problem) return operate(problem, () => panel);
    const next = setOverride(panel, selected, value, wanted);
    return next === panel || commit(next);
  }
  /** The group chosen made a template of the name typed. */
  function make() {
    if (!selected || !naming) return;
    const at = selected;
    const wanted = naming.text.trim();
    if (operate(templateProblem(panel, at, wanted), () => extractTemplate(panel, at, wanted))) editor?.focus();
  }
  function stopNaming() {
    naming = null;
    // (the button the field replaced takes focus back)
    queueMicrotask(() => makeButton?.focus());
  }
  const detach = () => selected && operate(detachProblem(panel, selected), () => detachTemplate(panel, selected!));
  /** A template given another name, every group that uses it following. */
  const renamed = (from: string, wanted: string): boolean => {
    const to = wanted.trim();
    return to === from || operate(renameTemplateProblem(panel, from, to), () => renameTemplate(panel, from, to));
  };
  const renamedParam = (template: string, from: string, wanted: string): boolean => {
    const to = wanted.trim();
    return to === from || operate(renameParamProblem(panel, template, from, to), () => renameParam(panel, template, from, to));
  };
  /** How many groups use a template, in the panel and in templates. */
  function usesOf(name: string): number {
    const count = (nodes: readonly PanelNode[]): number => nodes.reduce((n, c) => n + (!isGroup(c) ? 0 : c.use !== undefined ? +(c.use === name) : count(c.children ?? [])), 0);
    return count(panel.children) + Object.values(panel.templates ?? {}).reduce((n, t) => n + count(t.children), 0);
  }
  /** Where something new goes: into the group chosen (its template, where it uses one), else beside the control chosen, else into the panel. */
  const target = $derived.by((): NodePath => {
    if (!selected || !node) return { at: [] };
    return (isGroup(node) ? containerOf(panel, selected) : undefined) ?? { ...selected, at: selected.at.slice(0, -1) };
  });
  function add(type: ControlType | 'group') {
    const siblings = childrenAt(panel, target) ?? [];
    const added = insertNode(panel, target, type === 'group' ? newGroup(siblings) : newControl(panel, type, siblings));
    commit(added.panel, added.path);
  }
  const move = (by: -1 | 1) => {
    if (!selected) return;
    const moved = moveNode(panel, selected, by);
    commit(moved.panel, moved.path);
  };
  const copy = () => {
    if (!selected) return;
    const twice = duplicateNode(panel, selected);
    commit(twice.panel, twice.path);
  };
  const remove = () => selected && commit(removeNode(panel, selected), null);
  /** Moved to a place: one change, the node still chosen; refused in words at the node when it can't go. */
  function moveTo(container: NodePath, index?: number) {
    if (!selected) return;
    const problem = moveProblem(panel, selected, container);
    if (problem) {
      note = { at: selected, message: problem };
      return;
    }
    const moved = moveNode(panel, selected, { container, index: index ?? childrenAt(panel, container)?.length ?? 0 });
    commit(moved.panel, moved.path);
  }
  /** The groups the node chosen can go into, and the place right after its own group, if it is in one. */
  const targets = $derived(selected && node ? moveTargets(panel, selected) : []);
  const out = $derived(selected && node ? moveOutOf(panel, selected) : undefined);

  /** Why this control's instances aren't read as written, each reason once (the same one in every instance of a definition), without the instance it came from. */
  const why = $derived.by(() => {
    const out = new Set<string>();
    for (const e of made.errors) {
      const at = instances.find((c) => e.startsWith(`${c.key}: `));
      if (at) out.add(e.slice(at.key.length + 2));
    }
    return [...out];
  });

  /** What a binding comes to across the instances of the control chosen: "CC 11 … 18, channel 1", or why it isn't there. */
  function resolved(b: Binding): string {
    const bound = instances.flatMap((c) => c.bindings.filter((x) => x.kind === b.kind && x.axis === (b.axis ?? 'x')).slice(0, 1));
    if (!bound.length) return 'Not resolved: see why, below.';
    const span = (values: number[]) => (values.every((v) => v === values[0]) ? String(values[0]) : `${values[0]} … ${values.at(-1)}`);
    const numbered = b.kind !== 'program' && b.kind !== 'bend' && b.kind !== 'pressure';
    const first = bound[0]!;
    return `${numbered ? `${b.kind} ${span(bound.map((x) => x.number))}, ` : ''}channel ${span(bound.map((x) => x.channel + 1))}, sends ${first.lo} … ${first.hi}${bound.length > 1 ? `, in ${bound.length} places` : ''}`;
  }

  /** A binding's range from its two fields: none when both are empty (the kind's whole range), else an empty one filled in from that. */
  const range = (b: Binding, lo: Num | undefined, hi: Num | undefined): readonly [Num, Num] | undefined =>
    lo === undefined && hi === undefined ? undefined : [lo ?? 0, hi ?? MAX_VALUE[b.kind]];

  const layoutOf = (columns?: number) => (!columns ? 'row' : columns === 1 ? 'strip' : 'grid');
  const columnsFor = (layout: string, was?: number) => (layout === 'row' ? undefined : layout === 'strip' ? 1 : Math.max(2, was ?? 2));
  const KINDS: Readonly<Record<BindingKind, string>> = {
    cc: 'Control change',
    cc14: 'Control change, 14-bit',
    note: 'Note',
    program: 'Program change',
    bend: 'Pitch bend',
    pressure: 'Channel pressure',
    nrpn: 'NRPN',
    rpn: 'RPN',
  };
  const TYPES: Readonly<Record<ControlType, string>> = {
    button: 'Button',
    switch: 'Switch',
    knob: 'Knob',
    fader: 'Fader',
    xy: 'XY pad',
    label: 'Label',
    keyboard: 'Keyboard',
    pads: 'Drum pads',
  };
  const numbered = (k: BindingKind) => k !== 'program' && k !== 'bend' && k !== 'pressure';
</script>

{#snippet field(label: string, value: string | number | undefined, onset: (text: string) => unknown, hint = '', mono = false)}
  <label class="field">
    <span
      >{label}{#if hint}<small>{hint}</small>{/if}</span
    >
    <input class:mono value={value ?? ''} autocomplete="off" spellcheck="false" onchange={(e) => settle(e, onset(text(e)), value)} />
  </label>
{/snippet}

{#snippet layout(columns: number | undefined, onset: (columns: number | undefined) => void)}
  <label class="field">
    <span>Layout<small>How its children stand</small></span>
    <span class="pair">
      <select value={layoutOf(columns)} onchange={(e) => onset(columnsFor(text(e), columns))}>
        <option value="row">A row</option>
        <option value="strip">A strip</option>
        <option value="grid">A grid</option>
      </select>
      {#if columns && columns > 1}
        <input
          class="mono short"
          type="number"
          min="2"
          max="64"
          aria-label="Columns"
          value={columns}
          onchange={(e) => settle(e, onset(Math.max(2, Math.round(Number(text(e))) || 2)), columns)}
        />
      {/if}
    </span>
  </label>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wm-editor" tabindex="-1" bind:this={editor} onkeydown={shortcut}>
  <div class="stage">
    <div class="tools" role="toolbar" aria-label="Add to the panel">
      <span class="eyebrow">Add</span>
      {#each CONTROL_TYPES as type (type)}<button type="button" onclick={() => add(type)}>{TYPES[type]}</button>{/each}
      <button type="button" onclick={() => add('group')}>Group</button>
      <span class="grow"></span>
      {#if onsend}<button type="button" class:on={trying} aria-pressed={trying} onclick={toggleTry}>Try</button>{/if}
      <button type="button" class="quiet" onclick={undo} disabled={!past.length}>Undo</button>
      <button type="button" class="quiet" onclick={redo} disabled={!future.length}>Redo</button>
    </div>
    <p class="where">
      {selected && node
        ? isGroup(node)
          ? 'New things go into the group chosen.'
          : 'New things go beside the control chosen.'
        : 'New things go into the panel. Press a control or a group to choose it.'}
    </p>
    <PanelView
      bind:this={stage}
      {panel}
      onsend={stageSend}
      bar={false}
      {selected}
      marked={selected && focused !== null ? { source: selected, value: focused } : null}
      onselect={trying ? undefined : (source) => ((selected = source), (note = null), (naming = null))}
    />
  </div>

  <aside class="inspector" class:sheet={!!selected && !!node} aria-label="What is chosen" bind:this={sheet}>
    {#if selected && node}
      <div class="sheet-head">
        <span class="what">{what}</span>
        <button type="button" class="close" aria-label="Close" onclick={close}>×</button>
      </div>
    {/if}
    {#if here && note}<p class="note" role="alert">{note.message}</p>{/if}
    {#if selected && node && !isGroup(node)}
      {@const c = node as Control}
      <p class="eyebrow">Control</p>
      {#if instances.length > 1}<p class="scope">One definition, drawn {instances.length} times: a change here changes them all.</p>{/if}
      <label class="field">
        <span>Kind</span>
        <select value={c.type} onchange={(e) => control('type', text(e))}>
          {#each CONTROL_TYPES as type (type)}<option value={type}>{TYPES[type]}</option>{/each}
        </select>
      </label>
      {@render field('Label', c.label, (t) => control('label', t), 'Text; {…} holds an expression')}
      {@render field('Name', c.id, (t) => named('id', t), 'In its key, among its siblings', true)}
      {#if c.type !== 'label' && c.type !== 'keyboard' && c.type !== 'pads'}
        {@render field('Starts at', c.value, (t) => strict('start', t, (v) => control('value', v === '' ? undefined : Number(v))), '0 to 1', true)}
      {/if}
      {#if c.type === 'keyboard'}
        <div class="pair">
          {@render field('Lowest note', c.low, (t) => strict('note', t, (v) => control('low', v === '' ? undefined : Number(v))), '', true)}
          {@render field('Highest note', c.high, (t) => strict('note', t, (v) => control('high', v === '' ? undefined : Number(v))), '', true)}
        </div>
      {/if}
      {#if c.type === 'pads'}
        {@render field(
          'Notes',
          c.notes?.join(', '),
          (t) =>
            strict('notes', t, (v) =>
              control(
                'notes',
                v
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .map(Number),
              ),
            ),
          'One for each pad',
          true,
        )}
      {/if}
      <div class="pair">
        {@render field(
          'Spans columns',
          c.cell?.columns,
          (t) => strict('span', t, (v) => control('cell', set(c.cell ?? {}, 'columns', v === '' ? undefined : Number(v)))),
          '',
          true,
        )}
        {@render field('Spans rows', c.cell?.rows, (t) => strict('span', t, (v) => control('cell', set(c.cell ?? {}, 'rows', v === '' ? undefined : Number(v)))), '', true)}
      </div>

      {#if c.type !== 'label' && c.type !== 'keyboard' && c.type !== 'pads'}
        <div class="sends">
          <p class="eyebrow">Sends and receives</p>
          {#each c.bind ?? [] as b, i (i)}
            <div class="binding" role="group" aria-label="Binding {i + 1}">
              <div class="line">
                <select aria-label="What it speaks" value={b.kind} onchange={(e) => binding(i, (x) => ofKind(x, text(e) as BindingKind))}>
                  {#each BINDING_KINDS as kind (kind)}<option value={kind}>{KINDS[kind]}</option>{/each}
                </select>
                {#if numbered(b.kind)}
                  <input
                    class="mono"
                    aria-label="Number, or an expression"
                    aria-describedby="{uid}-n{i}"
                    title={numberHint(b.kind)}
                    placeholder="number"
                    value={b.number ?? ''}
                    spellcheck="false"
                    onchange={(e) =>
                      settle(
                        e,
                        binding(i, (x) => set(x, 'number', toNum(text(e)))),
                        b.number,
                      )}
                  />
                {/if}
                <button
                  type="button"
                  class="quiet x"
                  aria-label="Remove binding {i + 1}"
                  onclick={() =>
                    control(
                      'bind',
                      (c.bind ?? []).filter((_, j) => j !== i),
                    )}>×</button
                >
              </div>
              {#if numbered(b.kind)}<p class="range" id="{uid}-n{i}">{numberHint(b.kind)}</p>{/if}
              <div class="line">
                <span class="small">sends</span>
                <input
                  class="mono short"
                  aria-label="From"
                  placeholder="0"
                  value={b.range?.[0] ?? ''}
                  spellcheck="false"
                  onchange={(e) =>
                    settle(
                      e,
                      binding(i, (x) => set(x, 'range', range(x, toNum(text(e)), x.range?.[1]))),
                      b.range?.[0],
                    )}
                />
                <span class="small">to</span>
                <input
                  class="mono short"
                  aria-label="To"
                  placeholder="max"
                  value={b.range?.[1] ?? ''}
                  spellcheck="false"
                  onchange={(e) =>
                    settle(
                      e,
                      binding(i, (x) => set(x, 'range', range(x, x.range?.[0], toNum(text(e))))),
                      b.range?.[1],
                    )}
                />
                <span class="small">ch</span>
                <input
                  class="mono short"
                  aria-label="Channel"
                  placeholder="—"
                  value={b.channel ?? ''}
                  spellcheck="false"
                  onchange={(e) =>
                    settle(
                      e,
                      binding(i, (x) => set(x, 'channel', toNum(text(e)))),
                      b.channel,
                    )}
                />
                {#if c.type === 'xy'}
                  <select aria-label="Which value" value={b.axis ?? 'x'} onchange={(e) => binding(i, (x) => set(x, 'axis', text(e) === 'y' ? 'y' : undefined))}>
                    <option value="x">across</option>
                    <option value="y">up</option>
                  </select>
                {/if}
              </div>
              <p class="comes">{resolved(b)}</p>
            </div>
          {/each}
          {#if why.length}
            <ul class="why" aria-label="Why it isn’t read">
              {#each why as reason (reason)}<li>{reason}</li>{/each}
            </ul>
          {/if}
          <div class="actions"><button type="button" onclick={() => control('bind', [...(c.bind ?? []), { kind: 'cc', number: 1 }])}>Add a binding</button></div>
        </div>
      {/if}
    {:else if selected && node && isGroup(node)}
      {@const g = node as Group}
      <p class="eyebrow">Group</p>
      {@render field('Name', g.group, (t) => named('group', t), 'In its children’s keys', true)}
      {@render field('Label', g.label, (t) => group('label', t), 'Text; {…} holds an expression')}
      {@render layout(g.columns, (columns) => group('columns', columns))}
      {@render field('Channel', g.channel, (t) => group('channel', toNum(t)), '1 to 16, for everything in it', true)}
      <label class="field">
        <span>Repeat<small>Once for each number, as a name its children use</small></span>
        <input
          id="{uid}-repeat"
          type="checkbox"
          role="switch"
          class="switch"
          checked={!!g.repeat}
          onchange={(e) => group('repeat', e.currentTarget.checked ? { name: 'ch', from: 1, to: 4 } : undefined)}
        />
      </label>
      {#if g.repeat}
        {@const r = g.repeat}
        <div class="line">
          <input class="mono short" aria-label="The name" value={r.name} spellcheck="false" onchange={(e) => group('repeat', { ...r, name: text(e) })} />
          <span class="small">from</span>
          <input class="mono short" aria-label="Repeat from" value={r.from} spellcheck="false" onchange={(e) => group('repeat', { ...r, from: toNum(text(e)) ?? 1 })} />
          <span class="small">to</span>
          <input class="mono short" aria-label="Repeat to" value={r.to} spellcheck="false" onchange={(e) => group('repeat', { ...r, to: toNum(text(e)) ?? 1 })} />
        </div>
      {/if}
      {#if g.repeat && selected}
        {@const values = repeatValues(made, selected)}
        {@const from = listFrom ?? values[0] ?? 0}
        {@const rows = values.filter((v) => v >= from).slice(0, MAX_OVERRIDES)}
        {#if rows.length}
          <div class="instances" role="group" aria-label="Instances, by {g.repeat.name}">
            <p class="comes">An instance may have a label of its own; an empty field leaves it the group’s.</p>
            {#each rows as v (v)}
              {@const held = g.overrides?.[String(v)]?.label ?? ''}
              <label class="field" onfocusin={() => (focused = v)} onfocusout={() => (focused = null)}>
                <span>{g.repeat.name} = {v}</span>
                <input
                  aria-label="Label of instance {v}"
                  placeholder={g.label ?? ''}
                  value={held}
                  autocomplete="off"
                  spellcheck="false"
                  onchange={(e) => settle(e, labelled(v, text(e)), held)}
                />
              </label>
            {/each}
            {#if values.length > rows.length || from > (values[0] ?? from)}
              <p class="more comes">Listing {rows.length} of {values.length} instances, from {rows[0]}.</p>
              <label class="field">
                <span>List from<small>The value its list starts at</small></span>
                <input class="mono short" aria-label="List from" value={from} spellcheck="false" onchange={(e) => ((listFrom = Math.round(Number(text(e))) || null), true)} />
              </label>
            {/if}
          </div>
        {/if}
      {/if}
      {#if g.use !== undefined}
        <p class="scope">Its children are the template “{g.use}”’s: a control pressed in it is the template’s, in every group that uses it.</p>
        {#each panel.templates?.[g.use]?.params ?? [] as param (param)}
          {@render field(`Gives “${param}”`, g.with?.[param], (t) => group('with', set(g.with ?? {}, param, toNum(t))), 'A number, or an expression', true)}
        {/each}
        {@render field('Template', g.use, (t) => renamed(g.use!, t), 'Its name; every group that uses it follows', true)}
        {#each panel.templates?.[g.use]?.params ?? [] as param (param)}
          {@render field(`Parameter “${param}”`, param, (t) => renamedParam(g.use!, param, t), 'Its name, in the template and in every group that uses it', true)}
        {/each}
        <div class="template">
          <p class="comes">
            {usesOf(g.use) > 1
              ? `Used by ${usesOf(g.use)} groups: detaching copies it into this one, and the template stays for the others.`
              : 'Only this group uses it: detaching copies it into the group and takes the template away.'}
          </p>
          <div class="actions"><button type="button" onclick={detach}>Detach</button></div>
        </div>
      {:else if g.children?.length}
        <div class="template">
          {#if asking}
            <div class="line">
              <input
                class="mono"
                aria-label="Template name"
                placeholder="a name, e.g. strip"
                autocomplete="off"
                spellcheck="false"
                value={naming?.text ?? ''}
                oninput={(e) => naming && (naming.text = text(e))}
                {@attach (el) => el.focus()}
                onkeydown={(e) => {
                  if (e.key === 'Enter') (e.preventDefault(), make());
                  else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), stopNaming());
                }}
              />
              <button type="button" onclick={make}>Make</button>
              <button type="button" class="quiet" onclick={stopNaming}>Cancel</button>
            </div>
          {:else}
            <div class="actions"><button type="button" bind:this={makeButton} onclick={() => (naming = { at: selected!, text: '' })}>Make a template…</button></div>
          {/if}
        </div>
      {/if}
    {:else}
      <p class="eyebrow">Panel</p>
      {@render field('Name', panel.name, (t) => (t.trim() ? commit({ ...panel, name: t }) : false))}
      {@render layout(panel.columns, (columns) => commit(set(panel, 'columns', columns)))}
      {@render field('Channel', panel.channel, (t) => commit(set(panel, 'channel', toNum(t))), '1 to 16, for everything in it', true)}
      <p class="scope">{made.controls.length} {made.controls.length === 1 ? 'control' : 'controls'}{made.errors.length ? `, ${made.errors.length} not read` : ''}.</p>
    {/if}

    {#if selected && node}
      <div class="actions">
        {#if targets.length}
          <select
            aria-label="Move into"
            value=""
            onchange={(e) => {
              const to = targets[Number(text(e))];
              e.currentTarget.value = '';
              if (to) moveTo(containerOf(panel, to.group)!);
            }}
          >
            <option value="" disabled>Move into…</option>
            {#each targets as to, i (i)}<option value={i}>{to.name}</option>{/each}
          </select>
        {/if}
        {#if out}<button type="button" onclick={() => moveTo(out.container, out.index)}>Move out</button>{/if}
        <button type="button" onclick={() => move(-1)}>Earlier</button>
        <button type="button" onclick={() => move(1)}>Later</button>
        <button type="button" onclick={copy}>Duplicate</button>
        <button type="button" class="danger" onclick={remove}>Delete</button>
      </div>
    {/if}
  </aside>
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-editor {
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
    .wm-editor {
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
  .wm-editor {
    outline: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 14px;
    align-items: start;
    min-width: 0;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
    container-type: inline-size;
  }
  .sheet-head {
    display: none;
  }
  .sends,
  .template,
  .instances {
    display: grid;
    gap: 10px;
  }
  /* where the columns stack: what is chosen is edited in a sheet docked to the bottom of the editor, at most 40% of the viewport high (the bound is 60%) */
  @container (max-width: 760px) {
    .stage,
    .inspector {
      grid-column: 1 / -1;
    }
    .inspector.sheet {
      position: sticky;
      bottom: 0;
      z-index: 2;
      box-sizing: border-box;
      max-height: 40vh;
      max-height: 40dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      gap: 8px;
      padding-top: 0;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      border-radius: 12px 12px 0 0;
      box-shadow: 0 -6px 18px rgb(0 0 0 / 0.18);
    }
    /* the head names it, so its kind's eyebrow goes; the bindings lead, the other fields follow */
    .sheet > .eyebrow,
    .sheet .field small {
      display: none;
    }
    .sheet-head {
      position: sticky;
      top: 0;
      z-index: 1;
      order: -4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 -12px;
      padding: 0 4px 0 12px;
      border-bottom: 1px solid var(--_line);
      background: var(--_panel-2);
    }
    .sheet-head .what {
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sheet-head .close {
      flex: none;
      min-height: 44px;
      min-width: 44px;
      padding: 0;
      border-color: transparent;
      background: transparent;
      font-size: 22px;
    }
    .sheet > .note {
      order: -3;
    }
    .sheet > .scope {
      order: -2;
    }
    .sheet > .sends {
      order: -1;
    }
  }
  .stage {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .tools,
  .actions,
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .grow {
    flex: 1;
  }
  .eyebrow {
    margin: 0;
    color: var(--_muted);
    font: 600 11px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .where,
  .scope,
  .comes,
  .range {
    margin: 0;
    color: var(--_muted);
    font-size: 12.5px;
  }
  .why,
  .note {
    margin: 0;
    color: var(--_warn);
    font-size: 12.5px;
  }
  .why {
    padding-left: 18px;
  }
  .scope {
    padding: 7px 9px;
    border-radius: 6px;
    background: color-mix(in oklab, var(--_accent) 10%, transparent);
    color: var(--_text);
  }
  .inspector {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--_line);
    border-radius: 10px;
    background: color-mix(in oklab, var(--_panel-2) 45%, var(--_panel));
  }
  .field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    align-items: center;
    gap: 10px;
  }
  .field small {
    display: block;
    color: var(--_muted);
    font-size: 11.5px;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pair .field {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  span.pair {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .binding {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--_line);
    border-radius: 8px;
    background: var(--_panel);
  }
  .line > select {
    flex: 1 1 140px;
  }
  .line > input:not(.short) {
    flex: 1 1 70px;
  }
  .tools button {
    min-height: 30px;
    padding: 0 8px;
    font-size: 12.5px;
  }
  .small {
    color: var(--_muted);
    font-size: 12px;
  }
  select,
  input:not(.switch),
  button {
    min-width: 0;
    min-height: 32px;
    padding: 0 8px;
    border: 1px solid var(--_line);
    border-radius: 6px;
    background: var(--_panel);
    color: inherit;
    font: inherit;
  }
  input.mono {
    font: 500 13px var(--wm-font-num, ui-monospace, monospace);
  }
  input.short {
    width: 50px;
    padding: 0 6px;
    flex: none;
  }
  button {
    padding: 0 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--_faint);
  }
  button.quiet {
    border-color: transparent;
    background: transparent;
    color: var(--_muted);
  }
  button.x {
    flex: none;
    width: 32px;
    padding: 0;
    font-size: 17px;
  }
  button.danger {
    margin-left: auto;
    color: var(--_warn);
  }
  button.on {
    border-color: var(--_accent);
    background: color-mix(in oklab, var(--_accent) 16%, var(--_panel));
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .switch {
    appearance: none;
    justify-self: end;
    position: relative;
    width: 40px;
    height: 22px;
    margin: 0;
    border: 1px solid var(--_line);
    border-radius: 999px;
    background: var(--_panel-2);
    cursor: pointer;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--_faint);
  }
  .switch:checked {
    border-color: var(--_accent);
  }
  .switch:checked::after {
    left: 20px;
    background: var(--_accent);
  }
  :is(select, input, button):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
