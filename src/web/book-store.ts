// The patchbay's book kept in the browser (core's `BookStore`, decision 002): JSON under a key the frontend names.

import type { BookStore, SetupBook } from '../core/setups';

/** What `localStorage` is, as far as a store needs it: a test passes its own. */
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * A book kept under `key` in `localStorage` (or `storage`): what was kept, parsed (junk is `readBook`'s to drop), or
 * null; nothing at all when storage is refused (a private window, blocked site data), so the book lives for the page.
 */
export function localBookStore(key: string, storage: () => KeyValue = () => localStorage): BookStore {
  return {
    load() {
      try {
        const text = storage().getItem(key);
        return text === null ? null : (JSON.parse(text) as unknown);
      } catch {
        return null;
      }
    },
    save(book: SetupBook) {
      try {
        storage().setItem(key, JSON.stringify(book));
      } catch {
        // refused or full: the book stays in memory for this page
      }
    },
  };
}
