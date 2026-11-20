import { describe, expect, it } from 'vitest';
import {
  childrenAt,
  containerOf,
  duplicateNode,
  insertNode,
  moveNode,
  moveOutOf,
  moveProblem,
  moveTargets,
  nameProblem,
  newControl,
  newGroup,
  numberProblem,
  nodeAt,
  ofKind,
  removeNode,
  samePath,
  updateNode,
} from './edit';
import { EXAMPLE_MIXER, EXAMPLE_PLAY } from './examples';
import { instantiate } from './instantiate';
import { CONTROL_TYPES, isGroup, MAX_DEPTH, MAX_GRID, readPanel, type Control, type NodePath, type Panel, type PanelNode } from './model';

const ids = (panel: Panel, path = { at: [] as number[] }) => childrenAt(panel, path)!.map((n) => (isGroup(n) ? n.group : n.id));

describe('a place in a panel', () => {
  it('each instance says where it is defined: the 8 strips’ faders are one place in the template, the main fader one in the panel', () => {
    const made = instantiate(EXAMPLE_MIXER);
    const levels = made.controls.filter((c) => c.key.endsWith('/level'));
    expect(levels.map((c) => c.source)).toEqual(Array.from({ length: 8 }, () => ({ template: 'strip', at: [3] })));
    expect(made.controls.at(-1)!.source).toEqual({ at: [1] });
    expect(made.children[0]!.source).toEqual({ at: [0] });
    expect((nodeAt(EXAMPLE_MIXER, levels[0]!.source) as Control).label).toBe('Level');
    expect(instantiate(EXAMPLE_PLAY).controls.find((c) => c.key === 'play/row[10]/accent')!.source).toEqual({ at: [2, 0, 1] });
  });

  it('finds a node, its children and where they are kept: a group’s own, or its template’s', () => {
    expect(nodeAt(EXAMPLE_PLAY, { at: [0, 0] })).toMatchObject({ type: 'xy', id: 'filter' });
    expect([
      nodeAt(EXAMPLE_PLAY, { at: [] }),
      nodeAt(EXAMPLE_PLAY, { at: [9] }),
      nodeAt(EXAMPLE_PLAY, { at: [0, 0, 0] }),
      nodeAt(EXAMPLE_PLAY, { template: 'none', at: [0] }),
    ]).toEqual([undefined, undefined, undefined, undefined]);
    expect(containerOf(EXAMPLE_PLAY, { at: [1] })).toEqual({ at: [1] });
    expect(containerOf(EXAMPLE_MIXER, { at: [0] })).toEqual({ template: 'strip', at: [] });
    expect([containerOf(EXAMPLE_MIXER, { at: [1] }), containerOf(EXAMPLE_MIXER, { template: 'none', at: [] })]).toEqual([undefined, undefined]);
    expect(ids(EXAMPLE_MIXER, { template: 'strip', at: [] } as never)).toEqual(['high', 'mid', 'mute', 'level']);
    expect(childrenAt(EXAMPLE_MIXER, { at: [0] })).toBeUndefined();
    expect([samePath({ at: [1] }, { at: [1] }), samePath({ at: [1] }, { template: 't', at: [1] }), samePath({ at: [1] }, { at: [1, 0] }), samePath(null, { at: [] })]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('a panel edited', () => {
  it('a change to the one strip is a change to all eight; the panel given is left as it was', () => {
    const edited = updateNode(EXAMPLE_MIXER, { template: 'strip', at: [0] }, (n) => ({ ...n, bind: [{ kind: 'cc', number: '50 + ch' }] }));
    expect(
      instantiate(edited)
        .controls.filter((c) => c.key.endsWith('/high'))
        .map((c) => c.bindings[0]!.number),
    ).toEqual([51, 52, 53, 54, 55, 56, 57, 58]);
    expect((nodeAt(EXAMPLE_MIXER, { template: 'strip', at: [0] }) as Control).bind).toEqual([{ kind: 'cc', number: '10 + ch' }]);
    expect(updateNode(EXAMPLE_MIXER, { at: [7] }, (n) => n)).toBe(EXAMPLE_MIXER);
  });

  it('adds into a group, and into the template of a group that uses one, so every strip gets it; removes, moves and duplicates', () => {
    const container = containerOf(EXAMPLE_MIXER, { at: [0] })!;
    const pan = newControl(EXAMPLE_MIXER, 'knob', childrenAt(EXAMPLE_MIXER, container)!);
    expect(pan).toEqual({ type: 'knob', id: 'knob', label: 'Knob', bind: [{ kind: 'cc', number: 1 }] });
    const added = insertNode(EXAMPLE_MIXER, container, pan, 2);
    expect(added.path).toEqual({ template: 'strip', at: [2] });
    expect(instantiate(added.panel).controls).toHaveLength(41);
    expect(ids(added.panel, container as never)).toEqual(['high', 'mid', 'knob', 'mute', 'level']);
    const later = moveNode(added.panel, added.path, 1);
    expect([ids(later.panel, container as never), later.path.at]).toEqual([['high', 'mid', 'mute', 'knob', 'level'], [3]]);
    expect(moveNode(EXAMPLE_MIXER, { at: [0] }, -1)).toEqual({ panel: EXAMPLE_MIXER, path: { at: [0] } });
    const twice = duplicateNode(EXAMPLE_PLAY, { at: [1, 1] });
    expect([ids(twice.panel, { at: [1] }), twice.path.at]).toEqual([
      ['bend', 'mod', 'mod2'],
      [1, 2],
    ]);
    expect(ids(duplicateNode(EXAMPLE_PLAY, { at: [1] }).panel)).toEqual(['tone', 'wheels', 'wheels2', 'play']);
    expect(ids(removeNode(EXAMPLE_PLAY, { at: [1] }))).toEqual(['tone', 'play']);
    expect(removeNode(EXAMPLE_PLAY, { at: [5] })).toBe(EXAMPLE_PLAY);
    expect(insertNode(EXAMPLE_PLAY, { at: [0, 0] }, pan).panel).toBe(EXAMPLE_PLAY);
  });

  it('a new control of each type is named after it and does something at once; a new group is empty', () => {
    const empty: Panel = { id: 'p', name: 'P', children: [] };
    let panel = empty;
    for (const type of CONTROL_TYPES) panel = insertNode(panel, { at: [] }, newControl(panel, type, panel.children)).panel;
    panel = insertNode(panel, { at: [] }, newControl(panel, 'knob', panel.children)).panel;
    panel = insertNode(panel, { at: [] }, newGroup(panel.children)).panel;
    panel = insertNode(panel, { at: [] }, newGroup(panel.children)).panel;
    expect(ids(panel)).toEqual(['button', 'switch', 'knob', 'fader', 'xy', 'label', 'keyboard', 'pads', 'knob2', 'group', 'group2']);
    const made = instantiate(panel);
    expect(made.errors).toEqual([]);
    expect(made.controls.map((c) => c.bindings.map((b) => `${b.kind} ${b.number}${b.axis === 'y' ? ' y' : ''}`))).toEqual([
      ['note 60'],
      ['cc 1'],
      ['cc 2'],
      ['cc 3'],
      ['cc 4', 'cc 5 y'],
      [],
      [],
      [],
      ['cc 6'],
    ]);
    // (every edit here is a panel the reader keeps as it is)
    expect(readPanel(JSON.parse(JSON.stringify(panel)))).toEqual(panel);
  });

  it('a binding of another kind keeps its number where the kind has one, and takes the kind’s whole range', () => {
    expect(ofKind({ kind: 'cc', number: '10 + ch', range: [0, 100], channel: 2 }, 'note')).toEqual({ kind: 'note', number: '10 + ch', channel: 2 });
    expect(ofKind({ kind: 'cc', number: 7, axis: 'y' }, 'bend')).toEqual({ kind: 'bend', axis: 'y' });
    expect(ofKind({ kind: 'bend' }, 'nrpn')).toEqual({ kind: 'nrpn', number: 1 });
  });
});

describe('a name asked for', () => {
  // (EXAMPLE_PLAY's top level: group "tone", group "wheels", group "play"; wheels holds the controls "bend" and "mod")
  const mod = { at: [1, 1] };
  it('is a problem in words when it isn’t a name the reader keeps: it would be dropped, and the control lose its key', () => {
    for (const wanted of ['a/b c', 'has space', '1st', 'é', 'a-b', 'x'.repeat(33)]) expect(nameProblem(EXAMPLE_PLAY, mod, wanted), wanted).toMatch(/letter|_/);
    for (const wanted of ['volume', '_x', 'A1_b', 'x'.repeat(32)]) expect(nameProblem(EXAMPLE_PLAY, mod, wanted), wanted).toBeUndefined();
  });
  it('is a problem when a sibling, a control or a group, already has it; its own name is no problem', () => {
    expect(nameProblem(EXAMPLE_PLAY, mod, 'bend')).toBe('“bend” is already the name of a control beside it.');
    expect(nameProblem(EXAMPLE_PLAY, mod, 'mod')).toBeUndefined();
    expect(nameProblem(EXAMPLE_PLAY, { at: [2] }, 'tone')).toBe('“tone” is already the name of a group beside it.');
    // (a control and a group share one key space: two under one name leave the second out)
    expect(nameProblem(EXAMPLE_PLAY, { at: [2] }, 'wheels')).toMatch(/already the name of a group/);
  });
  it('may be empty for a control (it is then kept by its place) and not for a group', () => {
    expect(nameProblem(EXAMPLE_PLAY, mod, '')).toBeUndefined();
    expect(nameProblem(EXAMPLE_PLAY, { at: [1] }, '')).toBe('A group needs a name.');
  });
  it('is judged among the siblings in a template, the same for every group that uses it', () => {
    const strip = { template: 'strip', at: [0] };
    const siblings = childrenAt(EXAMPLE_MIXER, { template: 'strip', at: [] })!.map((n) => (isGroup(n) ? n.group : n.id));
    const other = siblings.find((n, i) => i !== 0 && n)!;
    expect(nameProblem(EXAMPLE_MIXER, strip, other)).toMatch(/already the name/);
  });
  it('is no problem for a place that isn’t there', () => {
    expect(nameProblem(EXAMPLE_PLAY, { at: [9] }, 'x')).toBeUndefined();
  });
});

describe('a number typed into a plain field', () => {
  // each field's own range, both sides of each boundary: what is outside is a problem in words, what is inside none
  const cases: [Parameters<typeof numberProblem>[0], string[], string[]][] = [
    ['start', ['0', '1', '0.5', '.25', '1.0', ' 0.5 ', ''], ['abc', '7', '-0.1', '1.01', '2', '1e0', '0,5', 'NaN', '0x1']],
    ['note', ['0', '127', '60', ''], ['128', '-1', '60.5', 'abc', '1e1', ' x']],
    ['notes', ['36', '36, 38 40', '0,127', ''], ['36, abc, 40', '128', '36, -1', '1.5', 'abc']],
    ['span', ['1', '64', '3', ''], ['0', '65', '2.5', 'abc', '-1']],
  ];
  for (const [field, good, bad] of cases) {
    it(`${field}: takes what is in range and gives a problem in words for the rest`, () => {
      for (const t of good) expect(numberProblem(field, t), `${field} ${JSON.stringify(t)}`).toBeUndefined();
      for (const t of bad) expect(numberProblem(field, t), `${field} ${JSON.stringify(t)}`).toMatch(/^[A-Z].*\.$/);
    });
  }
  it('names the range in its words', () => {
    expect(numberProblem('start', 'abc')).toBe('Starts at takes a number from 0 to 1.');
    expect(numberProblem('note', '128')).toBe('A note is a whole number from 0 to 127.');
    expect(numberProblem('notes', 'abc')).toBe('Notes are whole numbers from 0 to 127, separated by commas or spaces.');
    expect(numberProblem('span', '65')).toBe('A span is a whole number from 1 to 64.');
  });
  it('takes a span up to the most a grid has (the reader’s own bound), over every whole number either side', () => {
    for (let n = 0; n <= MAX_GRID + 6; n++) expect(numberProblem('span', String(n)) === undefined, String(n)).toBe(n >= 1 && n <= MAX_GRID);
    for (let n = -2; n <= 130; n++) expect(numberProblem('note', String(n)) === undefined, String(n)).toBe(n >= 0 && n <= 127);
  });
});

/** Every place in a panel, the panel's and each template's, in order. */
function everyPlace(panel: Panel): NodePath[] {
  const out: NodePath[] = [];
  const walk = (template: string | undefined, children: readonly PanelNode[], at: number[]) =>
    children.forEach((n, i) => {
      out.push({ ...(template === undefined ? {} : { template }), at: [...at, i] });
      if (isGroup(n) && n.use === undefined) walk(template, n.children ?? [], [...at, i]);
    });
  walk(undefined, panel.children, []);
  for (const [name, t] of Object.entries(panel.templates ?? {})) walk(name, t.children, []);
  return out;
}

describe('a node moved into a group or out of one', () => {
  // a group "a" (empty), then one control of each type and a group "mover", then a group "b" holding one control "inside"
  const kinds: PanelNode[] = [...CONTROL_TYPES.map((type): PanelNode => ({ type, id: type })), { group: 'mover', children: [{ type: 'label', id: 'deep' }] }];
  const sample: Panel = {
    id: 'm',
    name: 'M',
    children: [{ group: 'a', children: [] }, ...kinds, { group: 'b', children: [{ type: 'knob', id: 'inside' }] }],
  };
  const nameOf = (n: PanelNode) => (isGroup(n) ? n.group : n.id);

  for (const [i, kind] of kinds.entries()) {
    it(`a ${isGroup(kind) ? 'group' : kind.type} goes into a group and back out, one step each way, after the group it left`, () => {
      const from = { at: [1 + i] };
      const into = moveNode(sample, from, { container: { at: [0] }, index: 0 });
      expect(ids(into.panel, { at: [0] })).toEqual([nameOf(kind)]);
      expect(ids(into.panel)).not.toContain(nameOf(kind));
      expect(into.path).toEqual({ at: [0, 0] });
      expect(nodeAt(into.panel, into.path)).toEqual(kind);
      const out = moveOutOf(into.panel, into.path)!;
      expect(out).toEqual({ container: { at: [] }, index: 1 });
      const back = moveNode(into.panel, into.path, out);
      expect(ids(back.panel, { at: [0] })).toEqual([]);
      expect(ids(back.panel).slice(0, 2)).toEqual(['a', nameOf(kind)]);
      expect(nodeAt(back.panel, back.path)).toEqual(kind);
    });
  }

  it('keeps the place of the node moved where something before it, or a group above it, was taken out', () => {
    // "knob" (earlier than group "b") moved into "b": b is one place earlier afterwards, and the path says so
    const knob = { at: [1 + CONTROL_TYPES.indexOf('knob')] };
    const b = { at: [1 + kinds.length] };
    const moved = moveNode(sample, knob, { container: b, index: 1 });
    expect(moved.path).toEqual({ at: [kinds.length, 1] });
    expect(ids(moved.panel, { at: [kinds.length] })).toEqual(['inside', 'knob']);
    // "deep" out of "mover" goes right after it
    const mover = 1 + CONTROL_TYPES.length;
    const out = moveNode(sample, { at: [mover, 0] }, moveOutOf(sample, { at: [mover, 0] })!);
    expect([out.path.at, ids(out.panel).slice(mover, mover + 2)]).toEqual([[mover + 1], ['mover', 'deep']]);
  });

  it('is no move out at the top, in the panel or in a template', () => {
    expect([moveOutOf(sample, { at: [1] }), moveOutOf(EXAMPLE_MIXER, { template: 'strip', at: [0] }), moveOutOf(sample, { at: [9, 9] })]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('is refused, in words, into itself or any of its own descendants; the panel is left as it was', () => {
    const nested: Panel = { id: 'n', name: 'N', children: [{ group: 'outer', children: [{ group: 'mid', children: [{ group: 'inner', children: [] }] }] }] };
    const words = 'A group can’t go into itself or into a group inside it.';
    for (const container of [{ at: [0] }, { at: [0, 0] }, { at: [0, 0, 0] }]) {
      expect(moveProblem(nested, { at: [0] }, container)).toBe(words);
      expect(moveNode(nested, { at: [0] }, { container, index: 0 })).toEqual({ panel: nested, path: { at: [0] } });
    }
    expect(moveProblem(nested, { at: [0, 0] }, { at: [0, 0, 0] })).toBe(words);
    expect(moveProblem(nested, { at: [0, 0, 0] }, { at: [0, 0] })).toBeUndefined();
    expect(moveProblem(nested, { at: [0, 0, 0] }, { at: [] })).toBeUndefined();
    // and no group offers itself, or a group inside it, as somewhere to go
    expect(moveTargets(nested, { at: [0, 0] })).toEqual([]);
    expect(moveTargets(nested, { at: [0, 0, 0] }).map((t) => t.name)).toEqual(['outer']);
  });

  it('is refused when a sibling at the new place has the name: a control and a group share one key space', () => {
    const clash: Panel = {
      id: 'c',
      name: 'C',
      children: [
        { group: 'g', children: [{ type: 'knob', id: 'x' }, { group: 'y', children: [] }, { type: 'fader' }] },
        { type: 'knob', id: 'x' },
        { group: 'y', children: [] },
        { type: 'fader' },
      ],
    };
    expect(moveProblem(clash, { at: [1] }, { at: [0] })).toBe('“x” is already the name of a control in the group.');
    expect(moveProblem(clash, { at: [2] }, { at: [0] })).toBe('“y” is already the name of a group in the group.');
    expect(moveProblem(clash, { at: [0, 0] }, { at: [] })).toBe('“x” is already the name of a control in the panel.');
    expect(moveProblem(clash, { at: [0, 1] }, { at: [] })).toBe('“y” is already the name of a group in the panel.');
    // a control with no name is kept by its place, so two of them never clash
    expect(moveProblem(clash, { at: [3] }, { at: [0] })).toBeUndefined();
    // and one group's name against a control's
    const mixed: Panel = {
      id: 'k',
      name: 'K',
      children: [
        { group: 'g', children: [{ type: 'knob', id: 'a' }] },
        { group: 'a', children: [] },
      ],
    };
    expect(moveProblem(mixed, { at: [1] }, { at: [0] })).toMatch(/already the name of a control/);
    expect(moveNode(clash, { at: [1] }, { container: { at: [0] }, index: 0 }).panel).toBe(clash);
    expect(moveTargets(clash, { at: [1] }).map((t) => t.name)).toEqual(['g / y', 'y']);
  });

  it('is refused into a place that doesn’t have a parameter the node uses: a repeat’s, or a template’s', () => {
    // accent uses ch, the repeat of its row: out to "play" it would read ch as 0
    const accent = { at: [2, 0, 1] };
    expect(moveProblem(EXAMPLE_PLAY, accent, { at: [2] })).toBe('It uses “ch”, which is not set in that place.');
    expect(moveProblem(EXAMPLE_PLAY, accent, { at: [0] })).toBe('It uses “ch”, which is not set in that place.');
    // hold uses nothing: it goes out and in again
    expect(moveProblem(EXAMPLE_PLAY, { at: [2, 0, 0] }, { at: [2] })).toBeUndefined();
    expect(moveProblem(EXAMPLE_PLAY, { at: [2, 1] }, { at: [2, 0] })).toBeUndefined();
    // level uses ch, the strip template’s parameter: out to the panel, into the template’s group or beside main it has no ch, within the template it does
    const level = { template: 'strip', at: [3] };
    expect(moveProblem(EXAMPLE_MIXER, level, { at: [] })).toMatch(/“ch”/);
    // a group that gives ch to a template reads it in its own scope: moving it within the panel is no change of scope
    expect(moveProblem(EXAMPLE_MIXER, { at: [0] }, { at: [] })).toBeUndefined();
    // the repeat’s own name, used by the strips group’s label {ch} and by with, is the group’s own: a node that stands in it has it
    const inRepeat: Panel = {
      id: 'r',
      name: 'R',
      children: [
        { group: 'rep', repeat: { name: 'n', from: 1, to: 3 }, children: [{ group: 'slot', children: [] }] },
        { type: 'knob', id: 'k', label: 'K {n}', bind: [{ kind: 'cc', number: 'n * 2' }] },
        { type: 'fader', id: 'plain', bind: [{ kind: 'cc', number: 'min(7, 9)' }] },
      ],
    };
    expect(moveProblem(inRepeat, { at: [1] }, { at: [0, 0] })).toBeUndefined();
    expect(moveProblem(inRepeat, { at: [0, 0] }, { at: [] })).toBeUndefined();
    // a control that would carry n out of its repeat
    const carried = moveNode(inRepeat, { at: [1] }, { container: { at: [0, 0] }, index: 0 }).panel;
    expect(moveProblem(carried, { at: [0, 0, 0] }, { at: [] })).toMatch(/“n”/);
    expect(moveProblem(carried, { at: [0, 0, 0] }, { at: [0] })).toBeUndefined();
    // a function’s name is no parameter
    expect(moveProblem(inRepeat, { at: [2] }, { at: [0] })).toBeUndefined();
  });

  it('moves a node between the panel and a template: it joins the template, so every strip gets it', () => {
    const into = moveNode(EXAMPLE_MIXER, { at: [1] }, { container: containerOf(EXAMPLE_MIXER, { at: [0] })!, index: 4 });
    expect(into.path).toEqual({ template: 'strip', at: [4] });
    expect(ids(into.panel)).toEqual(['strips']);
    const made = instantiate(into.panel);
    expect([made.errors, made.controls.length]).toEqual([[], 40]);
    const out = moveNode(into.panel, into.path, { container: { at: [] }, index: 1 });
    expect(out.panel).toEqual(EXAMPLE_MIXER);
  });

  it('is refused for a template into itself: a group that uses it would hold the template', () => {
    const two: Panel = {
      id: 't',
      name: 'T',
      templates: {
        a: { params: [], children: [{ type: 'knob', id: 'k' }] },
        b: { params: [], children: [{ group: 'ua', use: 'a' }] },
      },
      children: [
        { group: 'ub', use: 'b' },
        { group: 'ua2', use: 'a' },
      ],
    };
    const words = 'That template would use itself.';
    // "ua" (in b, using a) into the group that uses a: a would hold a group that uses a
    expect(moveProblem(two, { template: 'b', at: [0] }, { template: 'a', at: [] })).toBe(words);
    // "ub" (using b, which uses a) into a's group: a would use b would use a
    expect(moveProblem(two, { at: [0] }, containerOf(two, { at: [1] })!)).toBe(words);
    expect(moveProblem(two, { at: [1] }, containerOf(two, { at: [0] })!)).toBeUndefined();
  });

  it('is refused past MAX_DEPTH, counting the node’s own groups, exactly where the reader would give an error', () => {
    // a chain of groups as deep as is allowed (MAX_DEPTH - 1 groups: the last one’s children are at depth MAX_DEPTH)
    const chain = (n: number, inner: PanelNode[]): PanelNode[] => (n === 0 ? inner : [{ group: `g${n}`, children: chain(n - 1, inner) }]);
    const deepest = (_panel: Panel) => ({ at: Array.from({ length: MAX_DEPTH - 1 }, () => 0) });
    const base: Panel = { id: 'd', name: 'D', children: [...chain(MAX_DEPTH - 1, []), { type: 'knob', id: 'k' }, { group: 'extra', children: [] }] };
    expect(instantiate(base).errors).toEqual([]);
    const knob = { at: [1] };
    const extra = { at: [2] };
    // a control goes in at the deepest level (depth MAX_DEPTH), an empty group would put its own children one deeper
    expect(moveProblem(base, knob, deepest(base))).toBeUndefined();
    expect(moveProblem(base, extra, deepest(base))).toBe(`Groups nest at most ${MAX_DEPTH} deep.`);
    const knobIn = moveNode(base, knob, { container: deepest(base), index: 0 }).panel;
    expect(instantiate(knobIn).errors).toEqual([]);
    const forced = insertNode(base, deepest(base), { group: 'extra2', children: [] }).panel;
    expect(instantiate(forced).errors.join()).toMatch(/nested more than/);
    // one level up it fits, and a group that holds a group fits one level less
    const up = { at: deepest(base).at.slice(1) };
    expect(moveProblem(base, extra, up)).toBeUndefined();
    const holder: PanelNode = { group: 'holder', children: [{ group: 'held', children: [] }] };
    expect(moveProblem({ ...base, children: [...base.children, holder] }, { at: [3] }, up)).toBe(`Groups nest at most ${MAX_DEPTH} deep.`);
  });

  it('is refused into a place that isn’t there, and a node that isn’t', () => {
    expect(moveProblem(sample, { at: [1] }, { at: [1] })).toBe('That isn’t a group.');
    expect(moveProblem(sample, { at: [40] }, { at: [0] })).toBeUndefined();
    expect(moveNode(sample, { at: [40] }, { container: { at: [0] }, index: 0 })).toEqual({ panel: sample, path: { at: [40] } });
    expect(moveNode(sample, { at: [1] }, { container: { at: [1] }, index: 0 }).panel).toBe(sample);
  });

  it('is one operation with Earlier and Later: moving among the siblings is moving to an index in the same container', () => {
    const last = moveNode(sample, { at: [0] }, { container: { at: [] }, index: 99 });
    expect([ids(last.panel).at(-1), last.path.at]).toEqual(['a', [kinds.length + 1]]);
    const first = moveNode(sample, { at: [3] }, { container: { at: [] }, index: 0 });
    expect([ids(first.panel).slice(0, 2), first.path.at]).toEqual([[nameOf(sample.children[3]!), 'a'], [0]]);
    expect(moveNode(sample, { at: [2] }, 1)).toEqual(moveNode(sample, { at: [2] }, { container: { at: [] }, index: 3 }));
    expect(moveNode(sample, { at: [2] }, -1)).toEqual(moveNode(sample, { at: [2] }, { container: { at: [] }, index: 1 }));
  });

  it('every move offered, over every node of both examples and the sample, leaves a panel the reader keeps as it is, as readable as before', () => {
    let moves = 0;
    for (const panel of [EXAMPLE_MIXER, EXAMPLE_PLAY, sample]) {
      const before = instantiate(panel).errors;
      const places = everyPlace(panel);
      for (const path of places) {
        const out = moveOutOf(panel, path);
        const offered = [
          ...moveTargets(panel, path).map((t) => ({ container: containerOf(panel, t.group)!, index: 0 })),
          // (a move out may be refused, and said so when it is asked for)
          ...(out && !moveProblem(panel, path, out.container) ? [out] : []),
        ];
        for (const to of offered) {
          expect(moveProblem(panel, path, to.container), `${panel.id} ${JSON.stringify(path)}`).toBeUndefined();
          const moved = moveNode(panel, path, to);
          moves++;
          expect(moved.panel, `${panel.id} ${JSON.stringify(path)}`).not.toBe(panel);
          expect(readPanel(JSON.parse(JSON.stringify(moved.panel)))).toEqual(moved.panel);
          expect(instantiate(moved.panel).errors).toEqual(before);
          expect(nodeAt(moved.panel, moved.path)).toEqual(nodeAt(panel, path));
          expect(everyPlace(moved.panel).length).toBe(places.length);
        }
        // and it is offered exactly where it isn’t refused: every group’s container, but the one the node is in already
        const home = containerOf(panel, { ...path, at: path.at.slice(0, -1) });
        const offeredTo = moveTargets(panel, path).map((t) => containerOf(panel, t.group)!);
        for (const place of places) {
          const container = containerOf(panel, place);
          if (!container || (home && samePath(container, home))) continue;
          expect(
            offeredTo.some((o) => samePath(o, container)),
            `${panel.id} ${JSON.stringify(path)} into ${JSON.stringify(place)}`,
          ).toBe(moveProblem(panel, path, container) === undefined);
        }
      }
    }
    expect(moves).toBeGreaterThan(20);
  });
});
