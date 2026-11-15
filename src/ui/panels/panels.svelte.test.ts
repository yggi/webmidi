// @vitest-environment jsdom
// The panel's play view and its widgets mounted in a DOM (jsdom): what a touch sends, what a message received moves.
import { existsSync, readFileSync } from 'node:fs';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_MIXER, EXAMPLE_PLAY, type Panel } from '../../core/panels/index';
import { drag, stepKey } from './drag';
import Keys from './Keys.svelte';
import PanelView from './PanelView.svelte';

let mounted: Record<string, unknown>[] = [];
afterEach(() => {
  for (const m of mounted) unmount(m);
  mounted = [];
  document.body.replaceChildren();
});

const one = <E extends Element = HTMLElement>(sel: string) => document.querySelector<E>(sel)!;
const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];

/** A panel being played, and every message it sent. */
function play(panel: Panel) {
  const sent: number[][] = [];
  const props = $state({ panel, onsend: (data: number[]) => void sent.push(data) });
  const view = mount(PanelView, { target: document.body, props }) as unknown as { receive(data: ArrayLike<number>): void; silence(): void };
  mounted.push(view as unknown as Record<string, unknown>);
  flushSync();
  return { sent, view, props };
}

const slider = (label: string, nth = 0) => all(`[role=slider][aria-label="${label}"]`)[nth]!;
const key = (el: Element, k: string, type = 'keydown') => {
  el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  flushSync();
};
/** A pointer event at a point (jsdom lays nothing out, so a test gives the control its box). */
const pointer = (el: Element, type: string, clientX = 0, clientY = 0, pointerId = 1) => {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }) as Event & { pointerId?: number });
  void pointerId;
  flushSync();
};
const boxed = (el: Element, width: number, height: number) => {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) });
  return el;
};

describe('PanelView: the mixer', () => {
  it('lays out its 8 strips and its own fader, each control a widget with its name and what it reads', () => {
    play(EXAMPLE_MIXER);
    expect(one('.title').textContent).toBe('DM-8 mixer');
    expect(all('.group h4').map((h) => h.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'FX']);
    expect([all('.ctl.knob').length, all('.ctl.fader').length, all('[role=switch]').length]).toEqual([16, 9, 8]);
    expect(all('.group')[2]!.querySelectorAll('.name').length).toBe(4);
    expect([slider('High', 2).getAttribute('aria-valuenow'), slider('High', 2).getAttribute('aria-valuetext')]).toEqual(['50', '64']);
    expect(one('.errors')).toBeNull();
  });

  it('sends what a key moves: a step of a knob, a fader to its top, a switch flipped', () => {
    const { sent } = play(EXAMPLE_MIXER);
    key(slider('High', 2), 'ArrowUp');
    key(slider('Main'), 'End');
    key(slider('Main'), 'End');
    (all('[role=switch]')[0] as HTMLButtonElement).click();
    flushSync();
    expect(sent).toEqual([
      [0xb0, 13, 65],
      [0xb0, 40, 127],
      [0xb0, 31, 127],
    ]);
    expect(all('[role=switch]')[0]!.getAttribute('aria-checked')).toBe('true');
    expect(slider('Main').getAttribute('aria-valuetext')).toBe('127');
    expect([stepKey('PageDown', 0.5), stepKey('Home', 0.5), stepKey('a', 0.5)]).toEqual([0.5 - 16 / 127, 0, null]);
  });

  it('a fader goes where it is pressed and follows the pointer; a knob turns up as it is dragged up, and rests on a double press', () => {
    const { sent } = play(EXAMPLE_MIXER);
    const main = boxed(slider('Main'), 44, 222);
    pointer(main, 'pointerdown', 20, 11);
    pointer(main, 'pointermove', 20, 211);
    pointer(main, 'pointerup', 20, 211);
    pointer(main, 'pointermove', 20, 11);
    const high = slider('High');
    pointer(high, 'pointerdown', 100, 100);
    pointer(high, 'pointermove', 100, 15);
    pointer(high, 'pointerup');
    high.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(sent).toEqual([
      [0xb0, 40, 127],
      [0xb0, 40, 0],
      [0xb0, 11, 127],
      [0xb0, 11, 64],
    ]);
  });

  it('is moved by what it receives, sends none of it back, and leaves a control that is held', () => {
    const { sent, view } = play(EXAMPLE_MIXER);
    view.receive([0xb0, 3, 127]);
    view.receive([0xb0, 33, 127]);
    flushSync();
    expect(slider('Level', 2).getAttribute('aria-valuenow')).toBe('100');
    expect(all('[role=switch]')[2]!.getAttribute('aria-checked')).toBe('true');
    const main = boxed(slider('Main'), 44, 222);
    pointer(main, 'pointerdown', 20, 211);
    view.receive([0xb0, 40, 100]);
    flushSync();
    expect(main.getAttribute('aria-valuenow')).toBe('0');
    pointer(main, 'pointerup');
    view.receive([0xb0, 40, 127]);
    flushSync();
    expect(main.getAttribute('aria-valuenow')).toBe('100');
    expect(sent).toEqual([[0xb0, 40, 0]]);
  });
});

describe('PanelView: every kind of control', () => {
  it('an XY pad sends both its values where it is pressed, y up; the arrows move one', () => {
    const { sent } = play(EXAMPLE_PLAY);
    const pad = boxed(slider('Filter'), 200, 200);
    pointer(pad, 'pointerdown', 200, 0);
    pointer(pad, 'pointerup');
    key(pad, 'ArrowLeft');
    expect(sent).toEqual([
      [0xb0, 74, 127],
      [0xb0, 71, 127],
      [0xb0, 74, 126],
    ]);
  });

  it('a button is on while it is held, by a pointer or a key; pads strike their notes on the channel they stand in', () => {
    const { sent } = play(EXAMPLE_PLAY);
    const accent = one<HTMLButtonElement>('button[aria-label="Accent"]');
    pointer(accent, 'pointerdown');
    expect(accent.getAttribute('aria-pressed')).toBe('true');
    pointer(accent, 'pointerup');
    key(accent, ' ');
    key(accent, ' ', 'keyup');
    const pad = one<HTMLButtonElement>('button[aria-label="Drums D2"]');
    pointer(pad, 'pointerdown');
    pointer(pad, 'pointerup');
    expect(sent).toEqual([
      [0x99, 45, 127],
      [0x89, 45, 0],
      [0x99, 45, 127],
      [0x89, 45, 0],
      [0x99, 38, 100],
      [0x89, 38, 0],
    ]);
  });

  it('the keyboard plays the key under the pointer, louder lower down, each key a slide crosses, and releases on the lift', () => {
    const { sent } = play(EXAMPLE_PLAY);
    const keys = boxed(one('.wm-keys'), 150, 100);
    // 15 white keys of 10 px: C3 at the foot, then across to D3; C♯3 near the top, soft
    pointer(keys, 'pointerdown', 5, 100);
    pointer(keys, 'pointermove', 15, 100);
    pointer(keys, 'pointerup', 15, 100);
    pointer(keys, 'pointerdown', 10, 0);
    pointer(keys, 'pointercancel');
    expect(sent).toEqual([
      [0x90, 48, 127],
      [0x80, 48, 0],
      [0x90, 50, 127],
      [0x80, 50, 0],
      [0x90, 49, 32],
      [0x80, 49, 0],
    ]);
    expect(all('.wm-keys .key').length).toBe(25);
  });

  it('releases every note it holds when it is taken off the page, and when its panel is replaced', () => {
    const { sent, props } = play(EXAMPLE_PLAY);
    key(one('button[aria-label="C4"]'), 'Enter');
    one<HTMLButtonElement>('[role=switch][aria-label="Hold"]').click();
    flushSync();
    props.panel = EXAMPLE_MIXER;
    flushSync();
    expect(sent).toEqual([
      [0x90, 60, 100],
      [0xb0, 64, 127],
      [0x80, 60, 0],
    ]);
    expect(one('.title').textContent).toBe('DM-8 mixer');
  });

  it('says what it couldn’t read, and plays the rest; fills the window where there is no full screen', async () => {
    const { sent } = play({
      id: 'p',
      name: 'P',
      children: [
        {
          type: 'knob',
          id: 'k',
          label: 'K',
          bind: [
            { kind: 'cc', number: 'oops' },
            { kind: 'cc', number: 9 },
          ],
        },
      ],
    });
    expect(one('.errors summary').textContent).toContain('1 thing in this panel couldn’t be read, and is left out');
    expect(one('.errors li').textContent).toBe('k: No name “oops” here. In scope: none.');
    key(slider('K'), 'End');
    expect(sent).toEqual([[0xb0, 9, 127]]);
    const fs = one<HTMLButtonElement>('.fs');
    fs.click();
    await vi.waitFor(() => expect(one('.wm-panel').classList.contains('filling')).toBe(true));
    flushSync();
    expect(fs.textContent).toBe('Exit full screen');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();
    expect(one('.wm-panel').classList.contains('filling')).toBe(false);
  });
});

describe('drag', () => {
  it('follows its own pointer until it lifts, is cancelled or is lost, once, and no other', () => {
    const el = document.body.appendChild(document.createElement('div'));
    const seen: string[] = [];
    const event = (type: string, pointerId: number) => Object.assign(new Event(type, { bubbles: true }), { pointerId });
    el.addEventListener('pointerdown', (e) => drag(e as PointerEvent, { move: () => seen.push('move'), end: () => seen.push('end') }), { once: true });
    el.dispatchEvent(event('pointerdown', 7));
    el.dispatchEvent(event('pointermove', 7));
    el.dispatchEvent(event('pointermove', 8));
    el.dispatchEvent(event('pointerup', 8));
    el.dispatchEvent(event('lostpointercapture', 7));
    el.dispatchEvent(event('pointerup', 7));
    el.dispatchEvent(event('pointermove', 7));
    expect(seen).toEqual(['move', 'end']);
  });
});

describe('Keys, on its own', () => {
  it('says what is struck and released, holds a key two fingers are on until the last lifts, and shows notes sounding elsewhere', () => {
    const heard: (string | number)[][] = [];
    const props = $state({
      low: 60,
      high: 72,
      lit: new Set([64]),
      onstrike: (n: number, v: number) => void heard.push(['on', n, v]),
      onunstrike: (n: number) => void heard.push(['off', n]),
    });
    mounted.push(mount(Keys, { target: document.body, props }));
    flushSync();
    expect(all('.key[aria-pressed=true]').map((k) => k.getAttribute('aria-label'))).toEqual(['E4']);
    const c = one('button[aria-label="C4"]');
    key(c, 'Enter');
    key(c, ' ');
    key(c, 'Enter', 'keyup');
    expect(heard).toEqual([
      ['on', 60, 100],
      ['on', 60, 100],
    ]);
    key(c, ' ', 'keyup');
    expect(heard.at(-1)).toEqual(['off', 60]);
  });
});

describe('@yggi/webmidi/ui/panels', () => {
  it('is an export of the package, its source and its declarations both there; the view and the keyboard carry the palette', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { exports: Record<string, Record<string, string>> };
    const entry = pkg.exports['./ui/panels']!;
    expect(entry).toEqual({ types: './types/ui/panels/index.d.ts', svelte: './src/ui/panels/index.ts', default: './src/ui/panels/index.ts' });
    expect(existsSync(entry.default!) && existsSync(entry.types!)).toBe(true);
    const palette = (name: string) => /\/\* palette:[\s\S]*?\/\* end palette \*\//.exec(readFileSync(`src/ui/${name}.svelte`, 'utf8'))?.[0].replace(/\.wm-[a-z]+/g, '.root');
    expect(palette('panels/PanelView')).toBe(palette('PatchMatrix'));
    expect(palette('panels/Keys')).toBe(palette('PatchMatrix'));
  });
});
