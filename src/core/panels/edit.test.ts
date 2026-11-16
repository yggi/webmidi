import { describe, expect, it } from 'vitest';
import {
  childrenAt,
  containerOf,
  duplicateNode,
  insertNode,
  moveNode,
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
import { CONTROL_TYPES, isGroup, MAX_GRID, readPanel, type Control, type Panel } from './model';

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
