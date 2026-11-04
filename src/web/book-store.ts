// The patchbay's book kept in the browser (core's `BookStore`, decision 002): JSON under a key the frontend names.

import type { BookStore, SetupBook } from '../core/setups';

/** What `localStorage` is, as far as a store needs it: a test passes its own. */
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * A book kept under `key` in `localStorage` (or `storage`): what was kept, parsed (junk is `readBook`'s to drop), or
 * null; nothing at all when storage is refused (a private window, blocked site data), so the book lives for the page.
 *
 * Text that isn't JSON reads as nothing kept, on purpose: `loadBook` then runs the frontend's migration again and saves
 * its book over the text. A book that can't be parsed holds nothing to recover, and the frontend's store from before
 * is the nearest thing to what the person chose (decision 002).
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
