import type { BookStore } from '../core/setups';
/** What `localStorage` is, as far as a store needs it: a test passes its own. */
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;
/**
 * A book kept under `key` in `localStorage` (or `storage`): what was kept, parsed (junk is `readBook`'s to drop), or
 * null; nothing at all when storage is refused (a private window, blocked site data), so the book lives for the page.
 */
export declare function localBookStore(key: string, storage?: () => KeyValue): BookStore;
export {};
