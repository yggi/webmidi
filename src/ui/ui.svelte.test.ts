// @vitest-environment jsdom
// The patchbay's components mounted in a DOM (jsdom): what each shows for the props it is given, and what it calls back.
import { readFileSync } from 'node:fs';
import { DRUM_PRESETS } from '../core/drum-presets';
import { DEFAULT_PRESET } from '../core/input-kinds';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeSetup,
  addOutput,
  AS_PLAYED,
  BUILT_IN,
  builtInHears,
  hasBuiltIn,
  withBuiltIn,
  chooseDevice,
  crossingOf,
  DEFAULT_PROFILE,
  inputRow,
  newBook,
  overwrite,
  panelKey,
  panelsOf,
  withPanelActive,
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
import DeviceDialog from './DeviceDialog.svelte';
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

describe('DeviceInspector, the port and the drums', () => {
  const base = { slot: 1, profile: { ...DEFAULT_PROFILE, drums: { 36: 60 } } as DeviceProfile, onport: () => {} };

  it('shows the port an output is now by its name, where its id changed on a replug; and the one the matrix gives it', () => {
    const ports = [
      { id: 'new-1', name: 'TD-3' },
      { id: 'new-2', name: 'TD-3' },
    ];
    const props = show(DeviceInspector, { ...base, output: { key: 'o1', id: 'old', name: 'TD-3' }, ports, onprofile: () => {} }) as Record<string, unknown>;
    expect(one<HTMLSelectElement>('select').value).toBe('new-1');
    expect(one('.warn')).toBeNull();
    props.port = ports[1];
    flushSync();
    expect(one<HTMLSelectElement>('select').value).toBe('new-2');
    props.port = null;
    flushSync();
    expect(one('.warn').textContent).toContain('Not plugged in');
  });

  it('sets each drum’s note on the device under its drum map, where it is given a kit’s members', () => {
    const onprofile = vi.fn();
    const members = [
      { label: 'kick', note: 36 },
      { label: 'snare', note: 38 },
    ];
    const props = show(DeviceInspector, { ...base, output: { key: 'o1', id: 'a', name: 'Circuit' }, ports: [{ id: 'a', name: 'Circuit' }], members, onprofile }) as Record<
      string,
      unknown
    >;
    const notes = () => all('input.note') as HTMLInputElement[];
    expect(notes().map((n) => n.value)).toEqual(['60', '38']);
    change(notes()[1]!, '62');
    expect(onprofile).toHaveBeenLastCalledWith({ drums: { 36: 60, 38: 62 } });
    change(notes()[0]!, '36');
    expect(onprofile).toHaveBeenLastCalledWith({ drums: {} });
    props.drums = false;
    flushSync();
    expect(notes()).toEqual([]);
  });
});

describe('DeviceDialog', () => {
  it('is the inspector as a dialog: Escape, its × and a press outside close it, and the focus returns to where it was', () => {
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    const onclose = vi.fn();
    show(DeviceDialog, {
      output: { key: 'o1', id: 'a', name: 'Circuit' },
      slot: 1,
      ports: [{ id: 'a', name: 'Circuit' }],
      profile: DEFAULT_PROFILE,
      onport: () => {},
      onprofile: () => {},
      onclose,
    });
    const box = one('[role=dialog]');
    expect([box.getAttribute('aria-modal'), box.getAttribute('aria-label'), document.activeElement === box]).toEqual(['true', 'Details of Circuit', true]);
    expect(one('[role=dialog] h3').textContent).toBe('Circuit');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    one<HTMLButtonElement>('.close').click();
    box.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onclose).toHaveBeenCalledTimes(2);
    one('.wm-dialog').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onclose).toHaveBeenCalledTimes(3);
    for (const m of mounted) unmount(m);
    mounted = [];
    flushSync();
    expect(document.activeElement).toBe(opener);
  });
});

describe('DeviceInspector, more', () => {
  it('tells apart ports plugged in under one name by their place, and forgets a device’s settings when asked', () => {
    const onforget = vi.fn();
    const twins = [
      { id: 'a', name: 'USB MIDI' },
      { id: 'b', name: 'USB MIDI' },
      { id: 'c', name: 'TD-3' },
    ];
    show(DeviceInspector, {
      output: { key: 'o1', ...twins[1]! },
      slot: 1,
      ports: twins,
      profile: DEFAULT_PROFILE,
      onport: () => {},
      onprofile: () => {},
      onforget,
    });
    expect([...one<HTMLSelectElement>('select').options].map((o) => o.textContent)).toEqual(['No device', 'USB MIDI (1)', 'USB MIDI (2)', 'TD-3']);
    click('Forget USB MIDI’s settings');
    expect(onforget).toHaveBeenCalledOnce();
  });
});

describe('the palette', () => {
  const sources = ['MidiStatus', 'DeviceInspector', 'DeviceDialog', 'ChannelMeter', 'ChannelPicker', 'PatchMatrix', 'SetupPicker'].map((name) =>
    readFileSync(`src/ui/${name}.svelte`, 'utf8'),
  );
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
const head = (name: string) => all('thead button.col').find((b) => b.querySelector('.name')?.textContent === name) as HTMLButtonElement;
const dialogField = (label: string) =>
  all('[role=dialog] label')
    .find((l) => l.textContent?.includes(label))!
    .querySelector('input, select') as HTMLInputElement;
const keydown = (key: string) => {
  one('[role=dialog]').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  flushSync();
};
const jack = (label: string, out: string) => all('.jack').find((j) => j.getAttribute('aria-label')?.startsWith(`${label} to ${out}`)) as HTMLButtonElement;

describe('PatchMatrix', () => {
  it('draws the clock first, then the rows and the inputs down, the outputs across, each crossing its channel', () => {
    matrix(home());
    expect(all('thead .name').map((n) => n.textContent)).toEqual(['Circuit Tracks', 'Minilogue xd']);
    // (a kit's members are no rows: each one's note on a device is in the device's details)
    expect(all('tbody th .label').map((n) => n.textContent)).toEqual(['Clock', '&lead', '&pad', 'Kit', 'KeyStep 37']);
    expect(rowCells('&lead')).toEqual(['·', '1']);
    expect(rowCells('Kit')).toEqual(['10', '·']);
  });

  it('draws two inputs plugged in under one name (Android names a device’s every port so) as one row, since the book keeps an input by its name', () => {
    const twin = { id: 'in-2', name: keystep.name };
    matrix(home(), { inputs: [keystep, twin] });
    expect(all('tbody th .label').map((n) => n.textContent)).toEqual(['Clock', '&lead', '&pad', 'Kit', 'KeyStep 37']);
    expect(rowCells('KeyStep 37')).toEqual(['·', '·']);
    expect(one('tbody tr:last-child .sub').textContent).toBe('IN');
    expect(all('tbody tr:last-child .sub').map((s) => s.textContent)).toEqual(['IN', '2 ports']);
  });

  it('says on an output’s head how its device takes a kit routed to it: its drum map, and nothing where no kit is (yggi/webmidi#30)', () => {
    const { props } = matrix(home());
    const heads = () => all('thead .facts').map((f) => f.textContent);
    expect(heads()).toEqual(['Custom drums', '']);
    props.book = withCrossing(withProfile(props.book, circuit.name, { drums: { ...DRUM_PRESETS['Novation Circuit'] } }), 'piece:a', '*', 'o2', 10);
    flushSync();
    expect(heads()).toEqual(['Novation Circuit', 'GM drums']);
    expect(rowCells('Kit')).toEqual(['10', '10']);
  });

  it('opens an output’s details in a dialog from its head, where the frontend doesn’t take the head itself: its port, its profile, its channels', () => {
    const test = vi.fn();
    const { props } = matrix(home(), { onselect: undefined, ontest: test });
    expect(one('[role=dialog]')).toBeNull();
    head('Minilogue xd').click();
    flushSync();
    expect(one('[role=dialog]').getAttribute('aria-label')).toBe('Details of Minilogue xd');
    expect([one('[role=dialog] h3').textContent, one<HTMLSelectElement>('[role=dialog] select').value]).toEqual(['Minilogue xd', 'out-2']);
    expect(all('[role=dialog] .cell.on').length).toBe(1);
    click('Test note');
    expect(test).toHaveBeenCalledWith('o2');
    expect(buttons()).not.toContain('Notes off here');
    change(dialogField('Bend range'), '12');
    expect([profileOf(props.book, 'Minilogue xd').bend, activeSetup(props.book).name]).toEqual([12, 'Home']);
    click('Forget Minilogue xd’s settings');
    expect(profileOf(props.book, 'Minilogue xd').bend).toBe(2);
    one<HTMLButtonElement>('[role=dialog] .close').click();
    flushSync();
    expect(one('[role=dialog]')).toBeNull();
  });

  it('sets each drum’s note on a device in its details, where a kit is routed to it, and nowhere in the matrix (yggi/webmidi#24)', () => {
    const { props } = matrix(home(), { onselect: undefined });
    expect(all('.wm-matrix input')).toEqual([]);
    head('Circuit Tracks').click();
    flushSync();
    const notes = () => all('[role=dialog] input.note') as HTMLInputElement[];
    expect(all('[role=dialog] .drum-name').map((n) => n.textContent)).toEqual(['&bd', '&sd']);
    expect(notes().map((n) => n.value)).toEqual(['60', '38']);
    expect(all('[role=dialog] .drum.mapped').length).toBe(1);
    change(notes()[1]!, '62');
    expect(profileOf(props.book, 'Circuit Tracks').drums).toEqual({ 36: 60, 38: 62 });
    expect(activeSetup(props.book).name).toBe('Home');
    change(notes()[1]!, '300');
    expect(profileOf(props.book, 'Circuit Tracks').drums[38]).toBe(127);
    change(notes()[0]!, '36');
    expect(profileOf(props.book, 'Circuit Tracks').drums).toEqual({ 38: 127 });
    // (no kit routed to the Minilogue: no drum map there)
    keydown('Escape');
    head('Minilogue xd').click();
    flushSync();
    expect(all('[role=dialog] input.note')).toEqual([]);
    expect(all('[role=dialog] label').some((l) => l.textContent?.includes('Drum map'))).toBe(false);
  });

  it('gives an output another port in its details, removes it there, and closes on Escape', () => {
    const mf = { id: 'out-3', name: 'MicroFreak' };
    const { props } = matrix(home(), { onselect: undefined, outputs: [circuit, minilogue, mf] });
    head('Minilogue xd').click();
    flushSync();
    change(one<HTMLSelectElement>('[role=dialog] select'), 'out-3');
    expect(activeSetup(props.book).outputs.map((o) => o.name)).toEqual(['Circuit Tracks', 'MicroFreak']);
    expect(crossingOf(props.book, 'piece:a', 'lead', 'o2')).toBe(1);
    keydown('Escape');
    expect(one('[role=dialog]')).toBeNull();
    head('MicroFreak').click();
    flushSync();
    click('Remove output');
    expect(one('[role=dialog]')).toBeNull();
    expect(activeSetup(props.book).outputs.map((o) => o.name)).toEqual(['Circuit Tracks']);
  });

  it('finds an output’s port by its name: a replug under another id is plugged in, and an id that is another device’s now is not', () => {
    // ports numbered by place: the Minilogue is now where the Circuit was, and the Circuit is unplugged
    matrix(home(), { onselect: undefined, outputs: [{ id: 'out-1', name: 'Minilogue xd' }] });
    expect(all('thead .col.absent .name').map((n) => n.textContent)).toEqual(['Circuit Tracks']);
    expect(all('.tray .dev')).toEqual([]);
    head('Minilogue xd').click();
    flushSync();
    expect(one<HTMLSelectElement>('[role=dialog] select').value).toBe('out-1');
    expect(one('[role=dialog] .warn')).toBeNull();
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

  it('the channel picker closes even when the frontend’s change throws', () => {
    matrix(home(), {
      onchange: () => {
        throw new Error('the frontend broke');
      },
    });
    const thrown: unknown[] = [];
    const caught = (e: ErrorEvent) => (thrown.push(e.error), e.preventDefault());
    window.addEventListener('error', caught);
    jack('&pad', 'Circuit Tracks').click();
    flushSync();
    click('7');
    window.removeEventListener('error', caught);
    expect(thrown).toEqual([new Error('the frontend broke')]);
    expect(one('[role=dialog]')).toBeNull();
  });

  it('removes an output from its head after asking; the last is left with no device, and then offers no ×', () => {
    const { props } = matrix(withCrossing(home(), 'piece:a', 'lead', 'o1', 2));
    const x = (n: number) => one<HTMLButtonElement>(`[aria-label^="Remove OUT ${n},"]`);
    x(2).click();
    flushSync();
    expect(one('[role=group]').getAttribute('aria-label')).toBe('Remove OUT 2?');
    click('Keep');
    expect(activeSetup(props.book).outputs.length).toBe(2);
    x(2).click();
    flushSync();
    click('Remove');
    expect(all('thead .name').map((n) => n.textContent)).toEqual(['Circuit Tracks']);
    expect(activeSetup(props.book).name).toBe('Home - custom');
    x(1).click();
    flushSync();
    click('Remove');
    expect(all('thead .name').map((n) => n.textContent)).toEqual(['No device']);
    expect(crossingOf(props.book, 'piece:a', 'lead', 'o1')).toBe(2);
    expect(one('[aria-label^="Remove OUT"]')).toBeNull();
  });

  it('pins an output’s × to its head, not to its column, which a wide matrix stretches', () => {
    matrix(home());
    const x = one<HTMLButtonElement>('[aria-label^="Remove OUT 1,"]');
    expect(x.parentElement!.classList.contains('pin')).toBe(true);
    expect(x.parentElement!.querySelector('button.col')?.textContent).toContain('Circuit Tracks');
  });

  it('draws the built-in first, toggled row by row, numbering the outputs that send MIDI from 1; members, the clock and inputs get none', () => {
    const { props } = matrix(withBuiltIn(home(), true, { 'piece:a': ['lead'] }), { builtIn: { label: 'Synth' } });
    expect(all('thead .slot').map((n) => n.textContent)).toEqual(['BUILT-IN', 'OUT 1', 'OUT 2']);
    expect(all('thead .name').map((n) => n.textContent)).toEqual(['Synth', 'Circuit Tracks', 'Minilogue xd']);
    expect([rowCells('&lead')[0], rowCells('&pad')[0], rowCells('Clock')[0], rowCells('KeyStep 37')[0]]).toEqual(['ON', '·', '—', 'not heard']);
    jack('&pad', 'Synth').click();
    flushSync();
    expect([builtInHears(props.book, 'piece:a', 'pad'), activeSetup(props.book).name]).toEqual([true, 'Home - custom']);
    jack('&lead', 'Synth').click();
    flushSync();
    expect(builtInHears(props.book, 'piece:a', 'lead')).toBe(false);
    expect(all('[role=dialog]')).toEqual([]);
  });

  it('says through which row an input plays on the built-in, and a row heard through another gets a dash', () => {
    const book = withPlays(withBuiltIn(home(), true), inputRow(keystep), { row: 'lead' });
    matrix(book, { builtIn: { label: 'Synth' }, rows: [...ROWS, { id: 'keys', label: 'Keys', kind: 'voice', builtIn: false }] });
    expect([rowCells('KeyStep 37')[0], rowCells('Keys')[0]]).toEqual(['as &lead', '—']);
  });

  it('adds the built-in hearing every row it can play, and removes it from its head like any output', () => {
    const { props } = matrix(home(), { builtIn: { label: 'Synth' } });
    click('+ Synth');
    expect(activeSetup(props.book).outputs[0]).toEqual(BUILT_IN);
    expect(['lead', 'pad', '*', 'bd'].map((r) => builtInHears(props.book, 'piece:a', r))).toEqual([true, true, true, false]);
    expect(buttons()).not.toContain('+ Synth');
    one<HTMLButtonElement>('[aria-label="Remove BUILT-IN, Synth"]').click();
    flushSync();
    click('Remove');
    expect(hasBuiltIn(activeSetup(props.book))).toBe(false);
  });

  it('shows the built-in’s crossings, unchanged, where the frontend edits them itself; and no column for a frontend without one', () => {
    const { props } = matrix(withBuiltIn(home(), true, { 'piece:a': ['lead'] }), { builtIn: { label: 'Sound', rows: false } });
    expect(jack('&lead', 'Sound').tagName).toBe('SPAN');
    expect(rowCells('&lead')[0]).toBe('ON');
    (props as Record<string, unknown>).builtIn = null;
    flushSync();
    expect(all('thead .slot').map((n) => n.textContent)).toEqual(['OUT 1', 'OUT 2']);
    expect(buttons()).not.toContain('+ Sound');
  });

  it('offers no × on a piece’s own outputs', () => {
    matrix(home(), { locked: true });
    expect(one('[aria-label^="Remove OUT"]')).toBeNull();
  });

  it('an input’s row: As played, and what it plays (decision 003)', () => {
    const { props } = matrix(home(), { rows: ROWS.map((r) => (r.id === 'lead' ? { ...r, role: 'lead' } : r)) });
    jack('KeyStep 37', 'Minilogue xd').click();
    flushSync();
    click('= As played');
    expect(crossingOf(props.book, 'piece:a', inputRow(keystep), 'o2')).toBe(AS_PLAYED);
    expect(rowCells('KeyStep 37')).toEqual(['·', '=']);
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
    expect(rowCells('All inputs')).toEqual(['·', '·']);
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
    expect([activeSetup(props.book).clock, rowCells('Clock')]).toEqual([['o2'], ['·', 'CLK']]);
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

  it('lists the devices plugged in that the setup has no output for, each a chip that adds it; an output’s head selects it for a frontend that takes it', () => {
    const mf = { id: 'out-3', name: 'MicroFreak' };
    const { props, calls } = matrix(home(), { outputs: [circuit, minilogue, mf] });
    expect(all('.tray .dev').map((b) => b.textContent)).toEqual(['+ MicroFreak']);
    click('+ MicroFreak');
    expect(activeSetup(props.book).outputs.map((o) => o.name)).toEqual(['Circuit Tracks', 'Minilogue xd', 'MicroFreak']);
    expect(calls.select).toHaveBeenLastCalledWith('o3');
    expect(one('.tray')).toBeNull();
    head('Circuit Tracks').click();
    expect(calls.select).toHaveBeenLastCalledWith('o1');
    expect(one('[role=dialog]')).toBeNull();
  });

  it('takes an output with nothing routed to it out at once, back among the devices to add; one with routes is asked about', () => {
    const mf = { id: 'out-3', name: 'MicroFreak' };
    const { props } = matrix(addOutput(home(), mf).book, { outputs: [circuit, minilogue, mf] });
    one<HTMLButtonElement>('[aria-label^="Remove OUT 3,"]').click();
    flushSync();
    expect(one('[role=group][aria-label^="Remove"]')).toBeNull();
    expect(activeSetup(props.book).outputs.map((o) => o.name)).toEqual(['Circuit Tracks', 'Minilogue xd']);
    expect(all('.tray .dev').map((b) => b.textContent)).toEqual(['+ MicroFreak']);
    one<HTMLButtonElement>('[aria-label^="Remove OUT 2,"]').click();
    flushSync();
    expect(one('[role=group][aria-label^="Remove"]').getAttribute('aria-label')).toBe('Remove OUT 2?');
  });

  it('draws no column for a slot with no device and no routes, says so, and fills it with the first device added; two ports of one name are told apart', () => {
    const twins = [
      { id: 'a', name: 'USB MIDI' },
      { id: 'b', name: 'USB MIDI' },
    ];
    const { props } = matrix(newBook(), { outputs: twins });
    expect(all('thead .col')).toEqual([]);
    expect(one('.nothing').textContent).toContain('No output in this setup yet: add a device plugged in, above.');
    expect(all('.tray .dev').map((b) => b.textContent)).toEqual(['+ USB MIDI (1)', '+ USB MIDI (2)']);
    click('+ USB MIDI (2)');
    expect(activeSetup(props.book).outputs).toEqual([{ key: 'o1', id: 'b', name: 'USB MIDI' }]);
    expect(all('thead .slot').map((n) => n.textContent)).toEqual(['OUT 1']);
    // (the other port of that name is still to add: one port serves one output)
    expect(all('.tray .dev').map((b) => b.textContent)).toEqual(['+ USB MIDI (1)']);
    expect(one('.nothing')).toBeNull();
    props.outputs = [];
    props.book = newBook();
    flushSync();
    expect(one('.nothing').textContent).toContain('no MIDI device plugged in');
  });

  it('draws the setup’s active panels as rows and columns, the library’s others as chips; a panel’s row is routed like an input’s, its column on or off (decision 007)', () => {
    const library = [
      { id: 'mixer', name: 'Mixer' },
      { id: 'play', name: 'Keys and pads' },
    ];
    const onpanel = vi.fn();
    const { props } = matrix(withPanelActive(home(), 'mixer', true), { panels: library, onpanel });
    expect(all('.tray .dev').map((b) => b.textContent)).toEqual(['+ Keys and pads']);
    expect(all('tbody th .label').map((n) => n.textContent)).toEqual(['Clock', '&lead', '&pad', 'Kit', 'Mixer', 'KeyStep 37']);
    expect(all('thead .slot').map((n) => n.textContent)).toEqual(['OUT 1', 'OUT 2', 'PANEL']);
    // its own column: a dash; a voice's row is the frontend's to send, so nothing; an input's row a jack
    expect([rowCells('Mixer'), rowCells('&lead'), rowCells('KeyStep 37'), rowCells('Clock')]).toEqual([
      ['·', '·', '—'],
      ['·', '1', '·'],
      ['·', '·', '·'],
      ['·', '·', '·'],
    ]);
    expect(jack('&lead', 'the panel Mixer')).toBeUndefined();
    jack('Mixer', 'Circuit Tracks').click();
    flushSync();
    click('= As played');
    jack('KeyStep 37', 'the panel Mixer').click();
    flushSync();
    expect([crossingOf(props.book, 'piece:a', panelKey('mixer'), 'o1'), crossingOf(props.book, 'piece:a', inputRow(keystep), panelKey('mixer'))]).toEqual([AS_PLAYED, AS_PLAYED]);
    expect(rowCells('KeyStep 37')).toEqual(['·', '·', 'ON']);
    (all('thead button.col').at(-1) as HTMLButtonElement).click();
    expect(onpanel).toHaveBeenCalledWith('mixer');
    click('+ Keys and pads');
    expect(panelsOf(activeSetup(props.book))).toEqual(['mixer', 'play']);
    // out at once with nothing routed; asked about with routes, which go with it
    one<HTMLButtonElement>('[aria-label="Remove the panel Keys and pads"]').click();
    flushSync();
    expect(panelsOf(activeSetup(props.book))).toEqual(['mixer']);
    one<HTMLButtonElement>('[aria-label="Remove the panel Mixer"]').click();
    flushSync();
    expect(one('[role=group][aria-label^="Remove"]').getAttribute('aria-label')).toBe('Remove the panel Mixer?');
    click('Remove');
    expect([panelsOf(activeSetup(props.book)), crossingOf(props.book, 'piece:a', inputRow(keystep), panelKey('mixer'))]).toEqual([[], undefined]);
  });

  it('says of an active panel the library lacks that it is missing, its crossings kept; a frontend with no panels draws none', () => {
    const book = withCrossing(withPanelActive(home(), 'gone', true), 'piece:a', panelKey('gone'), 'o1', 4);
    const { props } = matrix(book, { panels: [{ id: 'mixer', name: 'Mixer' }] });
    expect(
      all('tbody tr')
        .find((r) => r.textContent?.includes('gone'))!
        .querySelector('.sub:not(.in)')!.textContent,
    ).toBe('not in the library');
    expect(all('thead .col.absent .tag').map((t) => t.textContent)).toEqual(['Not in the library']);
    expect(rowCells('gone')).toEqual(['4', '·', '—']);
    props.book = home();
    (props as Record<string, unknown>).panels = undefined;
    flushSync();
    expect(all('.tray .dev.panel')).toEqual([]);
    expect(all('thead .slot').map((n) => n.textContent)).toEqual(['OUT 1', 'OUT 2']);
  });

  it('locked (a piece routed by its cards): its rows shown, not pressed, no output to add; the inputs and the clock still the setup’s (yggi/webmidi#22)', () => {
    const { props } = matrix(home(), { locked: true });
    expect(rowCells('&lead')).toEqual(['·', '1']);
    expect([jack('&lead', 'Minilogue xd').tagName, jack('Kit', 'Circuit Tracks').tagName]).toEqual(['SPAN', 'SPAN']);
    expect(one('.tray')).toBeNull();
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

  it('Manage… on a custom variant acts on its named setup: removed, the variant goes with it', () => {
    const { props } = picker(withCrossing(saveAs(home(), 'Venue'), 'piece:a', 'pad', 'o1', 3));
    expect(chips()).toEqual(['Home 2/2', 'Venue 2/2', 'Venue - custom ● 2/2']);
    click('Manage…');
    expect(one('[aria-label="Name of Venue"]')).not.toBeNull();
    click('Remove…');
    expect(one('.panel span:not(.grow)').textContent).toBe('Remove Venue and its changes?');
    click('Remove');
    expect([chips(), props.book.active]).toEqual([['Home 2/2'], 's1']);
  });

  it('Manage… renames the setup in use, and removes it after asking; the last leaves a blank one', () => {
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
    click('Remove…');
    expect(one('.panel span:not(.grow)').textContent).toBe('Remove Home? A blank setup takes its place.');
    click('Remove');
    expect(chips()).toEqual(['Setup 1 0/0']);
    expect(props.book.devices).toHaveProperty(['Circuit Tracks']);
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
