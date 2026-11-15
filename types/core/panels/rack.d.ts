/**
 * The panels a setup has active, playing (decision 007): one `PanelRuntime` for each, kept while its panel is the
 * same, so a panel plays on, and follows what it is sent, whether or not a view shows it. A panel taken out, or
 * replaced by an edit, is silenced first, and what that sends is handed back to be sent on its row.
 */
import type { PanelLibrary } from './library';
import { PanelRuntime } from './runtime';
export declare class PanelRack {
    private readonly playing;
    /**
     * The panels active now, by id, from the library: runtimes made for those new or changed, and each one gone or
     * replaced silenced, its note-offs returned by panel id. One the library lacks has no runtime.
     */
    sync(active: readonly string[], library: PanelLibrary): {
        panel: string;
        data: number[];
    }[];
    /** A panel's runtime, or undefined: not active, or not in the library. */
    runtime(id: string): PanelRuntime | undefined;
    /** Messages for panels (`panelForwardsOf`) handed to each one's runtime. */
    receive(forwards: readonly {
        readonly panel: string;
        readonly data: readonly number[];
    }[]): void;
}
