import type { PanelStore } from '../core/panels/index';
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;
/**
 * A library kept under `key` in `localStorage` (or `storage`): what was kept, parsed (junk is `readLibrary`'s to
 * drop), or null; nothing at all when storage is refused or its text isn't JSON, so the library lives for the page.
 */
export declare function localPanelStore(key: string, storage?: () => KeyValue): PanelStore;
export {};
