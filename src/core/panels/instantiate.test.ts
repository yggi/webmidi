import { describe, expect, it } from 'vitest';
import { instantiate, MAX_INSTANCES, type GroupInstance } from './instantiate';
import { EXAMPLE_MIXER as MIXER } from './examples';
import { panelRow, readPanel, type Panel, type PanelNode } from './model';

const panel = (children: readonly PanelNode[], rest: Partial<Panel> = {}): Panel => ({ id: 'p', name: 'P', children, ...rest });

describe('instantiate: the mixer', () => {
  const made = instantiate(MIXER);

  it('is 8 strips of one template and a fader of its own: 33 controls, nothing unresolved', () => {
    expect(made.errors).toEqual([]);
    expect(made.truncated).toBe(false);
    expect(made.children.map((n) => n.key)).toEqual(['strips[1]', 'strips[2]', 'strips[3]', 'strips[4]', 'strips[5]', 'strips[6]', 'strips[7]', 'strips[8]', 'main']);
    expect(made.controls).toHaveLength(33);
    expect((made.children[2] as GroupInstance).children.map((c) => c.key)).toEqual(['strips[3]/high', 'strips[3]/mid', 'strips[3]/mute', 'strips[3]/level']);
  });

  it('gives each control of each strip its controller: High 11 … 18, Mid 21 … 28, Mute 31 … 38, Level 1 … 8', () => {
    const numbers = (id: string) => made.controls.filter((c) => c.key.endsWith(`/${id}`)).map((c) => c.bindings[0]!.number);
    expect(numbers('high')).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(numbers('mid')).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
    expect(numbers('mute')).toEqual([31, 32, 33, 34, 35, 36, 37, 38]);
    expect(numbers('level')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(made.controls.at(-1)!.bindings).toEqual([{ kind: 'cc', channel: 0, number: 40, lo: 0, hi: 127, axis: 'x' }]);
  });

  it("labels each strip by its channel, one by its override, and takes the template's columns", () => {
    expect(made.children.map((n) => n.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'FX', 'Main']);
    expect((made.children[0] as GroupInstance).columns).toBe(1);
  });

  it('follows an edit to the one strip in all eight', () => {
    const strip = MIXER.templates!.strip!;
    const edited: Panel = {
      ...MIXER,
      templates: { strip: { ...strip, children: strip.children.map((c) => ('id' in c && c.id === 'high' ? { ...c, bind: [{ kind: 'cc', number: '50 + ch * 2' }] } : c)) } },
    };
    expect(
      instantiate(edited)
        .controls.filter((c) => c.key.endsWith('/high'))
        .map((c) => c.bindings[0]!.number),
    ).toEqual([52, 54, 56, 58, 60, 62, 64, 66]);
  });

  it('is the same read back from its JSON', () => {
    expect(instantiate(readPanel(JSON.parse(JSON.stringify(MIXER)))!)).toEqual(made);
    expect(panelRow(MIXER.id)).toBe('panel:mixer');
  });
});

describe('instantiate', () => {
  it('nests groups inline, their children in the scope they stand in, keyed by id or by place', () => {
    const made = instantiate(
      panel([
        {
          group: 'bank',
          repeat: { name: 'b', from: 0, to: 1 },
          children: [
            {
              group: 'row',
              repeat: { name: 'i', from: 1, to: 2 },
              children: [{ type: 'button', label: 'Pad {b * 2 + i}', bind: [{ kind: 'note', number: '36 + b * 2 + i - 1' }] }],
            },
          ],
        },
      ]),
    );
    expect(made.errors).toEqual([]);
    expect(made.controls.map((c) => [c.key, c.label, c.bindings[0]!.number])).toEqual([
      ['bank[0]/row[1]/#1', 'Pad 1', 36],
      ['bank[0]/row[2]/#1', 'Pad 2', 37],
      ['bank[1]/row[1]/#1', 'Pad 3', 38],
      ['bank[1]/row[2]/#1', 'Pad 4', 39],
    ]);
  });

  it("takes the channel from the binding, else the group, else the panel, else 1; and each kind's whole range", () => {
    const made = instantiate(
      panel(
        [
          { type: 'knob', id: 'a', bind: [{ kind: 'bend' }, { kind: 'cc14', number: 1, channel: 16 }, { kind: 'program', range: [0, 9] }] },
          {
            group: 'g',
            channel: 'c + 1',
            repeat: { name: 'c', from: 4, to: 4 },
            children: [{ type: 'xy', id: 'b', bind: [{ kind: 'nrpn', number: 300, axis: 'y', range: [16383, 0] }] }],
          },
        ],
        { channel: 3 },
      ),
    );
    expect(made.errors).toEqual([]);
    expect(made.controls[0]!.bindings).toEqual([
      { kind: 'bend', channel: 2, number: 0, lo: 0, hi: 16383, axis: 'x' },
      { kind: 'cc14', channel: 15, number: 1, lo: 0, hi: 16383, axis: 'x' },
      { kind: 'program', channel: 2, number: 0, lo: 0, hi: 9, axis: 'x' },
    ]);
    expect(made.controls[1]!.bindings).toEqual([{ kind: 'nrpn', channel: 4, number: 300, lo: 16383, hi: 0, axis: 'y' }]);
    expect(instantiate(panel([{ type: 'knob', bind: [{ kind: 'cc', number: 7 }] }])).controls[0]!.bindings[0]!.channel).toBe(0);
  });

  it('gives a keyboard its notes from low to high and a pads its own, on the channel they stand in', () => {
    const made = instantiate(
      panel([{ type: 'keyboard', low: 60, high: 62 }, { type: 'keyboard' }, { type: 'pads', notes: [36, 38] }, { type: 'pads' }, { type: 'label', label: 'Mix' }], { channel: 10 }),
    );
    expect(made.controls.map((c) => c.notes)).toEqual([[60, 61, 62], Array.from({ length: 25 }, (_, i) => 48 + i), [36, 38], [36, 38, 42, 46], []]);
    expect(made.controls[2]!.channel).toBe(9);
  });

  it('leaves out what it can’t resolve, binding by binding, and says where and why', () => {
    const made = instantiate(
      panel([
        {
          type: 'knob',
          id: 'a',
          label: 'Ch {nope}',
          bind: [{ kind: 'cc', number: 'chan + 1' }, { kind: 'cc', number: 7 }, { kind: 'cc' }, { kind: 'cc', number: 200 }, { kind: 'cc14', number: 40 }],
        },
        { type: 'knob', id: 'a' },
        { type: 'knob', id: 'b', bind: [{ kind: 'cc', number: 1, channel: 17 }] },
        { group: 'g', use: 'nothing' },
        { group: 'h', use: 'needs' },
        { group: 'h', children: [] },
        { group: 'r', repeat: { name: 'i', from: 'oops', to: 2 }, children: [] },
      ]),
    );
    expect(made.controls.map((c) => c.key)).toEqual(['a', 'b']);
    expect(made.controls[0]!.bindings.map((b) => b.number)).toEqual([7]);
    expect(made.controls[0]!.label).toBe('Ch {nope}');
    expect(made.controls[1]!.bindings[0]!.channel).toBe(0);
    expect(made.errors).toEqual([
      'a: No name “nope” here. In scope: none.',
      'a: No name “chan” here. In scope: none.',
      'a: a cc binding needs a number.',
      'a: 200 is no cc number (0 to 127).',
      'a: 40 is no cc14 number (0 to 31).',
      'a: two controls under one id; the second is left out.',
      'b: 17 is no channel (1 to 16).',
      'g: there is no template “nothing”.',
      'h: there is no template “needs”.',
      'h: two groups under one name; the second is left out.',
      'r: No name “oops” here. In scope: none.',
    ]);
  });

  it("a template sees its parameters alone, each of which a group must give; one that uses itself isn't followed", () => {
    const templates = {
      t: { params: ['n'], children: [{ type: 'knob', id: 'k', bind: [{ kind: 'cc', number: 'n + outer' }] }] },
      loop: { params: [], children: [{ group: 'again', use: 'loop' }] },
    } as const;
    const made = instantiate(
      panel(
        [
          { group: 'o', repeat: { name: 'outer', from: 1, to: 1 }, children: [{ group: 'a', use: 't', with: { n: 'outer + 1' } }] },
          { group: 'b', use: 't' },
          { group: 'c', use: 'loop' },
        ],
        { templates },
      ),
    );
    expect(made.errors).toEqual(['o[1]/a/k: No name “outer” here. In scope: n.', 'b: the template “t” needs “n”.', 'c/again: the template “loop” uses itself.']);
    expect(made.controls.map((c) => [c.key, c.bindings.length])).toEqual([['o[1]/a/k', 0]]);
  });

  it(`stops at ${MAX_INSTANCES} controls and groups, and says so once`, () => {
    const made = instantiate(panel([{ group: 'g', repeat: { name: 'i', from: 1, to: 1e9 }, children: [{ type: 'knob' }, { type: 'knob' }] }]));
    expect(made.truncated).toBe(true);
    expect(made.controls.length + made.children.length).toBe(MAX_INSTANCES);
    expect(made.errors).toEqual([`P: more than ${MAX_INSTANCES} controls and groups; the rest is left out.`]);
    expect(instantiate(panel([{ group: 'g', repeat: { name: 'i', from: 5, to: 1 }, children: [{ type: 'knob' }] }])).children).toEqual([]);
  });
});
