import { describe, expect, it } from 'vitest';
import { loadBook, newBook, renameSetup } from '../core/setups';
import { readLibrary } from '../core/panels/index';
import { localBookStore } from './book-store';
import { localPanelStore } from './panel-store';

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

describe('text that isn’t JSON (yggi/webmidi#15)', () => {
  it('reads as nothing kept, so loadBook migrates again and saves over it', () => {
    const storage = fakeStorage();
    storage.kept.set('k', '{not json');
    const migrated = renameSetup(newBook(), 's1', 'From before');
    expect(
      loadBook(
        localBookStore('k', () => storage),
        () => migrated,
      ),
    ).toEqual(migrated);
    expect(JSON.parse(storage.kept.get('k')!)).toEqual(migrated);
  });
});

describe('localPanelStore', () => {
  it('keeps the panels’ library under its key, and reads nothing from storage that is refused or isn’t JSON', () => {
    const kept = new Map<string, string>();
    const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
    const store = localPanelStore('panels', () => storage);
    expect(store.load()).toBeNull();
    const library = { version: 1 as const, panels: [{ id: 'a', name: 'A', children: [] }] };
    store.save(library);
    expect(readLibrary(store.load())).toEqual(library);
    kept.set('panels', '{not json');
    expect(store.load()).toBeNull();
    const refused = localPanelStore('panels', () => {
      throw new Error('refused');
    });
    expect(refused.load()).toBeNull();
    expect(() => refused.save(library)).not.toThrow();
  });
});
