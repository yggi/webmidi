import { describe, expect, it } from 'vitest';
import { childrenAt, containerOf, duplicateNode, insertNode, moveNode, newControl, newGroup, nodeAt, ofKind, removeNode, samePath, updateNode } from './edit';
import { EXAMPLE_MIXER, EXAMPLE_PLAY } from './examples';
import { instantiate } from './instantiate';
import { CONTROL_TYPES, isGroup, readPanel, type Control, type Panel } from './model';

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
