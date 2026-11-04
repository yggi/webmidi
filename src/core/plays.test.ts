// What an input plays (yggi/webmidi#43, decision 003): the choice that holds, the row it finds among a frontend's,
// whether it is heard, and the inputs to listen to.
import { describe, expect, it } from 'vitest';
import { choiceOf, heardOf, isHeard, listenOf, playsOf } from './plays';
import { activeSetup, ANY_INPUT, exportSetup, importSetup, newBook, withCrossing, withPlays } from './setups';

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
