// @vitest-environment jsdom
// The patchbay's components mounted in a DOM (jsdom): what each shows for the props it is given, and what it calls back.
import { readFileSync } from 'node:fs';
import { DEFAULT_PRESET } from '../core/input-kinds';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeSetup,
  addOutput,
  AS_PLAYED,
  chooseDevice,
  crossingOf,
  DEFAULT_PROFILE,
  inputRow,
  newBook,
  overwrite,
  profileOf,
  renameSetup,
  saveAs,
  withCrossing,
  withPlays,
  withProfile,
  type DeviceProfile,
  type SetupBook,
} from '../core/setups';
import ChannelMeter from './ChannelMeter.svelte';
import DeviceInspector from './DeviceInspector.svelte';
import MidiStatus from './MidiStatus.svelte';
import PatchMatrix from './PatchMatrix.svelte';
import SetupPicker from './SetupPicker.svelte';
import { inputRows, type MatrixRow } from './rows';
import { channelHue, clamp } from './channels';

let mounted: Record<string, unknown>[] = [];
afterEach(() => {
  for (const m of mounted) unmount(m);
  mounted = [];
  document.body.replaceChildren();
});

/** A component mounted into the page, its props reactive so a test can change them. */
function show<P extends Record<string, unknown>>(component: Parameters<typeof mount>[0], props: P): P {
  const live = $state(props);
  mounted.push(mount(component, { target: document.body, props: live }));
  flushSync();
  return live;
}

const one = <E extends Element = HTMLElement>(sel: string) => document.querySelector<E>(sel)!;
const all = (sel: string) => [...document.querySelectorAll(sel)];
const buttons = () => all('button').map((b) => b.textContent?.trim());
const click = (text: string) => {
  (all('button').find((b) => b.textContent?.trim() === text) as HTMLButtonElement).click();
  flushSync();
};
const change = (el: HTMLInputElement | HTMLSelectElement, value: string | boolean) => {
  if (typeof value === 'boolean') (el as HTMLInputElement).checked = value;
  else el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
};

describe('MidiStatus', () => {
  it('before a connection: what it says, and Connect, which waits while connecting', () => {
    const onconnect = vi.fn();
    const props = show(MidiStatus, { message: 'Not connected.', connected: false, onconnect, connecting: false });
    expect(one('[role=status]').textContent).toContain('Not connected.');
    expect(buttons()).toEqual(['Connect']);
    click('Connect');
    expect(onconnect).toHaveBeenCalledOnce();
    props.connecting = true;
    flushSync();
    expect((one('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('connected: Refresh ports and All notes off, and the setup’s devices missing in amber', () => {
    const [onrefresh, onpanic] = [vi.fn(), vi.fn()];
    const props = show(MidiStatus, { message: 'MIDI connected: 1 input, 2 outputs.', connected: true, onconnect: vi.fn(), onrefresh, onpanic, missing: 0 });
    expect(buttons()).toEqual(['Refresh ports', 'All notes off']);
    expect(one('.led').classList.contains('on')).toBe(true);
    click('Refresh ports');
    click('All notes off');
    expect([onrefresh.mock.calls.length, onpanic.mock.calls.length]).toEqual([1, 1]);
    props.missing = 2;
    flushSync();
    expect(one('.led').classList.contains('warn')).toBe(true);
    expect(one('[role=status]').textContent).toBe('MIDI connected: 1 input, 2 outputs. · 2 of this setup’s devices aren’t plugged in');
  });
});

describe('MidiStatus’s connect button (yggi/webmidi#31)', () => {
  it('takes the names it is given, before and while connecting', () => {
    const props = show(MidiStatus, {
      message: 'Not connected.',
      connected: false,
      onconnect: vi.fn(),
      connecting: false,
      connectLabel: 'Connect MIDI',
      connectingLabel: 'Asking…',
    });
    expect(buttons()).toEqual(['Connect MIDI']);
    props.connecting = true;
    flushSync();
    expect(buttons()).toEqual(['Asking…']);
  });
});

describe('ChannelMeter', () => {
  it('marks the channels used and lit, each in its own hue', () => {
    show(ChannelMeter, { used: [10, 1], lit: new Set([10]) });
    expect(all('.cell.on').map((c) => Number((c as HTMLElement).dataset.channel))).toEqual([1, 10]);
    expect(all('.cell.lit').map((c) => (c as HTMLElement).dataset.channel)).toEqual(['10']);
    expect(one('[role=img]').getAttribute('aria-label')).toBe('Channels in use: 1, 10');
    expect(new Set(Array.from({ length: 16 }, (_, i) => channelHue(i + 1))).size).toBe(16);
  });
});

describe('DeviceInspector', () => {
  const circuit = { id: 'out-1', name: 'Circuit Tracks' };
  const ports = [circuit, { id: 'out-2', name: 'Minilogue xd' }];
  function inspect(over: Record<string, unknown> = {}) {
    const calls = { port: vi.fn(), profile: vi.fn(), test: vi.fn(), panic: vi.fn(), remove: vi.fn() };
    const props = show(DeviceInspector, {
      output: { key: 'o1', ...circuit },
      slot: 1,
      ports,
      profile: { ...DEFAULT_PROFILE, latency: 6 } as DeviceProfile,
      used: [2, 10],
      canRemove: true,
      onport: calls.port,
      onprofile: calls.profile,
      ontest: calls.test,
      onpanic: calls.panic,
      onremove: calls.remove,
      ...over,
    });
    return { props, calls };
  }
  const field = (label: string) =>
    all('label')
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input, select') as HTMLInputElement;

  it('shows the device, its profile and the channels routed to it', () => {
    inspect();
    expect(one('h3').textContent).toBe('Circuit Tracks');
    expect((one('select') as HTMLSelectElement).value).toBe('out-1');
    expect(field('Latency').value).toBe('6');
    expect(all('label').some((l) => l.textContent?.includes('clock'))).toBe(false);
    expect(field('Bend range').value).toBe('2');
    expect(all('.cell.on').length).toBe(2);
    expect(buttons()).toEqual(['Test note', 'Notes off here', 'Remove output']);
  });

  it('calls back a port chosen, with its name, and a profile changed, field by field', () => {
    const { calls } = inspect();
    change(one('select') as HTMLSelectElement, 'out-2');
    expect(calls.port).toHaveBeenCalledWith({ id: 'out-2', name: 'Minilogue xd' });
    change(field('Drum map'), 'Novation Circuit');
    change(field('A channel per note'), true);
    expect(calls.profile.mock.calls.map((c) => c[0])).toEqual([{ drums: expect.objectContaining({ 36: 60 }) }, { mpe: { from: 2, to: 16 } }]);
  });

  it('clamps a number typed, as core keeps it, and shows what was kept', () => {
    const { calls } = inspect();
    const bend = field('Bend range');
    change(bend, '400');
    expect([calls.profile.mock.lastCall![0], bend.value]).toEqual([{ bend: 96 }, '96']);
    change(field('Latency'), '-5');
    expect(calls.profile.mock.lastCall![0]).toEqual({ latency: 0 });
    expect([clamp(NaN, 1, 16, 7), clamp(3.6, 1, 16, 7)]).toEqual([7, 4]);
  });

  it('a device not plugged in: kept in the list, said so, its test note and notes off disabled', () => {
    inspect({ output: { key: 'o1', id: 'out-9', name: 'TD-3' } });
    expect(all('option').map((o) => o.textContent)).toContain('TD-3 (not plugged in)');
    expect(one('.warn').textContent).toContain('Not plugged in');
    const disabled = all('button')
      .filter((b) => (b as HTMLButtonElement).disabled)
      .map((b) => b.textContent?.trim());
    expect(disabled).toEqual(['Test note', 'Notes off here']);
  });

  it('a slot with no device: no profile; its MPE channels when on; the last output not removable', () => {
    const { props } = inspect({ output: { key: 'o1', id: 'none', name: '' }, canRemove: false });
    expect(one('h3').textContent).toBe('No device');
    expect(all('label').some((l) => l.textContent?.includes('Bend range'))).toBe(false);
    expect((all('button').at(-1) as HTMLButtonElement).disabled).toBe(true);
    props.output = { key: 'o1', ...circuit };
    props.profile = { ...DEFAULT_PROFILE, mpe: { from: 2, to: 5 } };
    flushSync();
    expect([(one('[aria-label="First channel"]') as HTMLInputElement).value, (one('[aria-label="Last channel"]') as HTMLInputElement).value]).toEqual(['2', '5']);
  });
});

describe('the palette', () => {
  const sources = ['MidiStatus', 'DeviceInspector', 'ChannelMeter', 'ChannelPicker', 'PatchMatrix', 'SetupPicker'].map((name) => readFileSync(`src/ui/${name}.svelte`, 'utf8'));
  /** A component's palette, its root's selector left out. */
  const palette = (text: string) => /\/\* palette:[\s\S]*?\/\* end palette \*\//.exec(text)?.[0].replace(/\.wm-[a-z]+/g, '.root');

  it('is the same in every component', () => {
    const [first, ...rest] = sources.map(palette);
    expect(first).toBeDefined();
    for (const p of rest) expect(p).toBe(first);
  });

  it('uses no light-dark(): a bundler’s CSS minifier (Vite’s lightningcss) rewrites it into a polyfill that needs a color-scheme declared beside it', () => {
    for (const text of sources) expect(text).not.toMatch(/light-dark\(/);
  });
});

const circuit = { id: 'out-1', name: 'Circuit Tracks' };
const minilogue = { id: 'out-2', name: 'Minilogue xd' };
const keystep = { id: 'in-1', name: 'KeyStep 37' };

/** "Home": the Circuit (o1) and the Minilogue (o2), saved; the kit on the Circuit at 10, the lead on the Minilogue at 1. */
function home(): SetupBook {
  let book = renameSetup(newBook(), 's1', 'Home');
  book = chooseDevice(book, 'o1', circuit);
  book = addOutput(book, minilogue).book;
  book = withCrossing(book, 'piece:a', 'lead', 'o2', 1);
  book = withCrossing(book, 'piece:a', '*', 'o1', 10);
  return withProfile(overwrite(book), circuit.name, { drums: { 36: 60 } });
}

const ROWS: MatrixRow[] = [
  { id: 'lead', label: '&lead', kind: 'voice' },
  { id: 'pad', label: '&pad', kind: 'voice' },
  { id: '*', label: 'Kit', kind: 'kit', group: true },
  { id: 'bd', label: '&bd', kind: 'member', note: 36 },
  { id: 'sd', label: '&sd', kind: 'member', note: 38 },
  { id: 's5', label: 'Seat 5', kind: 'empty' },
];

/** The matrix over `book`, each change kept as the frontend would keep it. */
function matrix(book: SetupBook, over: Record<string, unknown> = {}) {
  const calls = { select: vi.fn() };
  const props = show(PatchMatrix, {
    book,
    context: 'piece:a',
    rows: ROWS,
    inputs: [keystep],
    outputs: [circuit, minilogue],
    heardBy: 'the keys',
    onchange: (next: SetupBook) => (props.book = next),
    onselect: calls.select,
    ...over,
  });
  return { props, calls };
}
const rowCells = (label: string) => {
  const row = all('tbody tr').find((r) => r.querySelector('th')?.textContent?.includes(label))!;
  return [...row.querySelectorAll('td')].map((td) => td.querySelector('input')?.value ?? (td.textContent!.trim() || '·'));
};
const jack = (label: string, out: string) => all('.jack').find((j) => j.getAttribute('aria-label')?.startsWith(`${label} to ${out}`)) as HTMLButtonElement;

describe('PatchMatrix', () => {
  it('draws the clock first, then the rows and the inputs down, the outputs across, each crossing its channel', () => {
    matrix(home());
    expect(all('thead .name').map((n) => n.textContent)).toEqual(['Circuit Tracks', 'Minilogue xd']);
    expect(all('tbody th .label').map((n) => n.textContent)).toEqual(['Clock', '&lead', '&pad', 'Kit', '&bd', '&sd', 'KeyStep 37']);
    expect(rowCells('&lead')).toEqual(['·', '1', '·']);
    expect(rowCells('Kit')).toEqual(['10', '·', '·']);
  });

  it('marks a kit on channel 10 "GM" only where the output’s drum map is General MIDI (yggi/webmidi#30)', () => {
    const book = withCrossing(home(), 'piece:a', '*', 'o2', 10);
    matrix(book);
    expect(rowCells('Kit')).toEqual(['10', '10GM', '·']);
  });

  it('shows a kit member’s note as each output’s drum map sends it, where the kit is routed', () => {
    matrix(home());
    expect([rowCells('&bd'), rowCells('&sd')]).toEqual([
      ['60', '·', '·'],
      ['38', '·', '·'],
    ]);
    expect((one('.note.mapped') as HTMLInputElement).value).toBe('60');
  });

  it('a member’s note typed changes the device’s drum map, clamped, and back to its own note drops the entry (yggi/webmidi#24)', () => {
    const { props } = matrix(home());
    change(all('input.note')[1] as HTMLInputElement, '62');
    expect(profileOf(props.book, 'Circuit Tracks').drums).toEqual({ 36: 60, 38: 62 });
    expect(activeSetup(props.book).name).toBe('Home');
    change(all('input.note')[1] as HTMLInputElement, '300');
    expect(profileOf(props.book, 'Circuit Tracks').drums[38]).toBe(127);
    change(all('input.note')[0] as HTMLInputElement, '36');
    expect(profileOf(props.book, 'Circuit Tracks').drums).toEqual({ 38: 127 });
  });

  it('a channel picked changes the book, as the named setup’s custom variant', () => {
    const { props } = matrix(home());
    jack('&pad', 'Circuit Tracks').click();
    flushSync();
    expect(one('[role=dialog]').getAttribute('aria-label')).toBe('Channel of &pad → Circuit Tracks');
    expect(all('[role=dialog] .busy').map((b) => b.textContent)).toEqual(['10']);
    expect(all('[role=dialog] button').some((b) => b.textContent?.includes('As played'))).toBe(false);
    click('7');
    expect([crossingOf(props.book, 'piece:a', 'pad', 'o1'), activeSetup(props.book).name]).toEqual([7, 'Home - custom']);
    expect(one('[role=dialog]')).toBeNull();
    jack('&pad', 'Circuit Tracks').click();
    flushSync();
    click('Not sent');
    expect(crossingOf(props.book, 'piece:a', 'pad', 'o1')).toBeUndefined();
  });

  it('an input’s row: As played, and what it plays (decision 003)', () => {
    const { props } = matrix(home(), { rows: ROWS.map((r) => (r.id === 'lead' ? { ...r, role: 'lead' } : r)) });
    jack('KeyStep 37', 'Minilogue xd').click();
    flushSync();
    click('= As played');
    expect(crossingOf(props.book, 'piece:a', inputRow(keystep), 'o2')).toBe(AS_PLAYED);
    expect(rowCells('KeyStep 37')).toEqual(['·', '=', '·']);
    const plays = () => one('select.plays') as HTMLSelectElement;
    expect([plays().value, [...plays().options].map((o) => o.textContent)]).toEqual(['none', ['Not heard', 'Default', '&lead', '&pad', 'Kit']]);
    change(plays(), 'lead');
    expect(activeSetup(props.book).plays).toEqual({ 'in:KeyStep 37': { row: 'lead', role: 'lead' } });
    change(plays(), 'default');
    expect(activeSetup(props.book).plays).toEqual({ 'in:KeyStep 37': 'default' });
    // every input's choice: an input follows it until it has its own
    props.book = withPlays(withPlays(props.book, 'in:*', 'default'), 'in:KeyStep 37', undefined);
    flushSync();
    expect(plays().value).toBe('');
    expect(plays().options[0]!.textContent).toBe('All: default');
    expect(rowCells('All inputs')).toEqual(['·', '·', '·']);
    change(plays(), 'none');
    expect(activeSetup(props.book).plays).toEqual({ 'in:*': 'default', 'in:KeyStep 37': 'none' });
  });

  it('offers an input only the rows it can play: a row the frontend says can’t be played isn’t offered, nor assigned by a preset', () => {
    const rows: MatrixRow[] = ROWS.map((r) => (r.id === 'pad' ? { ...r, playable: false } : r.kind === 'kit' ? { ...r, role: 'drums', playable: false } : r));
    const pads = { id: 'in-2', name: 'MPD218' };
    const { props } = matrix(home(), { rows, inputs: [keystep, pads], preset: DEFAULT_PRESET });
    const options = [...(all('select.plays')[0] as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(['Not heard', 'Default', '&lead']);
    expect(all('button').some((b) => b.textContent?.startsWith('Assign inputs'))).toBe(true);
    click('Assign inputs: Keyboard to lead, pads to drums');
    expect(activeSetup(props.book).plays).toEqual({});
  });

  it('assigns the inputs with no choice by a preset, from the rows’ roles; no button when there is none to fill', () => {
    const pads = { id: 'in-2', name: 'MPD218' };
    const roled: MatrixRow[] = ROWS.map((r) => (r.kind === 'kit' ? { ...r, role: 'drums' } : r));
    const { props } = matrix(home(), { rows: roled, inputs: [keystep, pads], preset: DEFAULT_PRESET });
    click('Assign inputs: Keyboard to lead, pads to drums');
    expect(activeSetup(props.book).plays).toEqual({ 'in:MPD218': { row: '*', role: 'drums' } });
    expect(all('button').some((b) => b.textContent?.startsWith('Assign inputs'))).toBe(true);
    props.book = withPlays(props.book, 'in:KeyStep 37', 'none');
    flushSync();
    expect(all('button').some((b) => b.textContent?.startsWith('Assign inputs'))).toBe(false);
  });

  it('the clock row sends clock to an output, and stops', () => {
    const { props } = matrix(home());
    jack('Clock', 'Minilogue xd').click();
    flushSync();
    expect([activeSetup(props.book).clock, rowCells('Clock')]).toEqual([['o2'], ['·', 'CLK', '·']]);
    jack('Clock', 'Minilogue xd').click();
    flushSync();
    expect(activeSetup(props.book).clock).toEqual([]);
  });

  it('empty rows wait behind a button', () => {
    matrix(home());
    expect(all('tbody th .label').some((l) => l.textContent === 'Seat 5')).toBe(false);
    click('Show 1 empty row');
    expect(all('tbody th .label').some((l) => l.textContent === 'Seat 5')).toBe(true);
  });

  it('adds an output plugged in that the setup lacks, selects it, and an output’s head selects it', () => {
    const mf = { id: 'out-3', name: 'MicroFreak' };
    const { props, calls } = matrix(home(), { outputs: [circuit, minilogue, mf] });
    click('+ Output');
    expect(activeSetup(props.book).outputs.map((o) => o.name)).toEqual(['Circuit Tracks', 'Minilogue xd', 'MicroFreak']);
    expect(calls.select).toHaveBeenLastCalledWith('o3');
    expect((all('button').find((b) => b.textContent === '+ Output') as HTMLButtonElement).disabled).toBe(true);
    (one('thead .col') as HTMLButtonElement).click();
    expect(calls.select).toHaveBeenLastCalledWith('o1');
  });

  it('locked (a piece routed by its cards): its rows shown, not pressed, no output to add; the inputs and the clock still the setup’s (yggi/webmidi#22)', () => {
    const { props } = matrix(home(), { locked: true });
    expect(rowCells('&lead')).toEqual(['·', '1']);
    expect([jack('&lead', 'Minilogue xd').tagName, jack('Kit', 'Circuit Tracks').tagName]).toEqual(['SPAN', 'SPAN']);
    expect(all('button').some((b) => b.textContent === '+ Output')).toBe(false);
    jack('KeyStep 37', 'Minilogue xd').click();
    flushSync();
    click('= As played');
    expect(crossingOf(props.book, 'piece:a', inputRow(keystep), 'o2')).toBe(AS_PLAYED);
    jack('Clock', 'Minilogue xd').click();
    flushSync();
    expect(activeSetup(props.book).clock).toEqual(['o2']);
  });

  it('marks an output not plugged in, and lists an input the routes send from that isn’t', () => {
    const book = withCrossing(home(), 'piece:a', 'in:Launchkey', 'o1', 3);
    matrix(book, { outputs: [circuit] });
    expect(all('thead .col.absent .name').map((n) => n.textContent)).toEqual(['Minilogue xd']);
    expect(inputRows([keystep], activeSetup(book).routes['piece:a']!).map((r) => [r.label, r.sub ?? ''])).toEqual([
      ['KeyStep 37', ''],
      ['Launchkey', 'not plugged in'],
    ]);
  });
});

describe('SetupPicker', () => {
  function picker(book: SetupBook, plugged = [circuit, minilogue]) {
    const exported = vi.fn();
    const props = show(SetupPicker, { book, plugged, onchange: (next: SetupBook) => (props.book = next), onexport: exported });
    return { props, exported };
  }
  const chips = () => all('.chip').map((c) => c.textContent!.replace(/\s+/g, ' ').trim());

  it('a chip per setup with how many of its devices are plugged in; one pressed is put in use', () => {
    const { props } = picker(saveAs(home(), 'Venue'), [circuit]);
    expect(chips()).toEqual(['Home 1/2', 'Venue 1/2']);
    (all('.chip')[0] as HTMLButtonElement).click();
    flushSync();
    expect(props.book.active).toBe('s1');
  });

  it('a change kept as the custom variant: Save… overwrites it, saves it as new, or discards it', () => {
    const changed = withCrossing(home(), 'piece:a', 'pad', 'o1', 3);
    const { props } = picker(changed);
    expect(chips()).toEqual(['Home 2/2', 'Home - custom ● 2/2']);
    expect((all('button').find((b) => b.textContent === 'Manage…') as HTMLButtonElement).disabled).toBe(true);
    click('Save…');
    click('Overwrite Home');
    expect([chips(), crossingOf(props.book, 'piece:a', 'pad', 'o1')]).toEqual([['Home 2/2'], 3]);
    props.book = changed;
    flushSync();
    click('Save…');
    change(one('[aria-label="Name of the new setup"]') as HTMLInputElement, 'Studio');
    one('[aria-label="Name of the new setup"]').dispatchEvent(new Event('input', { bubbles: true }));
    click('Save as new');
    expect(chips()).toEqual(['Home 2/2', 'Studio 2/2']);
    props.book = changed;
    flushSync();
    click('Save…');
    click('Discard changes');
    expect(chips()).toEqual(['Home 2/2']);
  });

  it('suggests a setup whose devices are all plugged in, when the one in use misses one', () => {
    let book = saveAs(home(), 'Venue');
    book = overwrite(chooseDevice(book, 'o2', { id: 'out-7', name: 'TD-3' }));
    const { props } = picker(book);
    expect(one('p.line').textContent).toContain('Every device of Home is plugged in.');
    click('Switch to it');
    expect(props.book.active).toBe('s1');
    expect(one('p.line')).toBeNull();
  });

  it('Manage… renames the setup in use, and removes it after asking; the last stays', () => {
    const { props } = picker(saveAs(home(), 'Venue'));
    click('Manage…');
    const name = one('[aria-label="Name of Venue"]') as HTMLInputElement;
    name.value = 'Stage';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    click('Rename');
    expect(chips()).toEqual(['Home 2/2', 'Stage 2/2']);
    click('Manage…');
    click('Remove…');
    click('Remove');
    expect(chips()).toEqual(['Home 2/2']);
    click('Manage…');
    expect((all('button').find((b) => b.textContent === 'Remove…') as HTMLButtonElement).disabled).toBe(true);
    void props;
  });

  it('exports the setup in use as a file, and says what is wrong with a file that isn’t one', async () => {
    const { exported } = picker(home());
    click('Export');
    const [text, filename] = exported.mock.calls[0]!;
    expect([JSON.parse(text).setup.name, filename]).toEqual(['Home', 'Home.midisetup.json']);
    const input = one('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['not json'], 'x.json')], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(one('[role=alert]')?.textContent).toMatch(/isn’t JSON/));
  });
});
