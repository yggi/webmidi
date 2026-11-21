// @vitest-environment jsdom
// The panel's play view and its widgets mounted in a DOM (jsdom): what a touch sends, what a message received moves.
import { existsSync, readFileSync } from 'node:fs';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_MIXER, EXAMPLE_PLAY, instantiate, type Panel } from '../../core/panels/index';
import { drag, stepKey } from './drag';
import Keys from './Keys.svelte';
import PanelEditor from './PanelEditor.svelte';
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

describe('PanelEditor', () => {
  /** A panel being edited, each change kept as a frontend would keep it. */
  function edit(panel: Panel, onsend?: (data: number[]) => void) {
    const props = $state({ panel, onchange: (next: Panel) => void (props.panel = next), onsend });
    mounted.push(mount(PanelEditor, { target: document.body, props }));
    flushSync();
    return props;
  }
  const press = (el: Element | undefined) => {
    (el as HTMLElement).click();
    flushSync();
  };
  const type = (el: Element, value: string) => {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
  };
  const button = (text: string) => all('.wm-editor button').find((b) => b.textContent?.trim() === text);
  const numbers = (panel: Panel, id: string) =>
    instantiate(panel)
      .controls.filter((c) => c.key.endsWith(`/${id}`))
      .map((c) => c.bindings[0]?.number);

  it('chooses a control by a press on any of its instances, marks them all, and a change to its binding changes them all', () => {
    const props = edit(EXAMPLE_MIXER);
    expect(one('.inspector .eyebrow').textContent).toBe('Panel');
    press(all('[aria-label="Edit High"]')[2]);
    expect(all('.ctl.picked').length).toBe(8);
    expect(one('.inspector .scope').textContent).toBe('One definition, drawn 8 times: a change here changes them all.');
    expect(one('.comes').textContent).toBe('cc 11 … 18, channel 1, sends 0 … 127, in 8 places');
    type(one('[aria-label="Number, or an expression"]'), '50 + ch * 2');
    expect(numbers(props.panel, 'high')).toEqual([52, 54, 56, 58, 60, 62, 64, 66]);
    expect(one('.comes').textContent).toBe('cc 52 … 66, channel 1, sends 0 … 127, in 8 places');
    // a control chosen is not played: nothing is a slider to move
    expect((one('.ctl.picked .widget') as HTMLElement & { inert: boolean }).inert).toBe(true);
  });

  it('says of an expression it can’t read that it isn’t resolved, keeps it as typed, and undoes and redoes', () => {
    const props = edit(EXAMPLE_MIXER);
    press(all('[aria-label="Edit Level"]')[0]);
    type(one('[aria-label="Number, or an expression"]'), 'chan');
    expect(one('.comes').textContent).toContain('Not resolved');
    expect(one('.errors summary').textContent).toContain('8 things in this panel couldn’t be read');
    press(button('Undo'));
    expect(numbers(props.panel, 'level')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    press(button('Redo'));
    expect(numbers(props.panel, 'level')).toEqual(Array.from({ length: 8 }, () => undefined));
    expect((button('Redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sets a binding’s kind, range and channel, adds one and removes one', () => {
    const props = edit(EXAMPLE_PLAY);
    press(one('[aria-label="Edit Mod"]'));
    type(one('[aria-label="What it speaks"]'), 'cc14');
    type(one('[aria-label="To"]'), '8000');
    type(one('[aria-label="Channel"]'), '3');
    const mod = () => instantiate(props.panel).controls.find((c) => c.key === 'wheels/mod')!.bindings;
    expect(mod()).toEqual([{ kind: 'cc14', channel: 2, number: 1, lo: 0, hi: 8000, axis: 'x' }]);
    press(button('Add a binding'));
    expect(mod().length).toBe(2);
    press(one('[aria-label="Remove binding 1"]'));
    expect(mod()).toEqual([{ kind: 'cc', channel: 0, number: 1, lo: 0, hi: 127, axis: 'x' }]);
  });

  it('adds into the panel, beside the control chosen and into the group chosen; a group repeats, and lays its children out', () => {
    const props = edit({ id: 'p', name: 'P', children: [] });
    press(button('Group'));
    expect(one('.inspector .eyebrow').textContent).toBe('Group');
    press(button('Fader'));
    press(button('Knob'));
    expect(props.panel.children).toMatchObject([{ group: 'group', children: [{ id: 'fader' }, { id: 'knob' }] }]);
    // (the knob is chosen now: the group is chosen again by its ground)
    press(one('section.group'));
    press(one('.inspector .switch'));
    type(one('[aria-label="Repeat to"]'), '3');
    type(all('.inspector select')[0]!, 'strip');
    expect(instantiate(props.panel).controls.map((c) => c.key)).toEqual(['group[1]/fader', 'group[1]/knob', 'group[2]/fader', 'group[2]/knob', 'group[3]/fader', 'group[3]/knob']);
    expect(all('.group.strip').length).toBe(3);
    press(all('[aria-label="Edit Knob"]')[1]);
    type(one('[aria-label="Number, or an expression"]'), '20 + ch');
    expect(one('.comes').textContent).toBe('cc 21 … 23, channel 1, sends 0 … 127, in 3 places');
  });

  it('moves, duplicates and deletes what is chosen; names the panel; and starts afresh on another panel', () => {
    const props = edit(EXAMPLE_PLAY);
    press(one('[aria-label="Edit Mod"]'));
    press(button('Earlier'));
    press(button('Duplicate'));
    const wheels = () => (props.panel.children[1] as unknown as { children: { id: string }[] }).children.map((c) => c.id);
    expect(wheels()).toEqual(['mod', 'mod2', 'bend']);
    press(button('Delete'));
    expect(wheels()).toEqual(['mod', 'bend']);
    expect(one('.inspector .eyebrow').textContent).toBe('Panel');
    type(all('.inspector input')[0]!, 'Stage');
    expect(props.panel.name).toBe('Stage');
    props.panel = EXAMPLE_MIXER;
    flushSync();
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says why a binding isn’t read, under the control, and not only that it isn’t', () => {
    edit(EXAMPLE_MIXER);
    press(all('[aria-label="Edit Level"]')[0]);
    type(one('[aria-label="Number, or an expression"]'), 'chan');
    expect(one('.comes').textContent).toContain('Not resolved');
    const why = all('.why li').map((li) => li.textContent);
    expect(why.length).toBe(1);
    expect(why[0]).toContain('chan');
    // a channel out of 1 to 16 is read, held to the one it inherits, and said
    type(one('[aria-label="Number, or an expression"]'), '1');
    type(one('[aria-label="Channel"]'), '99');
    expect(all('.why li').map((li) => li.textContent)).toEqual(['99 is no channel (1 to 16).']);
    type(one('[aria-label="Channel"]'), '5');
    expect(all('.why').length).toBe(0);
  });

  it('puts a field back to what the panel holds when its change isn’t taken', () => {
    const props = edit(EXAMPLE_MIXER);
    press(all('[aria-label="Edit Level"]')[0]);
    const field = one('[aria-label="Number, or an expression"]') as HTMLInputElement;
    const before = props.panel;
    type(field, '1+'.repeat(200));
    expect(props.panel).toBe(before);
    expect(field.value).toBe('ch');
    expect(one('.note').textContent).toContain('can’t be kept');
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses a name the reader would drop or a sibling has, says why beside the field, and puts the field back', () => {
    const props = edit(EXAMPLE_PLAY);
    press(one('[aria-label="Edit Mod"]'));
    const name = () => all('.inspector label.field input').find((i) => (i as HTMLInputElement).value === 'mod' || (i as HTMLInputElement).value === 'a/b c') as HTMLInputElement;
    const field = name();
    const before = props.panel;
    type(field, 'a/b c');
    expect(props.panel).toBe(before);
    expect(field.value).toBe('mod');
    expect(one('.note').textContent).toMatch(/letter|_/);
    type(field, 'bend');
    expect(props.panel).toBe(before);
    expect(one('.note').textContent).toBe('“bend” is already the name of a control beside it.');
    expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
    // a name taken clears the note, and so does choosing another control
    type(field, 'wheel_mod');
    expect(all('.note').length).toBe(0);
    expect(instantiate(props.panel).controls.some((c) => c.key === 'wheels/wheel_mod')).toBe(true);
    type(field, 'bend');
    press(one('[aria-label="Edit Bend"]'));
    expect(all('.note').length).toBe(0);
  });

  describe('a plain number field', () => {
    const input = (label: string) =>
      all('.inspector label.field')
        .find((l) => l.querySelector('span')?.firstChild?.textContent === label)!
        .querySelector('input')!;
    const find = (panel: Panel, id: string) => {
      const walk = (children: readonly { id?: string; children?: unknown }[]): Record<string, unknown> | undefined => {
        for (const n of children) {
          if (n.id === id) return n as Record<string, unknown>;
          const hit = n.children ? walk(n.children as never) : undefined;
          if (hit) return hit;
        }
      };
      return walk(panel.children as never)!;
    };
    /** A text refused: the panel is the one it was, the field is back, and the note says the range; a text taken follows. */
    function refuses(id: string, label: string, bad: string[], note: RegExp, held: string, good: string, kept: (c: Record<string, unknown>) => unknown, wanted: unknown) {
      const props = edit(EXAMPLE_PLAY);
      press(one(`[aria-label="Edit ${id === 'keys' ? 'Keys' : id === 'pads' ? 'Drums' : 'Mod'}"]`));
      const before = props.panel;
      for (const t of bad) {
        type(input(label), t);
        expect(props.panel, `${label} ${t}`).toBe(before);
        expect(input(label).value, `${label} ${t}`).toBe(held);
        expect(one('.note').textContent).toMatch(note);
      }
      expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
      type(input(label), good);
      expect(all('.note').length).toBe(0);
      expect(kept(find(props.panel, id))).toEqual(wanted);
    }
    it('Starts at: a word or a number over 1 is not taken (it was 0, or held to 1)', () => {
      refuses('mod', 'Starts at', ['abc', '7'], /0 to 1/, '', '0.25', (c) => c.value, 0.25);
    });
    it('Pad notes: a word among the notes is not taken (four pads stay four)', () => {
      refuses('pads', 'Notes', ['36, abc, 40', '36, 200'], /0 to 127/, '36, 38, 42, 46', '40 41', (c) => c.notes, [40, 41]);
    });
    it('Lowest and highest note: a word or a number over 127 is not taken', () => {
      refuses('keys', 'Lowest note', ['abc', '128'], /0 to 127/, '48', '40', (c) => c.low, 40);
      document.body.innerHTML = '';
      refuses('keys', 'Highest note', ['abc', '128'], /0 to 127/, '72', '80', (c) => c.high, 80);
    });
    it('Spans columns: a word or 0 or over the grid’s most is not taken', () => {
      refuses('mod', 'Spans columns', ['abc', '0', '65'], /1 to 64/, '', '2', (c) => (c.cell as { columns?: number } | undefined)?.columns, 2);
    });
    it('Spans rows: a word or 0 or over the grid’s most is not taken', () => {
      refuses('mod', 'Spans rows', ['abc', '0', '65'], /1 to 64/, '', '3', (c) => (c.cell as { rows?: number } | undefined)?.rows, 3);
    });
  });

  describe('try a control while editing', () => {
    it('shows no Try where the editor has nowhere to send, and is as it was: a press chooses', () => {
      edit(EXAMPLE_PLAY);
      expect(button('Try')).toBeUndefined();
      press(one('[aria-label="Edit Mod"]'));
      expect(one('.inspector .eyebrow').textContent).toBe('Control');
    });
    it('plays a control pressed while it is on, through onsend, and chooses nothing; off, a press chooses again', () => {
      const sent: number[][] = [];
      edit(EXAMPLE_PLAY, (data) => void sent.push(data));
      expect(button('Try')!.getAttribute('aria-pressed')).toBe('false');
      press(button('Try'));
      expect(button('Try')!.getAttribute('aria-pressed')).toBe('true');
      expect(all('[aria-label="Edit Mod"]')).toEqual([]);
      key(slider('Mod'), 'ArrowUp');
      expect(sent.length).toBe(1);
      expect(sent[0]!.slice(0, 2)).toEqual([0xb0, 1]);
      expect(one('.inspector .eyebrow').textContent).toBe('Panel');
      press(button('Try'));
      expect(button('Try')!.getAttribute('aria-pressed')).toBe('false');
      press(one('[aria-label="Edit Mod"]'));
      expect(one('.inspector .eyebrow').textContent).toBe('Control');
      expect(sent.length).toBe(1);
    });
    it('keeps what was chosen, and its inspector, while it is on: a press plays and doesn’t change the choice', () => {
      edit(EXAMPLE_PLAY, () => {});
      press(one('[aria-label="Edit Mod"]'));
      press(button('Try'));
      key(slider('Bend'), 'ArrowUp');
      expect(one('.inspector .eyebrow').textContent).toBe('Control');
      expect(all('.ctl.picked').length).toBe(1);
      expect((all('.inspector label.field input')[0] as HTMLInputElement).value).toBe('Mod');
    });
    it('releases every note held when it is turned off', () => {
      const sent: number[][] = [];
      edit(EXAMPLE_PLAY, (data) => void sent.push(data));
      press(button('Try'));
      key(one('button[aria-label="C4"]'), 'Enter');
      expect(sent).toEqual([[0x90, 60, 100]]);
      press(button('Try'));
      expect(sent).toEqual([
        [0x90, 60, 100],
        [0x80, 60, 0],
      ]);
    });
    it('plays what an edit has just changed: the panel it plays is the panel it holds', () => {
      const sent: number[][] = [];
      edit(EXAMPLE_PLAY, (data) => void sent.push(data));
      press(one('[aria-label="Edit Mod"]'));
      type(one('[aria-label="Number, or an expression"]'), '21');
      press(button('Try'));
      key(slider('Mod'), 'ArrowUp');
      expect(sent[0]!.slice(0, 2)).toEqual([0xb0, 21]);
    });
  });

  describe('what the stage may send: nothing while Try is off', () => {
    /** One control of every kind the stage draws, each with the ways of pressing it: a pointer, and the keys. */
    const EVERY: Panel = {
      id: 'every',
      name: 'Every',
      children: [
        { type: 'knob', id: 'k', label: 'K', bind: [{ kind: 'cc', number: 20 }] },
        { type: 'fader', id: 'f', label: 'F', bind: [{ kind: 'cc', number: 21 }] },
        {
          type: 'xy',
          id: 'xy',
          label: 'XY',
          bind: [
            { kind: 'cc', number: 22 },
            { kind: 'cc', number: 23, axis: 'y' },
          ],
        },
        { type: 'button', id: 'b', label: 'B', bind: [{ kind: 'cc', number: 24 }] },
        { type: 'switch', id: 's', label: 'S', bind: [{ kind: 'cc', number: 25 }] },
        { type: 'pads', id: 'p', label: 'P', notes: [36, 38] },
        { type: 'keyboard', id: 'kb', label: 'KB', low: 48, high: 60 },
      ],
    };
    /** Each kind's two ways: [kind, a pointer press (a drag), the keys]. */
    const WAYS: [string, () => void, () => void][] = [
      [
        'knob',
        () => {
          const el = slider('K');
          pointer(el, 'pointerdown', 0, 100);
          pointer(el, 'pointermove', 0, 20);
          pointer(el, 'pointerup');
        },
        () => (key(slider('K'), 'ArrowUp'), key(slider('K'), 'Home')),
      ],
      [
        'fader',
        () => {
          const el = boxed(slider('F'), 40, 200);
          pointer(el, 'pointerdown', 20, 20);
          pointer(el, 'pointermove', 20, 60);
          pointer(el, 'pointerup');
        },
        () => (key(slider('F'), 'ArrowUp'), key(slider('F'), 'End')),
      ],
      [
        'xy',
        () => {
          const el = boxed(slider('XY'), 200, 200);
          pointer(el, 'pointerdown', 100, 100);
          pointer(el, 'pointermove', 150, 50);
          pointer(el, 'pointerup');
        },
        () => (key(slider('XY'), 'ArrowLeft'), key(slider('XY'), 'End')),
      ],
      [
        'button',
        () => {
          const el = one('button[aria-label="B"]');
          pointer(el, 'pointerdown');
          pointer(el, 'pointerup');
        },
        () => {
          const el = one('button[aria-label="B"]');
          for (const k of ['Enter', ' ']) (key(el, k), key(el, k, 'keyup'));
        },
      ],
      [
        'switch',
        () => one<HTMLButtonElement>('[role=switch][aria-label="S"]').click(),
        // (a native button's Enter and Space come to a click: the keys and that click)
        () => {
          const el = one<HTMLButtonElement>('[role=switch][aria-label="S"]');
          for (const k of ['Enter', ' ']) (key(el, k), key(el, k, 'keyup'), el.click());
        },
      ],
      [
        'pads',
        () => {
          const el = one('button[aria-label="P C2"]');
          pointer(el, 'pointerdown');
          pointer(el, 'pointerup');
        },
        () => {
          const el = one('button[aria-label="P C2"]');
          for (const k of ['Enter', ' ']) (key(el, k), key(el, k, 'keyup'));
        },
      ],
      [
        'keys',
        () => {
          const el = boxed(one('.wm-keys'), 70, 100);
          pointer(el, 'pointerdown', 5, 100);
          pointer(el, 'pointermove', 15, 100);
          pointer(el, 'pointerup', 15, 100);
        },
        () => {
          const el = one('button[aria-label="C4"]');
          for (const k of ['Enter', ' ']) (key(el, k), key(el, k, 'keyup'));
        },
      ],
    ];

    for (const [kind, byPointer, byKeys] of WAYS) {
      it(`a ${kind}: with Try off no press, key or drag sends, and with Try on each does`, () => {
        const sent: number[][] = [];
        edit(EVERY, (data) => void sent.push(data));
        byPointer();
        byKeys();
        expect(sent).toEqual([]);
        press(button('Try'));
        byPointer();
        const byTouch = sent.length;
        expect(byTouch).toBeGreaterThan(0);
        byKeys();
        expect(sent.length).toBeGreaterThan(byTouch);
      });
    }

    it('sends nothing after Try is turned off in the middle of a drag, and the notes held are released once', () => {
      const sent: number[][] = [];
      edit(EVERY, (data) => void sent.push(data));
      press(button('Try'));
      const keys = boxed(one('.wm-keys'), 70, 100);
      pointer(keys, 'pointerdown', 5, 100);
      expect(sent).toEqual([[0x90, 48, 127]]);
      const fader = boxed(slider('F'), 40, 200);
      pointer(fader, 'pointerdown', 20, 20);
      const before = sent.length;
      press(button('Try'));
      expect(sent.slice(before)).toEqual([[0x80, 48, 0]]);
      pointer(keys, 'pointermove', 15, 100);
      pointer(fader, 'pointermove', 20, 100);
      pointer(keys, 'pointerup', 15, 100);
      pointer(fader, 'pointerup');
      expect(sent.slice(before)).toEqual([[0x80, 48, 0]]);
    });

    it('still chooses a control by Enter or Space with Try off, and sends nothing doing it', () => {
      const sent: number[][] = [];
      edit(EVERY, (data) => void sent.push(data));
      key(one('[aria-label="Edit KB"]'), 'Enter');
      expect(one('.inspector .eyebrow').textContent).toBe('Control');
      expect((all('.inspector label.field input')[0] as HTMLInputElement).value).toBe('KB');
      key(one('[aria-label="Edit B"]'), ' ');
      expect((all('.inspector label.field input')[0] as HTMLInputElement).value).toBe('B');
      expect(sent).toEqual([]);
    });
  });

  describe('move into a group or out of one', () => {
    const into = () => one<HTMLSelectElement>('select[aria-label="Move into"]');
    const choose = (name: string) => {
      const select = into();
      select.value = [...select.options].find((o) => o.textContent?.trim() === name)!.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
    };
    const idsIn = (panel: Panel, at: number[]) => {
      let nodes = panel.children as readonly { id?: string; group?: string; children?: unknown }[];
      for (const i of at) nodes = nodes[i]!.children as typeof nodes;
      return nodes.map((n) => n.id ?? n.group);
    };
    const kind = () => one('.inspector .eyebrow').textContent;
    const shortcut = (el: Element, k: string) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: true, bubbles: true, cancelable: true }));
      flushSync();
    };

    it('offers the groups a control can go into, by name, but the one it is in; and moves it, still chosen, as one step of Undo', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('[aria-label="Edit Mod"]'));
      expect([...into().options].map((o) => o.textContent?.trim())).toEqual(['Move into…', 'tone', 'play', 'play / row']);
      choose('tone');
      expect(idsIn(props.panel, [0])).toEqual(['filter', 'volume', 'detune', 'mod']);
      expect(idsIn(props.panel, [1])).toEqual(['bend']);
      expect(kind()).toBe('Control');
      expect((all('.inspector label.field input')[0] as HTMLInputElement).value).toBe('Mod');
      expect(all('.ctl.picked').length).toBe(1);
      // the choice is reset, and what is chosen can go out again; Undo takes it back in one step
      expect(into().value).toBe('');
      press(button('Move out'));
      expect(idsIn(props.panel, [])).toEqual(['tone', 'mod', 'wheels', 'play']);
      expect(kind()).toBe('Control');
      press(button('Undo'));
      expect(idsIn(props.panel, [0])).toEqual(['filter', 'volume', 'detune', 'mod']);
      press(button('Undo'));
      expect(props.panel).toEqual(EXAMPLE_PLAY);
      expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
    });
    it('moves a group into another, and Ctrl+Z undoes the move', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('section[aria-label="WHEELS"]'));
      expect(kind()).toBe('Group');
      choose('tone');
      expect(idsIn(props.panel, [])).toEqual(['tone', 'play']);
      expect(idsIn(props.panel, [0])).toEqual(['filter', 'volume', 'detune', 'wheels']);
      expect(kind()).toBe('Group');
      shortcut(one('.wm-editor'), 'z');
      expect(props.panel).toEqual(EXAMPLE_PLAY);
    });
    it('has no Move out at the top of the panel or of a template, and nothing to move into where there is no group', () => {
      edit(EXAMPLE_MIXER);
      press(one('[aria-label="Edit High"]'));
      expect(button('Move out')).toBeUndefined();
      expect(document.querySelector('select[aria-label="Move into"]')).toBeNull();
      press(one('[aria-label="Edit Main"]'));
      expect(button('Move out')).toBeUndefined();
      expect([...into().options].map((o) => o.textContent?.trim())).toEqual(['Move into…', 'strips (template strip)']);
    });
    it('moves a control from the panel into a template, so every strip gets it', () => {
      const props = edit(EXAMPLE_MIXER);
      press(one('[aria-label="Edit Main"]'));
      choose('strips (template strip)');
      expect(instantiate(props.panel).controls.length).toBe(40);
      expect(props.panel.templates!.strip!.children.map((c) => (c as { id: string }).id)).toEqual(['high', 'mid', 'mute', 'level', 'main']);
      expect(kind()).toBe('Control');
    });
    it('says why a move out is refused, at the control, and changes nothing', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('[aria-label="Edit Accent"]'));
      press(button('Move out'));
      expect(one('.note').textContent).toBe('It uses “ch”, which is not set in that place.');
      expect(props.panel).toEqual(EXAMPLE_PLAY);
      expect((button('Undo') as HTMLButtonElement).disabled).toBe(true);
      // another place chosen: the reason isn't carried there
      press(one('[aria-label="Edit Hold"]'));
      expect(document.querySelector('.note')).toBeNull();
    });
    it('offers a panel with no group nothing to move into', () => {
      edit({ id: 'p', name: 'P', children: [{ type: 'knob', id: 'k' }] });
      press(one('.ctl'));
      expect(kind()).toBe('Control');
      expect(document.querySelector('select[aria-label="Move into"]')).toBeNull();
    });
  });

  describe('the inspector as a sheet, on a phone', () => {
    // (the layout is the stylesheet's: below the container width where the columns stack, the inspector of what is chosen is docked to the bottom)
    const source = readFileSync('src/ui/panels/PanelEditor.svelte', 'utf8');
    it('names what is chosen and has a close control, which chooses nothing again and keeps focus in the editor', () => {
      edit(EXAMPLE_PLAY);
      expect(document.querySelector('.sheet-head')).toBeNull();
      press(one('[aria-label="Edit Mod"]'));
      expect(one('.sheet-head .what').textContent).toBe('Mod');
      expect(one('.inspector').classList.contains('sheet')).toBe(true);
      press(one('.sheet-head button[aria-label="Close"]'));
      expect(one('.inspector .eyebrow').textContent).toBe('Panel');
      expect(document.querySelector('.sheet-head')).toBeNull();
      expect(one('.inspector').classList.contains('sheet')).toBe(false);
      expect(document.activeElement).toBe(one('.wm-editor'));
      // a group is named by its name, a control with no label by its name or its kind
      press(one('section[aria-label="WHEELS"]'));
      expect(one('.sheet-head .what').textContent).toBe('wheels');
    });
    it('is a sheet only while something is chosen: the panel’s own fields stay where they are', () => {
      edit(EXAMPLE_PLAY);
      expect(one('.inspector').classList.contains('sheet')).toBe(false);
      expect(source).toMatch(/@container \(max-width: 760px\)[^]*\.inspector\.sheet \{[^}]*position: sticky;[^}]*bottom: 0;/);
    });
    it('is at most 40% of the viewport high (the bound is 60%), and its close control at least 44 px', () => {
      const height = [...source.matchAll(/max-height: (\d+)dvh/g)].map((m) => Number(m[1]));
      expect(height).toEqual([40]);
      expect(source).toMatch(/\.sheet-head \.close \{[^}]*min-height: 44px;[^}]*min-width: 44px;/);
    });
  });

  describe('undo, redo and the keyboard', () => {
    /** A key pressed on an element, with the modifiers; says whether the page's own default was left alone. */
    const shortcut = (el: Element, k: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) => {
      const e = new KeyboardEvent('keydown', { key: k, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, shiftKey: !!mods.shift, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      flushSync();
      return e.defaultPrevented;
    };
    const kind = () => one('.inspector .eyebrow').textContent;
    const wheels = (panel: Panel) => (panel.children[1] as unknown as { children: { id: string }[] }).children.map((c) => c.id);
    const labelField = () => all('.inspector label.field input')[0] as HTMLInputElement;

    it('Undo and Redo keep the control chosen when it is there in the panel they go to', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('[aria-label="Edit Mod"]'));
      type(labelField(), 'Depth');
      press(button('Undo'));
      expect(kind()).toBe('Control');
      expect(labelField().value).toBe('Mod');
      press(button('Redo'));
      expect(kind()).toBe('Control');
      expect(labelField().value).toBe('Depth');
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
    });
    it('Undo clears the choice when the place is gone from the panel it goes to, and so does Redo', () => {
      const props = edit(EXAMPLE_PLAY);
      press(button('Knob'));
      expect(kind()).toBe('Control');
      press(button('Undo'));
      expect(kind()).toBe('Panel');
      // Redo: a place the panel it goes to hasn't (Mod, removed in the step redone)
      press(one('[aria-label="Edit Mod"]'));
      press(button('Delete'));
      press(button('Undo'));
      press(one('[aria-label="Edit Mod"]'));
      expect(kind()).toBe('Control');
      press(button('Redo'));
      expect(wheels(props.panel)).toEqual(['bend']);
      expect(kind()).toBe('Panel');
    });
    it('Ctrl+Z undoes and Cmd+Z too, Ctrl+Shift+Z and Ctrl+Y redo, with focus on a control', () => {
      edit(EXAMPLE_PLAY);
      const first = one('[aria-label="Edit Mod"]');
      const mod = () => first;
      press(mod());
      type(labelField(), 'Depth');
      expect(shortcut(mod(), 'z', { ctrl: true })).toBe(true);
      expect(labelField().value).toBe('Mod');
      expect(shortcut(mod(), 'Z', { ctrl: true, shift: true })).toBe(true);
      expect(labelField().value).toBe('Depth');
      shortcut(mod(), 'z', { meta: true });
      expect(labelField().value).toBe('Mod');
      shortcut(mod(), 'y', { ctrl: true });
      expect(labelField().value).toBe('Depth');
      shortcut(mod(), 'z', { meta: true, shift: true });
      // (nothing to redo: the key is left to the page)
      expect(shortcut(mod(), 'z', { ctrl: true, shift: true })).toBe(false);
    });
    it('Delete and Backspace remove the control chosen, and neither does anything with none chosen', () => {
      const props = edit(EXAMPLE_PLAY);
      const mod = () => one('[aria-label="Edit Mod"]');
      expect(shortcut(mod(), 'Delete')).toBe(false);
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
      press(mod());
      expect(shortcut(mod(), 'Delete')).toBe(true);
      expect(wheels(props.panel)).toEqual(['bend']);
      expect(kind()).toBe('Panel');
      // (the control pressed is gone and took focus with it: focus stays in the editor, so Ctrl+Z works at once)
      expect(document.activeElement).toBe(one('.wm-editor'));
      shortcut(document.activeElement!, 'z', { ctrl: true });
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
      press(one('[aria-label="Edit Bend"]'));
      shortcut(one('[aria-label="Edit Bend"]'), 'Backspace');
      expect(wheels(props.panel)).toEqual(['mod']);
      press(button('Undo'));
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
    });
    it('leave a text field its own keys: no undo, redo or delete from inside one', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('[aria-label="Edit Mod"]'));
      type(labelField(), 'Depth');
      const before = props.panel;
      for (const k of ['Delete', 'Backspace']) expect(shortcut(labelField(), k), k).toBe(false);
      expect(shortcut(labelField(), 'z', { ctrl: true })).toBe(false);
      expect(shortcut(one('.inspector select'), 'Delete')).toBe(false);
      expect(props.panel).toBe(before);
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
    });
    it('does nothing for a key pressed outside the editor', () => {
      const props = edit(EXAMPLE_PLAY);
      press(one('[aria-label="Edit Mod"]'));
      expect(shortcut(document.body, 'Delete')).toBe(false);
      expect(wheels(props.panel)).toEqual(['bend', 'mod']);
    });
  });
});
