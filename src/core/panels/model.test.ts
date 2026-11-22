import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_MIXER } from './examples';
import { MAX_EXPRESSION } from './expr';
import { instantiate } from './instantiate';
import { exportPanel, importPanel, loadLibrary, MAX_FILE, memoryPanelStore, newLibrary, panelOf, readLibrary, removePanel, withPanel } from './library';
import { isGroup, MAX_DEPTH, MAX_GRID, readPanel, type Group, type PanelNode } from './model';

describe('an override of a repeated group', () => {
  const over = (repeat: unknown, overrides: unknown) => (readPanel({ id: 'a', children: [{ group: 'g', repeat, overrides, children: [] }] })!.children[0] as Group).overrides;
  const L = (label: string) => ({ label });
  const mixer = { name: 'ch', from: 1, to: 8 };

  it('is kept for each value the repeat produces, the ends included, and for no other: a stale one is dropped', () => {
    expect(over(mixer, { '1': L('A'), '4': L('D'), '8': L('H') })).toEqual({ '1': L('A'), '4': L('D'), '8': L('H') });
    expect(over(mixer, { '0': L('x'), '9': L('y'), '-1': L('z'), '2': L('kept') })).toEqual({ '2': L('kept') });
    expect(over(mixer, { '0': L('x'), '9': L('y') })).toBeUndefined();
  });
  it('follows the values instantiate gives the repeat: its ends rounded, and none for a repeat that runs backwards', () => {
    expect(over({ name: 'n', from: 0.6, to: 2.4 }, { '0': L('a'), '1': L('b'), '2': L('c'), '3': L('d') })).toEqual({ '1': L('b'), '2': L('c') });
    expect(over({ name: 'n', from: 5, to: 1 }, { '1': L('a'), '5': L('b') })).toBeUndefined();
    const g = (overrides: Record<string, { label: string }>): Group => ({
      group: 'g',
      repeat: { name: 'n', from: 0.6, to: 2.4 },
      children: [{ type: 'label', label: '{n}' }],
      overrides,
    });
    const labels = (panel: { id: string; name: string; children: Group[] }) => instantiate(panel).children.map((c) => (c as { label: string }).label);
    expect(labels({ id: 'p', name: 'P', children: [g({ '1': L('b') })] })).toEqual(['b', '']);
  });
  it('is dropped where a key is not a whole number as the repeat names it: a word, a fraction, a leading zero, a plus', () => {
    expect(over(mixer, { a: L('a'), '2.5': L('b'), '02': L('c'), '+3': L('d'), ' 4': L('e'), '1e0': L('f'), '5': L('ok') })).toEqual({ '5': L('ok') });
  });
  it('is dropped by a group that does not repeat: nothing would ever read it', () => {
    expect(over(undefined, { '1': L('A') })).toBeUndefined();
  });
  it('is kept where a repeat’s end is an expression, whose values are not known here, and only for a whole number', () => {
    expect(over({ name: 'ch', from: 1, to: 'n * 2' }, { '3': L('c'), '40': L('d'), x: L('e') })).toEqual({ '3': L('c'), '40': L('d') });
    expect(over({ name: 'ch', from: 'a', to: 8 }, { '9': L('c') })).toEqual({ '9': L('c') });
  });
  it(`is at most ${MAX_GRID} to a group, the lowest values kept`, () => {
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), L(`L${i + 1}`)]));
    const kept = over({ name: 'n', from: 1, to: 100 }, many)!;
    expect(Object.keys(kept)).toHaveLength(MAX_GRID);
    expect(Object.keys(kept)[0]).toBe('1');
    expect(kept[String(MAX_GRID)]).toEqual(L(`L${MAX_GRID}`));
    expect(kept[String(MAX_GRID + 1)]).toBeUndefined();
  });
  it('is read as written: a panel written is a panel read, and the example’s override stays', () => {
    const written = { id: 'a', name: 'a', children: [{ group: 'g', repeat: mixer, overrides: { '3': L('Drums') }, children: [] }] };
    expect(readPanel(JSON.parse(JSON.stringify(written)))).toEqual(written);
    expect(readPanel(JSON.parse(JSON.stringify(EXAMPLE_MIXER)))).toEqual(EXAMPLE_MIXER);
  });
});

describe('readPanel', () => {
  it('reads a panel written as it was', () => {
    expect(readPanel(JSON.parse(JSON.stringify(EXAMPLE_MIXER)))).toEqual(EXAMPLE_MIXER);
  });

  it('is no panel without an id, and takes its id for a name it lacks', () => {
    for (const v of [null, 7, 'x', [], {}, { id: '' }, { id: 7 }, { id: 'x'.repeat(65) }]) expect(readPanel(v)).toBeNull();
    expect(readPanel({ id: 'a' })).toEqual({ id: 'a', name: 'a', children: [] });
    expect(readPanel({ id: 'a', name: '  ' })!.name).toBe('a');
  });

  it('drops junk field by field: a kind there is none of, a number that is none, a place off the grid, a script', () => {
    const read = readPanel({
      id: 'a',
      name: 'A',
      channel: 'oops'.repeat(100),
      columns: 0,
      onload: 'alert(1)',
      children: [
        7,
        { type: 'script', src: 'https://example.com' },
        {
          type: 'knob',
          id: 'no good',
          label: 'x'.repeat(65),
          value: 2,
          cell: { column: 0, row: 3, rows: 65 },
          bind: [{ kind: 'sysex' }, { kind: 'cc', number: NaN, range: [1], axis: 'z', extra: 1 }, 'cc'],
          html: '<b>',
        },
        { type: 'pads', notes: [36, 200, 'x', 38] },
        { type: 'keyboard', low: -1, high: 72 },
        { group: 'not a name', children: [{ type: 'knob' }] },
        { group: 'g', repeat: { name: 'i', from: 1, to: 3 }, columns: 4, overrides: { '1': { label: 'One' }, '2': 'Two' }, children: [{ type: 'label', label: 'L' }] },
        { group: 'u', use: 't', with: { ok: 1, 'not ok': 2, bad: {} }, children: [{ type: 'knob' }] },
      ],
    });
    expect(read).toEqual({
      id: 'a',
      name: 'A',
      children: [
        { type: 'knob', cell: { row: 3 }, bind: [{ kind: 'cc' }] },
        { type: 'pads', notes: [36, 38] },
        { type: 'keyboard', high: 72 },
        { group: 'g', repeat: { name: 'i', from: 1, to: 3 }, columns: 4, overrides: { '1': { label: 'One' } }, children: [{ type: 'label', label: 'L' }] },
        { group: 'u', use: 't', with: { ok: 1 } },
      ],
    });
  });

  it('keeps `__proto__` a key, where it is one', () => {
    const read = readPanel(
      JSON.parse('{"id":"a","templates":{"__proto__":{"params":["n"],"children":[]}},"children":[{"group":"g","overrides":{"__proto__":{"label":"P"}},"children":[]}]}'),
    );
    expect(Object.keys(read!.templates!)).toEqual(['__proto__']);
    // (an override is kept by a whole number the repeat gives, so a key `__proto__` there is dropped, not made the object's prototype)
    expect((read!.children[0] as Group).overrides).toBeUndefined();
    expect(({} as { label?: unknown }).label).toBeUndefined();
    expect(({} as { params?: unknown }).params).toBeUndefined();
  });

  it(`keeps an expression of ${MAX_EXPRESSION} characters and no longer, and groups ${MAX_DEPTH} deep and no deeper`, () => {
    const bind = (n: number) => readPanel({ id: 'a', children: [{ type: 'knob', bind: [{ kind: 'cc', number: '1'.repeat(n) }] }] })!.children[0];
    expect(bind(MAX_EXPRESSION)).toEqual({ type: 'knob', bind: [{ kind: 'cc', number: '1'.repeat(MAX_EXPRESSION) }] });
    expect(bind(MAX_EXPRESSION + 1)).toEqual({ type: 'knob', bind: [{ kind: 'cc' }] });
    let nested: unknown = { type: 'knob' };
    for (let i = 0; i < MAX_DEPTH + 4; i++) nested = { group: 'g', children: [nested] };
    let depth = 0;
    for (let node: PanelNode | undefined = readPanel({ id: 'a', children: [nested] })!.children[0]; node && isGroup(node); node = node.children?.[0]) depth++;
    expect(depth).toBe(MAX_DEPTH);
  });
});

describe('the library', () => {
  it('keeps panels by id: one put in takes the place of its id, else comes last; one removed is gone', () => {
    const a = { id: 'a', name: 'A', children: [] };
    const b = { id: 'b', name: 'B', children: [] };
    const library = withPanel(withPanel(newLibrary(), a), b);
    expect(library.panels).toEqual([a, b]);
    expect(withPanel(library, { ...a, name: 'A2' }).panels.map((p) => p.name)).toEqual(['A2', 'B']);
    expect(panelOf(library, 'b')).toBe(b);
    expect(removePanel(library, 'a').panels).toEqual([b]);
  });

  it('is read from anything: junk is an empty library, a panel that can’t be read and a second under one id are dropped', () => {
    for (const v of [null, 7, {}, { version: 2, panels: [] }, { version: 1 }]) expect(readLibrary(v)).toEqual(newLibrary());
    expect(readLibrary({ version: 1, panels: [{ id: 'a' }, 7, { id: 'a', name: 'again' }, { name: 'no id' }] }).panels).toEqual([{ id: 'a', name: 'a', children: [] }]);
  });

  it('is kept by a store, and read back as it was saved', () => {
    const store = memoryPanelStore();
    expect(loadLibrary(store)).toEqual(newLibrary());
    const library = withPanel(newLibrary(), EXAMPLE_MIXER);
    store.save(library);
    expect(loadLibrary(store)).toEqual(library);
  });

  it('a panel exported is imported under an id and a name of its own, playing as it did', () => {
    const library = withPanel(newLibrary(), EXAMPLE_MIXER);
    const text = exportPanel(EXAMPLE_MIXER);
    const twice = importPanel(importPanel(library, text) as typeof library, text);
    if (typeof twice === 'string') throw new Error(twice);
    expect(twice.panels.map((p) => [p.id, p.name])).toEqual([
      ['mixer', 'DM-8 mixer'],
      ['p2', 'DM-8 mixer 2'],
      ['p3', 'DM-8 mixer 3'],
    ]);
    expect(instantiate(twice.panels[2]!).controls).toEqual(instantiate(EXAMPLE_MIXER).controls);
  });

  it('refuses in words what is no panel’s file, a newer one, one too large, one of too many controls', () => {
    const library = newLibrary();
    const file = (panel: unknown, rest: object = {}) => JSON.stringify({ format: 'webmidi-panel', version: 1, panel, ...rest });
    expect(importPanel(library, 'not json')).toBe('This file isn’t a panel: it isn’t JSON.');
    expect(importPanel(library, '{"format":"webmidi-setup"}')).toBe('This file isn’t a panel.');
    expect(importPanel(library, file({ id: 'a' }, { version: 2 }))).toBe('This panel was saved by a newer version: update the app to open it.');
    expect(importPanel(library, file({ name: 'no id' }))).toBe('This panel is damaged: it has no panel in it.');
    expect(importPanel(library, ' '.repeat(MAX_FILE + 1))).toBe('This panel is too large to open (more than 256 KB).');
    expect(importPanel(library, file({ id: 'a', children: [{ group: 'g', repeat: { name: 'i', from: 1, to: 5000 }, children: [{ type: 'knob' }] }] }))).toBe(
      'This panel is too large to open (more than 2000 controls and groups).',
    );
  });
});

describe('@yggi/webmidi/panels', () => {
  it('is an export of the package, its source and its declarations both there, and apart from core’s surface', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { exports: Record<string, { types: string; default: string }> };
    const entry = pkg.exports['./panels']!;
    expect(entry).toEqual({ types: './types/core/panels/index.d.ts', default: './src/core/panels/index.ts' });
    expect(existsSync(entry.default) && existsSync(entry.types)).toBe(true);
    expect(readFileSync('src/core/index.ts', 'utf8')).not.toContain('panels');
  });
});
