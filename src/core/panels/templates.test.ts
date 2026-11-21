import { describe, expect, it } from 'vitest';
import { nodeAt } from './edit';
import { EXAMPLE_MIXER, EXAMPLE_PLAY } from './examples';
import { instantiate } from './instantiate';
import { CONTROL_TYPES, isGroup, MAX_DEPTH, readPanel, type Control, type ControlType, type Group, type NodePath, type Panel, type PanelNode } from './model';
import { detachProblem, detachTemplate, extractTemplate, renameParam, renameParamProblem, renameTemplate, renameTemplateProblem, templateProblem } from './templates';

/** What plays: every instance but where it is defined (`source` is the place in the panel, which a template moves). */
const plays = (panel: Panel) =>
  JSON.parse(JSON.stringify({ children: instantiate(panel).children, errors: instantiate(panel).errors }, (k, v: unknown) => (k === 'source' ? undefined : v))) as unknown;

/** The places of the groups with children inline, in a panel and its templates. */
function groupPaths(panel: Panel): NodePath[] {
  const out: NodePath[] = [];
  const walk = (children: readonly PanelNode[], template: string | undefined, at: number[]) =>
    children.forEach((n, i) => {
      if (!isGroup(n) || n.use !== undefined) return;
      out.push({ ...(template === undefined ? {} : { template }), at: [...at, i] });
      walk(n.children ?? [], template, [...at, i]);
    });
  walk(panel.children, undefined, []);
  for (const [name, t] of Object.entries(panel.templates ?? {})) walk(t.children, name, []);
  return out;
}

/** A panel written is a panel read: the reader keeps all of it. */
const read = (panel: Panel) => expect(readPanel(panel)).toEqual(panel);

const BANKS: Panel = {
  id: 'banks',
  name: 'Banks',
  channel: 2,
  children: [
    {
      group: 'bank',
      label: 'Bank {n}',
      repeat: { name: 'n', from: 1, to: 3 },
      channel: 'n',
      overrides: { '3': { label: 'Last {n}' } },
      children: [
        { type: 'knob', id: 'a', label: 'A{n}', bind: [{ kind: 'cc', number: 'n * 8' }] },
        {
          group: 'sub',
          columns: 2,
          children: [
            { type: 'fader', id: 'f', bind: [{ kind: 'cc', number: 'n + 1', range: [0, '100 + n'], channel: 'n' }] },
            { group: 'pair', repeat: { name: 'm', from: 1, to: 'n' }, children: [{ type: 'knob', id: 'k', label: '{n}/{m}', bind: [{ kind: 'cc', number: 'n * 10 + m' }] }] },
          ],
        },
      ],
    },
  ],
};

describe('a group made a template', () => {
  it('takes its children and the names its scope gave them, and gives them back by `with`', () => {
    const made = extractTemplate(BANKS, { at: [0, 1] }, 'sub');
    expect(made.templates!.sub).toEqual({
      params: ['n'],
      columns: 2,
      children: ((BANKS.children[0] as Group).children![1] as Group).children,
    });
    expect(nodeAt(made, { at: [0, 1] })).toEqual({ group: 'sub', columns: 2, use: 'sub', with: { n: 'n' } });
    expect(plays(made)).toEqual(plays(BANKS));
    read(made);
  });

  it('a group of its own repeat keeps it, its channel, label and overrides; the repeat’s name is a parameter', () => {
    const made = extractTemplate(BANKS, { at: [0] }, 'bank');
    expect(made.templates!.bank!.params).toEqual(['n']);
    expect(nodeAt(made, { at: [0] })).toEqual({
      group: 'bank',
      label: 'Bank {n}',
      repeat: { name: 'n', from: 1, to: 3 },
      channel: 'n',
      overrides: { '3': { label: 'Last {n}' } },
      use: 'bank',
      with: { n: 'n' },
    });
    expect(plays(made)).toEqual(plays(BANKS));
    read(made);
  });

  it('a nested group’s own repeat is its own, not a parameter, but its bounds and its `with` read the scope', () => {
    const made = extractTemplate(BANKS, { at: [0] }, 'bank');
    expect(made.templates!.bank!.params).toEqual(['n']);
    const inside = extractTemplate(BANKS, { at: [0, 1] }, 'sub');
    expect(inside.templates!.sub!.params).toEqual(['n']);
    const row = extractTemplate(EXAMPLE_PLAY, { at: [2, 0] }, 'row');
    expect(row.templates!.row!.params).toEqual(['ch']);
    expect(extractTemplate(EXAMPLE_PLAY, { at: [2] }, 'half').templates!.half!.params).toEqual([]);
    expect(nodeAt(extractTemplate(EXAMPLE_PLAY, { at: [2] }, 'half'), { at: [2] })).not.toHaveProperty('with');
  });

  it('what plays is unchanged, at every group of the examples and of a panel with repeats, and a detach gives the panel back', () => {
    let cases = 0;
    for (const panel of [EXAMPLE_PLAY, BANKS, { ...EXAMPLE_MIXER, children: [{ group: 'wrap', children: EXAMPLE_MIXER.children }] }] as Panel[]) {
      for (const path of groupPaths(panel)) {
        const made = extractTemplate(panel, path, 'made');
        expect(made, JSON.stringify(path)).not.toBe(panel);
        expect(plays(made)).toEqual(plays(panel));
        read(made);
        const back = detachTemplate(made, path);
        expect(back).toEqual(panel);
        cases++;
      }
    }
    expect(cases).toBe(4 + 3 + 1);
  });

  it.each([...CONTROL_TYPES, 'group'] as const)('a %s inside it reads the group’s parameter, and plays the same after', (type) => {
    const inside: Record<ControlType | 'group', PanelNode> = {
      button: { type: 'button', id: 'x', label: 'B{k}', bind: [{ kind: 'note', number: 'k + 59', channel: 'k' }] },
      switch: { type: 'switch', id: 'x', bind: [{ kind: 'cc', number: 'k', range: ['k', '100 + k'] }] },
      knob: { type: 'knob', id: 'x', value: 0.5, bind: [{ kind: 'cc14', number: 'k + 1' }] },
      fader: { type: 'fader', id: 'x', bind: [{ kind: 'nrpn', number: 'k * 100' }] },
      xy: {
        type: 'xy',
        id: 'x',
        bind: [
          { kind: 'cc', number: 'k' },
          { kind: 'cc', number: 'k + 10', axis: 'y' },
        ],
      },
      label: { type: 'label', id: 'x', label: 'Ch {k}' },
      keyboard: { type: 'keyboard', id: 'x', low: 48, high: 50, label: '{k}' },
      pads: { type: 'pads', id: 'x', notes: [36, 38], label: 'P{k}' },
      group: {
        group: 'x',
        repeat: { name: 'j', from: 1, to: 'k' },
        label: '{k}.{j}',
        channel: 'k',
        overrides: { '1': { label: '{k}!' } },
        children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'k * 10 + j' }] }],
      },
    };
    const panel: Panel = {
      id: 'p',
      name: 'P',
      children: [
        { group: 'g', label: 'G{k}', repeat: { name: 'k', from: 1, to: 3 }, channel: 'k', columns: 2, children: [inside[type], { type: 'label', id: 'tail', label: 'end' }] },
      ],
    };
    const made = extractTemplate(panel, { at: [0] }, 'tpl');
    expect(made.templates!.tpl!.params).toEqual(['k']);
    expect(instantiate(made).errors).toEqual([]);
    expect(plays(made)).toEqual(plays(panel));
    read(made);
    expect(detachTemplate(made, { at: [0] })).toEqual(panel);
  });

  it('a group inside a template reads that template’s parameters, and the new template is given them', () => {
    const panel = extractTemplate(BANKS, { at: [0] }, 'bank');
    const inside = extractTemplate(panel, { template: 'bank', at: [1] }, 'sub');
    expect(inside.templates!.sub!.params).toEqual(['n']);
    expect(nodeAt(inside, { template: 'bank', at: [1] })).toMatchObject({ use: 'sub', with: { n: 'n' } });
    expect(plays(inside)).toEqual(plays(BANKS));
    read(inside);
  });

  it('is refused in words: a name the reader wouldn’t keep, one a template has, a group that uses a template, a control, no place', () => {
    expect(templateProblem(BANKS, { at: [0] }, '1bad')).toMatch(/starts with a letter/);
    expect(templateProblem(BANKS, { at: [0] }, '')).toMatch(/needs a name/);
    expect(templateProblem(BANKS, { at: [0] }, 'x'.repeat(33))).toMatch(/32/);
    expect(templateProblem(EXAMPLE_MIXER, { at: [0] }, 'strip')).toMatch(/already uses/);
    expect(templateProblem({ ...EXAMPLE_PLAY, templates: { t: { params: [], children: [] } } }, { at: [0] }, 't')).toMatch(/“t” is already a template/);
    expect(templateProblem(EXAMPLE_MIXER, { at: [1] }, 'f')).toMatch(/only a group/i);
    expect(templateProblem(BANKS, { at: [0] }, 'ok')).toBeUndefined();
    expect(templateProblem(BANKS, { at: [7] }, 'ok')).toBeUndefined();
    for (const [panel, path, name] of [
      [BANKS, { at: [0] }, '1bad'],
      [EXAMPLE_MIXER, { at: [0] }, 'strip'],
      [EXAMPLE_MIXER, { at: [1] }, 'f'],
      [BANKS, { at: [7] }, 'ok'],
      [BANKS, { template: 'none', at: [0] }, 'ok'],
    ] as const)
      expect(extractTemplate(panel, path, name)).toBe(panel);
  });

  it('is refused for a group that would make a template use itself', () => {
    const loop: Panel = {
      id: 'loop',
      name: 'Loop',
      templates: { a: { params: [], children: [{ group: 'in', children: [{ group: 'again', use: 'a' }] }] } },
      children: [],
    };
    expect(templateProblem(loop, { template: 'a', at: [0] }, 'b')).toMatch(/would use itself/);
    expect(extractTemplate(loop, { template: 'a', at: [0] }, 'b')).toBe(loop);
  });
});

describe('a group detached from its template', () => {
  it('the mixer’s strips hold the strip inline, and what plays over its 8 instances is the same', () => {
    const made = detachTemplate(EXAMPLE_MIXER, { at: [0] });
    expect(instantiate(made).controls).toHaveLength(33);
    expect(plays(made)).toEqual(plays(EXAMPLE_MIXER));
    expect(made.templates).toBeUndefined();
    expect(nodeAt(made, { at: [0] })).toEqual({
      group: 'strips',
      label: '{ch}',
      repeat: { name: 'ch', from: 1, to: 8 },
      columns: 1,
      overrides: { '8': { label: 'FX' } },
      children: EXAMPLE_MIXER.templates!.strip!.children,
    });
    read(made);
  });

  it('a mixer made a template again plays the same', () => {
    const made = extractTemplate(detachTemplate(EXAMPLE_MIXER, { at: [0] }), { at: [0] }, 'strip');
    expect(made.templates!.strip).toEqual(EXAMPLE_MIXER.templates!.strip);
    expect(plays(made)).toEqual(plays(EXAMPLE_MIXER));
    read(made);
  });

  const SUB: Panel = {
    id: 'sub',
    name: 'Sub',
    templates: {
      t: {
        params: ['a', 'b'],
        children: [
          { type: 'knob', id: 'x', label: '{a}-{b}', bind: [{ kind: 'cc', number: 'a + b' }] },
          { group: 'in', repeat: { name: 'a', from: 1, to: 'b' }, children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'a + b', range: ['a', 'max(b, 1)'] }] }] },
        ],
      },
    },
    children: [{ group: 'g', repeat: { name: 'k', from: 1, to: 3 }, use: 't', with: { a: 5, b: 'k * 2' } }],
  };

  it('substitutes each `with` value for its parameter, in parentheses where an expression needs them, and not under a repeat of the same name', () => {
    const made = detachTemplate(SUB, { at: [0] });
    const g = nodeAt(made, { at: [0] }) as Group;
    expect(g.children).toEqual([
      { type: 'knob', id: 'x', label: '{5}-{(k * 2)}', bind: [{ kind: 'cc', number: '5 + (k * 2)' }] },
      {
        group: 'in',
        repeat: { name: 'a', from: 1, to: '(k * 2)' },
        children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'a + (k * 2)', range: ['a', 'max((k * 2), 1)'] }] }],
      },
    ]);
    expect(g).not.toHaveProperty('use');
    expect(g).not.toHaveProperty('with');
    expect(instantiate(made).errors).toEqual([]);
    expect(plays(made)).toEqual(plays(SUB));
    expect(made.templates).toBeUndefined();
    read(made);
  });

  it('a negative number is written so it reads back, and a name for a name is a name', () => {
    const panel: Panel = {
      ...SUB,
      children: [{ group: 'g', repeat: { name: 'k', from: 1, to: 2 }, use: 't', with: { a: -1, b: 'k' } }],
    };
    const made = detachTemplate(panel, { at: [0] });
    expect((nodeAt(made, { at: [0, 0] }) as Control).bind![0]!.number).toBe('(-1) + k');
    expect(plays(made)).toEqual(plays(panel));
    read(made);
  });

  it('the template stays for the groups that still use it, and goes when none does', () => {
    const two: Panel = { ...SUB, children: [...SUB.children, { group: 'h', use: 't', with: { a: 1, b: 2 } }] };
    const first = detachTemplate(two, { at: [0] });
    expect(Object.keys(first.templates!)).toEqual(['t']);
    expect(plays(first)).toEqual(plays(two));
    const second = detachTemplate(first, { at: [1] });
    expect(second.templates).toBeUndefined();
    expect(plays(second)).toEqual(plays(two));
    read(first);
    read(second);
  });

  it('a template used by a group inside another template stays while that one uses it', () => {
    const nested: Panel = {
      ...SUB,
      templates: { ...SUB.templates, outer: { params: [], children: [{ group: 'deep', use: 't', with: { a: 1, b: 2 } }] } },
      children: [{ group: 'g', use: 't', with: { a: 5, b: 6 } }],
    };
    const made = detachTemplate(nested, { at: [0] });
    expect(Object.keys(made.templates!)).toEqual(['t', 'outer']);
  });

  it('a group inside a template is detached there, and the template it used stays for the groups that still use it', () => {
    const nested: Panel = {
      ...SUB,
      templates: { ...SUB.templates, outer: { params: ['q'], children: [{ group: 'deep', use: 't', with: { a: 'q', b: 'q + 1' } }] } },
      children: [
        { group: 'g', use: 'outer', with: { q: 3 } },
        { group: 'h', use: 't', with: { a: 1, b: 2 } },
      ],
    };
    const made = detachTemplate(nested, { template: 'outer', at: [0] });
    expect(made.templates!.outer!.children[0]).toMatchObject({ group: 'deep', children: [{ bind: [{ number: 'q + (q + 1)' }] }, { group: 'in' }] });
    expect(made.templates!.t).toBe(nested.templates!.t);
    expect(detachTemplate(made, { at: [1] }).templates!.t).toBeUndefined();
    expect(plays(made)).toEqual(plays(nested));
    read(made);
  });

  it('a nested group’s `with` is read too', () => {
    const panel: Panel = {
      id: 'p',
      name: 'P',
      templates: {
        leaf: { params: ['v'], children: [{ type: 'knob', id: 'k', bind: [{ kind: 'cc', number: 'v' }] }] },
        mid: { params: ['a'], children: [{ group: 'inner', use: 'leaf', with: { v: 'a + 1' }, channel: 'a' }] },
      },
      children: [{ group: 'g', use: 'mid', with: { a: 4 } }],
    };
    const made = detachTemplate(panel, { at: [0] });
    expect(nodeAt(made, { at: [0, 0] })).toEqual({ group: 'inner', use: 'leaf', with: { v: '4 + 1' }, channel: '4' });
    expect(plays(made)).toEqual(plays(panel));
    read(made);
  });

  it('is refused in words: no template used, no such template, a value it can’t keep exact, a parameter not given, a clash', () => {
    expect(detachProblem(BANKS, { at: [0] })).toMatch(/doesn’t use a template/);
    expect(detachProblem(BANKS, { at: [0, 0] })).toMatch(/only a group/i);
    expect(detachProblem({ ...EXAMPLE_MIXER, templates: {} }, { at: [0] })).toMatch(/no template “strip”/);
    const withs = (w: Record<string, number | string>): Panel => ({ ...SUB, children: [{ group: 'g', repeat: { name: 'k', from: 1, to: 3 }, use: 't', with: w }] });
    expect(detachProblem(withs({ a: 1 }), { at: [0] })).toMatch(/doesn’t give “b”/);
    expect(detachProblem(withs({ a: 1, b: 'k / 2' }), { at: [0] })).toMatch(/division/);
    expect(detachProblem(withs({ a: 1, b: 'k % 2' }), { at: [0] })).toMatch(/division/);
    expect(detachProblem(withs({ a: 1, b: 'nope' }), { at: [0] })).toMatch(/No name “nope”/);
    expect(detachProblem(withs({ a: 1.5e-9, b: 1 }), { at: [0] })).toMatch(/can’t be written/);
    expect(detachProblem(withs({ a: 1, b: 'k' }), { at: [0] })).toBeUndefined();
    const capture: Panel = {
      id: 'c',
      name: 'C',
      templates: {
        t: { params: ['a'], children: [{ group: 'in', repeat: { name: 'k', from: 1, to: 2 }, children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'a + k' }] }] }] },
      },
      children: [{ group: 'g', repeat: { name: 'k', from: 1, to: 2 }, use: 't', with: { a: 'k' } }],
    };
    expect(detachProblem(capture, { at: [0] })).toMatch(/“k” would mean the repeat inside/);
    for (const [panel, path] of [
      [BANKS, { at: [0] }],
      [withs({ a: 1 }), { at: [0] }],
      [capture, { at: [0] }],
      [SUB, { at: [9] }],
      [SUB, { template: 'none', at: [0] }],
    ] as const)
      expect(detachTemplate(panel, path)).toBe(panel);
  });

  it('is refused where the children would read deeper than MAX_DEPTH, and allowed one level up', () => {
    const chain = (levels: number): Panel => {
      let node: Group = { group: 'use', use: 'leaf' };
      for (let i = 0; i < levels; i++) node = { group: `w${i}`, children: [node] };
      return { id: 'deep', name: 'Deep', templates: { leaf: { params: [], children: [{ group: 'g', children: [] }] } }, children: [node] };
    };
    const at = (levels: number) => Array.from({ length: levels + 1 }, () => 0);
    expect(detachProblem(chain(MAX_DEPTH - 3), { at: at(MAX_DEPTH - 3) })).toBeUndefined();
    expect(detachProblem(chain(MAX_DEPTH - 2), { at: at(MAX_DEPTH - 2) })).toMatch(new RegExp(`at most ${MAX_DEPTH} deep`));
    const deep = chain(MAX_DEPTH - 2);
    expect(detachTemplate(deep, { at: at(MAX_DEPTH - 2) })).toBe(deep);
  });

  it('is refused for a group whose template would then use itself', () => {
    const loop: Panel = {
      id: 'loop',
      name: 'Loop',
      templates: { a: { params: [], children: [{ group: 'in', use: 'b' }] }, b: { params: [], children: [{ group: 'again', use: 'a' }] } },
      children: [],
    };
    expect(detachProblem(loop, { template: 'a', at: [0] })).toMatch(/would use itself/);
    expect(detachTemplate(loop, { template: 'a', at: [0] })).toBe(loop);
  });
});

describe('a template renamed', () => {
  it('every group that uses it follows, in the panel and in templates', () => {
    const panel: Panel = {
      ...EXAMPLE_MIXER,
      templates: { ...EXAMPLE_MIXER.templates, bank: { params: [], children: [{ group: 'again', use: 'strip', with: { ch: 1 } }] } },
      children: [...EXAMPLE_MIXER.children, { group: 'more', children: [{ group: 'deeper', use: 'strip', with: { ch: 2 } }] }],
    };
    const made = renameTemplate(panel, 'strip', 'channel');
    expect(Object.keys(made.templates!)).toEqual(['channel', 'bank']);
    expect(made.templates!.channel).toEqual(panel.templates!.strip);
    expect(nodeAt(made, { at: [0] })).toMatchObject({ use: 'channel' });
    expect(nodeAt(made, { at: [2, 0] })).toMatchObject({ use: 'channel' });
    expect(nodeAt(made, { template: 'bank', at: [0] })).toMatchObject({ use: 'channel' });
    expect(plays(made)).toEqual(plays(panel));
    expect(plays(renameTemplate(EXAMPLE_MIXER, 'strip', 'channel'))).toEqual(plays(EXAMPLE_MIXER));
    read(made);
  });

  it('is refused in words: none of that name, a name the reader wouldn’t keep, one taken', () => {
    const two: Panel = { ...EXAMPLE_MIXER, templates: { ...EXAMPLE_MIXER.templates, other: { params: [], children: [] } } };
    expect(renameTemplateProblem(two, 'nope', 'x')).toMatch(/no template “nope”/);
    expect(renameTemplateProblem(two, 'strip', '9')).toMatch(/starts with a letter/);
    expect(renameTemplateProblem(two, 'strip', 'other')).toMatch(/“other” is already a template/);
    expect(renameTemplateProblem(two, 'strip', 'strip')).toBeUndefined();
    expect(renameTemplateProblem(two, 'strip', 'fine')).toBeUndefined();
    for (const [from, to] of [
      ['nope', 'x'],
      ['strip', '9'],
      ['strip', 'other'],
      ['strip', 'strip'],
    ] as const)
      expect(renameTemplate(two, from, to)).toBe(two);
  });
});

describe('a parameter renamed', () => {
  it('every expression in the template and every `with` of its users follows', () => {
    const made = renameParam(EXAMPLE_MIXER, 'strip', 'ch', 'n');
    expect(made.templates!.strip!.params).toEqual(['n']);
    expect((made.templates!.strip!.children[0] as Control).bind![0]!.number).toBe('10 + n');
    expect((made.templates!.strip!.children[3] as Control).bind![0]!.number).toBe('n');
    expect(nodeAt(made, { at: [0] })).toMatchObject({ use: 'strip', with: { n: 'ch' }, label: '{ch}' });
    expect(plays(made)).toEqual(plays(EXAMPLE_MIXER));
    read(made);
  });

  it('reaches every place an expression stands, leaves a shadowing repeat’s own name and a function’s, and a name that is also a function’s', () => {
    const panel: Panel = {
      id: 'p',
      name: 'P',
      templates: {
        t: {
          params: ['max', 'b'],
          children: [
            { type: 'knob', id: 'x', label: '{max}/{b}', bind: [{ kind: 'cc', number: 'max + max(b, 1)', range: ['max', 'b'], channel: 'max' }] },
            {
              group: 'in',
              repeat: { name: 'max', from: 1, to: 'b' },
              channel: 'max',
              label: '{max}{b}',
              overrides: { '1': { label: '{b}' } },
              children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'max' }] }],
            },
            { group: 'call', use: 'u', with: { w: 'b + 1' }, repeat: { name: 'r', from: 'b', to: 'b' } },
          ],
        },
        u: { params: ['w'], children: [{ type: 'knob', id: 'z', bind: [{ kind: 'cc', number: 'w' }] }] },
      },
      children: [{ group: 'g', use: 't', with: { max: 1, b: 2 } }],
    };
    expect(instantiate(panel).errors).toEqual([]);
    const made = renameParam(panel, 't', 'max', 'top');
    expect(made.templates!.t!.params).toEqual(['top', 'b']);
    const [x, inGroup, call] = made.templates!.t!.children as [{ label: string; bind: { number: string; range: [string, string]; channel: string }[] }, Group, Group];
    expect(x.label).toBe('{top}/{b}');
    expect(x.bind[0]).toMatchObject({ number: 'top + max(b, 1)', range: ['top', 'b'], channel: 'top' });
    expect(inGroup).toMatchObject({ repeat: { name: 'max', from: 1, to: 'b' }, channel: 'max', label: '{max}{b}' });
    expect(call.with).toEqual({ w: 'b + 1' });
    expect(nodeAt(made, { at: [0] })).toMatchObject({ with: { top: 1, b: 2 } });
    expect(plays(made)).toEqual(plays(panel));
    read(made);
    const again = renameParam(panel, 't', 'b', 'bb');
    expect(call.with).toEqual({ w: 'b + 1' });
    expect((again.templates!.t!.children[2] as Group).with).toEqual({ w: 'bb + 1' });
    expect((again.templates!.t!.children[2] as Group).repeat).toEqual({ name: 'r', from: 'bb', to: 'bb' });
    expect(plays(again)).toEqual(plays(panel));
  });

  it('keeps the place of the `with` key and leaves a user that didn’t give it alone', () => {
    const panel: Panel = { ...EXAMPLE_MIXER, children: [...EXAMPLE_MIXER.children, { group: 'bare', use: 'strip' }] };
    const made = renameParam(panel, 'strip', 'ch', 'n');
    expect(nodeAt(made, { at: [2] })).toEqual({ group: 'bare', use: 'strip' });
    read(made);
  });

  it('is refused in words: no such template or parameter, a name the reader wouldn’t keep, one the template has, one it reads, one that would be a repeat’s', () => {
    expect(renameParamProblem(EXAMPLE_MIXER, 'nope', 'ch', 'n')).toMatch(/no template “nope”/);
    expect(renameParamProblem(EXAMPLE_MIXER, 'strip', 'zz', 'n')).toMatch(/no parameter “zz”/);
    expect(renameParamProblem(EXAMPLE_MIXER, 'strip', 'ch', '1n')).toMatch(/starts with a letter/);
    expect(renameParamProblem(EXAMPLE_MIXER, 'strip', 'ch', 'sin(')).toMatch(/starts with a letter/);
    expect(renameParamProblem(EXAMPLE_MIXER, 'strip', 'ch', 'ch')).toBeUndefined();
    const two: Panel = { ...EXAMPLE_MIXER, templates: { strip: { ...EXAMPLE_MIXER.templates!.strip!, params: ['ch', 'n'] } } };
    expect(renameParamProblem(two, 'strip', 'ch', 'n')).toMatch(/“n” is already a parameter of “strip”/);
    const reads: Panel = {
      id: 'r',
      name: 'R',
      templates: {
        t: {
          params: ['a'],
          children: [
            { type: 'knob', id: 'k', bind: [{ kind: 'cc', number: 'a + q' }] },
            { group: 'in', repeat: { name: 'z', from: 1, to: 2 }, children: [{ type: 'knob', id: 'y', bind: [{ kind: 'cc', number: 'a + z' }] }] },
          ],
        },
      },
      children: [],
    };
    expect(renameParamProblem(reads, 't', 'a', 'q')).toMatch(/“q” is already read/);
    expect(renameParamProblem(reads, 't', 'a', 'z')).toMatch(/“z” would mean the repeat inside/);
    expect(renameParamProblem(reads, 't', 'a', 'fine')).toBeUndefined();
    for (const [t, from, to] of [
      ['nope', 'ch', 'n'],
      ['strip', 'zz', 'n'],
      ['strip', 'ch', '1n'],
    ] as const)
      expect(renameParam(EXAMPLE_MIXER, t, from, to)).toBe(EXAMPLE_MIXER);
    expect(renameParam(reads, 't', 'a', 'q')).toBe(reads);
    expect(renameParam(reads, 't', 'a', 'z')).toBe(reads);
  });
});
