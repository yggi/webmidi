// What an input plays (yggi/webmidi#43, decision 003): the choice that holds, the row it finds among a frontend's,
// whether it is heard, and the inputs to listen to.
import { describe, expect, it } from 'vitest';
import { applyPreset, DEFAULT_PRESET } from './input-kinds';
import { forwardsAsPlayed } from './forward';
import { BINDING_KINDS, type Panel } from './panels/model';
import { PanelRuntime } from './panels/runtime';
import { choiceOf, heardOf, isHeard, listenOf, panelPlays, playedBy, playsOf } from './plays';
import { activeSetup, ANY_INPUT, exportSetup, importSetup, newBook, panelKey, readBook, withCrossing, withPanelActive, withPlays, type PlaysChoice } from './setups';

const keys = { id: 'in-1', name: 'Keys' };
const pads = { id: 'in-2', name: 'Pads' };
/** Cell studio's rows for a piece, and Jambot's parts: their ids differ, their roles meet. */
const PIECE = [
  { id: 'fiddle', role: 'lead' },
  { id: 'bass', role: 'bass' },
  { id: '*', role: 'drums' },
];
const BAND = [
  { id: 'lead', role: 'lead' },
  { id: 'drums', role: 'drums' },
];

describe('the choice that holds for an input', () => {
  it('is its own, else every input’s, else not heard', () => {
    let book = newBook();
    expect([choiceOf(activeSetup(book), keys), isHeard(activeSetup(book), keys)]).toEqual(['none', false]);
    book = withPlays(book, ANY_INPUT, 'default');
    expect([choiceOf(activeSetup(book), keys), isHeard(activeSetup(book), keys)]).toEqual(['default', true]);
    book = withPlays(book, 'in:Keys', 'none');
    expect([choiceOf(activeSetup(book), keys), choiceOf(activeSetup(book), pads)]).toEqual(['none', 'default']);
    expect(choiceOf(activeSetup(withPlays(newBook(), 'in:__proto__', 'default')), 'in:__proto__')).toBe('default');
  });
});

describe('what an input plays among a frontend’s rows', () => {
  it('a row it has by its id; a row it lacks by its role; neither, the default; not heard, null', () => {
    const book = withPlays(newBook(), 'in:Keys', { row: 'fiddle', role: 'lead' });
    expect(playsOf(book, keys, PIECE)).toBe('fiddle');
    expect(playsOf(book, keys, BAND)).toBe('lead');
    expect(playsOf(book, keys, [{ id: 'bass', role: 'bass' }])).toBe('default');
    expect(playsOf(withPlays(newBook(), 'in:Keys', { row: 'gone' }), keys, PIECE)).toBe('default');
    expect(playsOf(book, pads, PIECE)).toBeNull();
    expect(playsOf(withPlays(newBook(), ANY_INPUT, 'default'), pads, PIECE)).toBe('default');
  });

  it('travels in a setup’s file: exported, imported, the same choices', () => {
    const book = withPlays(withPlays(newBook(), 'in:Keys', { row: 'lead', role: 'lead' }), 'in:Pads', 'none');
    const other = importSetup(newBook(), exportSetup(book));
    if (typeof other === 'string') throw new Error(other);
    expect(activeSetup(other).plays).toEqual({ 'in:Keys': { row: 'lead', role: 'lead' }, 'in:Pads': 'none' });
    expect(playsOf(other, keys, PIECE)).toBe('fiddle');
  });
});

describe('the inputs heard, and listened to', () => {
  it('heard: every input when every input’s choice is heard, else those whose own choice is', () => {
    expect(heardOf(activeSetup(withPlays(newBook(), ANY_INPUT, 'default')))).toBe('all');
    const book = withPlays(withPlays(newBook(), 'in:Keys', 'default'), 'in:Pads', 'none');
    expect(heardOf(activeSetup(book))).toEqual([{ id: 'Keys', name: 'Keys' }]);
  });

  it('listened to: those heard and those routed in any context; all when every input is either', () => {
    let book = withPlays(newBook(), 'in:Keys', 'default');
    book = withCrossing(book, 'band', 'in:Pads', 'o1', 2);
    expect(listenOf(activeSetup(book))).toEqual([
      { id: 'Keys', name: 'Keys' },
      { id: 'Pads', name: 'Pads' },
    ]);
    expect(listenOf(activeSetup(withCrossing(book, 'piece:x', ANY_INPUT, 'o1', 1)))).toBe('all');
    expect(listenOf(activeSetup(newBook()))).toEqual([]);
  });
});

// ---- a panel's row plays as an input's does (yggi/webmidi#71, amends decision 007) ----

/** One control for each kind a panel can send (`BINDING_KINDS`), so what is played is checked over every kind, by the bytes a panel really sends. */
const EVERY_KIND: Panel = {
  id: 'every',
  name: 'Every kind',
  children: [
    { type: 'knob', id: 'cc', bind: [{ kind: 'cc', number: 74 }] },
    { type: 'knob', id: 'cc14', bind: [{ kind: 'cc14', number: 7 }] },
    { type: 'switch', id: 'note', bind: [{ kind: 'note', number: 60 }] },
    { type: 'knob', id: 'program', bind: [{ kind: 'program' }] },
    { type: 'fader', id: 'bend', bind: [{ kind: 'bend' }] },
    { type: 'fader', id: 'pressure', bind: [{ kind: 'pressure' }] },
    { type: 'knob', id: 'nrpn', bind: [{ kind: 'nrpn', number: 300 }] },
    { type: 'knob', id: 'rpn', bind: [{ kind: 'rpn', number: 2 }] },
  ],
};

/** The messages each kind sends when its control is turned up, by kind. */
function sentByKind(): Record<string, number[][]> {
  const runtime = new PanelRuntime(EVERY_KIND);
  return Object.fromEntries(BINDING_KINDS.map((kind) => [kind, runtime.move(kind, { x: 1 })]));
}

describe('what a panel’s row plays (yggi/webmidi#71)', () => {
  const choices: [string, PlaysChoice | undefined][] = [
    ['none', 'none'],
    ['default', 'default'],
    ['a row kept by id', { row: 'fiddle', role: 'lead' }],
    ['a row kept by role only here', { row: 'gone', role: 'lead' }],
    ['a row neither of which is here', { row: 'gone', role: 'nothing' }],
    ['no choice', undefined],
  ];

  it('is none by default, and not what every input plays: a panel is heard by no frontend row unless it says so', () => {
    const book = withPlays(newBook(), ANY_INPUT, 'default');
    expect(choiceOf(activeSetup(book), panelKey('mixer'))).toBe('none');
    expect(isHeard(activeSetup(book), panelKey('mixer'))).toBe(false);
    expect(playsOf(book, panelKey('mixer'), PIECE)).toBeNull();
    expect(panelPlays(book, 'mixer', PIECE, [0x90, 60, 100])).toBeNull();
  });

  it('has the eight kinds, each sending at least one message', () => {
    expect(BINDING_KINDS).toHaveLength(8);
    for (const [kind, sent] of Object.entries(sentByKind())) expect([kind, sent.length > 0]).toEqual([kind, true]);
  });

  it('plays what an input with the same choice plays, for every kind’s bytes: same row, same bytes', () => {
    for (const [name, choice] of choices) {
      let panel = newBook();
      let input = newBook();
      if (choice !== undefined) {
        panel = withPlays(panel, panelKey('every'), choice);
        input = withPlays(input, 'in:Keys', choice);
      }
      for (const rows of [PIECE, BAND])
        for (const [kind, sent] of Object.entries(sentByKind()))
          for (const data of sent) {
            const expected = playedBy(input, keys, rows, data);
            expect([name, kind, panelPlays(panel, 'every', rows, data)]).toEqual([name, kind, expected]);
            if (choice === undefined || choice === 'none') expect(expected).toBeNull();
            else expect(expected).toEqual({ plays: playsOf(input, keys, rows), data });
          }
    }
  });

  it('plays only channel voice messages: a system message or a status-less one is not played, whatever the choice', () => {
    const book = withPlays(newBook(), panelKey('p'), 'default');
    for (const data of [[0xf8], [0xf0, 1, 0xf7], [60, 100], []]) expect([data, panelPlays(book, 'p', PIECE, data)]).toEqual([data, null]);
    expect(panelPlays(book, 'p', PIECE, [0x90, 60, 100])).toEqual({ plays: 'default', data: [0x90, 60, 100] });
  });

  it('an input’s own choice and every input’s do not touch a panel’s, and a panel’s do not touch an input’s', () => {
    const book = withPlays(withPlays(newBook(), panelKey('p'), { row: 'bass' }), 'in:Keys', 'none');
    expect(playsOf(book, panelKey('p'), PIECE)).toBe('bass');
    expect(playsOf(book, keys, PIECE)).toBeNull();
    expect(playsOf(withPlays(newBook(), 'in:Keys', 'default'), panelKey('p'), PIECE)).toBeNull();
  });

  it('is not an input to listen to: heard and listened-to inputs are ports, and a panel’s choice opens none', () => {
    const book = withPlays(withPlays(newBook(), panelKey('p'), 'default'), 'in:Keys', 'default');
    expect(heardOf(activeSetup(book))).toEqual([{ id: 'Keys', name: 'Keys' }]);
    expect(listenOf(activeSetup(book))).toEqual([{ id: 'Keys', name: 'Keys' }]);
    expect(heardOf(activeSetup(withPlays(newBook(), panelKey('p'), 'default')))).toEqual([]);
    expect(listenOf(activeSetup(withPlays(newBook(), panelKey('p'), 'default')))).toEqual([]);
  });

  it('is not filled in by a preset, and goes with the panel taken out of the setup', () => {
    const book = withPlays(withPanelActive(newBook(), 'p', true), panelKey('p'), 'default');
    expect(activeSetup(applyPreset(book, DEFAULT_PRESET, [keys], PIECE)).plays).toEqual({ 'panel:p': 'default', 'in:Keys': { row: 'fiddle', role: 'lead' } });
    expect(activeSetup(withPanelActive(book, 'p', false)).plays).toEqual({});
  });

  it('travels in a setup’s file, exported and imported, and is kept by the book’s reader', () => {
    const book = withPlays(withPlays(newBook(), panelKey('p'), { row: 'lead', role: 'lead' }), 'in:Keys', 'default');
    const other = importSetup(newBook(), exportSetup(book));
    if (typeof other === 'string') throw new Error(other);
    expect(activeSetup(other).plays).toEqual({ 'panel:p': { row: 'lead', role: 'lead' }, 'in:Keys': 'default' });
    expect(activeSetup(readBook(JSON.parse(JSON.stringify(book)))).plays).toEqual(activeSetup(book).plays);
    expect(playsOf(other, panelKey('p'), PIECE)).toBe('fiddle');
  });

  it('keeps the other rows’ choices and drops what is neither an input’s nor a panel’s, as a reader of before drops a panel’s', () => {
    const kept = (plays: unknown) => activeSetup(readBook({ version: 1, setups: [{ id: 'a', name: 'A', plays }] })).plays;
    expect(kept({ 'panel:p': 'default', 'in:Keys': 'none', 'out:x': 'default', 'panel:q': 'bogus' })).toEqual({ 'panel:p': 'default', 'in:Keys': 'none' });
  });
});

describe('forwarding as played, from a panel’s row', () => {
  it('goes where the row it plays is sent, as an input’s does', () => {
    let book = withCrossing(newBook(), 'piece:x', 'fiddle', 'o1', 3);
    book = withPlays(withPlays(book, panelKey('p'), { row: 'fiddle', role: 'lead' }), 'in:Keys', { row: 'fiddle', role: 'lead' });
    for (const data of [
      [0x90, 60, 100],
      [0xb0, 74, 9],
    ])
      expect(forwardsAsPlayed(book, 'piece:x', panelKey('p'), PIECE, data)).toEqual(forwardsAsPlayed(book, 'piece:x', keys, PIECE, data));
    expect(forwardsAsPlayed(book, 'piece:x', panelKey('p'), PIECE, [0x90, 60, 100])).toEqual([{ output: 'o1', data: [0x92, 60, 100] }]);
    expect(forwardsAsPlayed(withPlays(book, panelKey('p'), 'none'), 'piece:x', panelKey('p'), PIECE, [0x90, 60, 100])).toEqual([]);
  });
});

// ---- a book and a file from before this change read unchanged (stored copies of the format of v0.6.1) ----

describe('a book and a file from before panels played', () => {
  /** A book as v0.6.1 kept it in `localStorage`, copied: a setup with inputs' choices, a panel active and routed. */
  const STORED_BOOK = {
    version: 1,
    devices: { 'Minilogue xd': { drums: {}, bend: 12, mpe: null, latency: 20 } },
    defaults: { drums: {}, bend: 2, mpe: null, latency: 0 },
    setups: [
      {
        id: 's1',
        name: 'Setup 1',
        outputs: [{ key: 'o1', id: 'out-1', name: 'Minilogue xd' }],
        plays: { 'in:Keys': { row: 'lead', role: 'lead' }, 'in:*': 'default', 'in:Pads': 'none' },
        routes: { 'piece:a': { 'in:Keys': { o1: 0 }, 'panel:mixer': { o1: 3 } } },
        clock: ['o1'],
        panels: ['mixer'],
      },
    ],
    active: 's1',
  };
  /** A `.midisetup.json` as v0.6.1 wrote it, copied (version 2). */
  const STORED_FILE = JSON.stringify({
    format: 'webmidi-setup',
    version: 2,
    setup: {
      id: 's1',
      name: 'Setup 1',
      outputs: [{ key: 'o1', id: 'out-1', name: 'Minilogue xd' }],
      plays: { 'in:Keys': 'default', 'in:Pads': { row: 'drums' } },
      routes: {},
      clock: [],
      panels: ['mixer'],
    },
    devices: {},
  });

  it('a stored book reads unchanged: the same setup, every field, and a panel with no choice is heard by none', () => {
    const book = readBook(JSON.parse(JSON.stringify(STORED_BOOK)));
    expect(book).toEqual({ ...STORED_BOOK, devices: { 'Minilogue xd': STORED_BOOK.devices['Minilogue xd'] } });
    expect(playsOf(book, panelKey('mixer'), PIECE)).toBeNull();
    expect(playsOf(book, keys, PIECE)).toBe('fiddle');
  });

  it('a stored file reads unchanged, and is still written at version 2', () => {
    const book = importSetup(newBook(), STORED_FILE);
    if (typeof book === 'string') throw new Error(book);
    expect(activeSetup(book).plays).toEqual({ 'in:Keys': 'default', 'in:Pads': { row: 'drums' } });
    expect(activeSetup(book).panels).toEqual(['mixer']);
    expect(JSON.parse(exportSetup(book)).version).toBe(2);
  });
});
