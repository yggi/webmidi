import { describe, expect, it } from 'vitest';
import { loadBook, newBook, renameSetup } from '../core/setups';
import { localBookStore } from './book-store';

/** A `localStorage` in memory; `refuse` throws on every call, as a private window's may. */
function fakeStorage(refuse = false) {
  const kept = new Map<string, string>();
  const guard = () => {
    if (refuse) throw new Error('SecurityError');
  };
  return {
    kept,
    getItem: (k: string) => (guard(), kept.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(), void kept.set(k, v)),
  };
}

describe('localBookStore', () => {
  it('keeps a book as JSON under its key, and reads it back', () => {
    const storage = fakeStorage();
    const store = localBookStore('app:midi-setups', () => storage);
    const book = renameSetup(newBook(), 's1', 'Home');
    store.save(book);
    expect(JSON.parse(storage.kept.get('app:midi-setups')!)).toEqual(book);
    expect(loadBook(store)).toEqual(book);
  });

  it('reads junk as junk, for readBook to drop, and nothing as null', () => {
    const storage = fakeStorage();
    storage.kept.set('k', '{not json');
    expect(localBookStore('k', () => storage).load()).toBeNull();
    expect(localBookStore('other', () => storage).load()).toBeNull();
  });

  it('loads a new book and saves nothing when storage is refused, without throwing', () => {
    const store = localBookStore('k', () => fakeStorage(true));
    expect(() => store.save(newBook())).not.toThrow();
    expect(loadBook(store)).toEqual(newBook());
  });
});
