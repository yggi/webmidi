// @vitest-environment jsdom
// The patchbay's components mounted in a DOM (jsdom): what each shows for the props it is given, and what it calls back.
import { readFileSync } from 'node:fs';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE, type DeviceProfile } from '../core/setups';
import ChannelMeter from './ChannelMeter.svelte';
import DeviceInspector from './DeviceInspector.svelte';
import MidiStatus from './MidiStatus.svelte';
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
  const sources = ['MidiStatus', 'DeviceInspector', 'ChannelMeter'].map((name) => readFileSync(`src/ui/${name}.svelte`, 'utf8'));
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
