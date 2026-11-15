// The panels' library kept in the browser (`PanelStore`, decision 005): JSON under a key the frontend names, as the
// book is (`book-store.ts`).

import type { PanelLibrary, PanelStore } from '../core/panels/index';

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * A library kept under `key` in `localStorage` (or `storage`): what was kept, parsed (junk is `readLibrary`'s to
 * drop), or null; nothing at all when storage is refused or its text isn't JSON, so the library lives for the page.
 */
export function localPanelStore(key: string, storage: () => KeyValue = () => localStorage): PanelStore {
  return {
    load() {
      try {
        const text = storage().getItem(key);
        return text === null ? null : (JSON.parse(text) as unknown);
      } catch {
        return null;
      }
    },
    save(library: PanelLibrary) {
      try {
        storage().setItem(key, JSON.stringify(library));
      } catch {
        // refused or full: the library stays in memory for this page
      }
    },
  };
}
