/**
 * The panels a setup has active, playing (decision 007): one `PanelRuntime` for each, kept while its panel is the
 * same, so a panel plays on, and follows what it is sent, whether or not a view shows it. A panel taken out, or
 * replaced by an edit, is silenced first, and what that sends is handed back to be sent on its row.
 */
import type { PanelLibrary } from './library';
import { PanelRuntime } from './runtime';

export class PanelRack {
  private readonly playing = new Map<string, PanelRuntime>();

  /**
   * The panels active now, by id, from the library: runtimes made for those new or changed, and each one gone or
   * replaced silenced, its note-offs returned by panel id. One the library lacks has no runtime.
   */
  sync(active: readonly string[], library: PanelLibrary): { panel: string; data: number[] }[] {
    const released: { panel: string; data: number[] }[] = [];
    const wanted = new Map(active.flatMap((id) => library.panels.filter((p) => p.id === id).map((p) => [id, p] as const)));
    for (const [id, runtime] of [...this.playing]) {
      if (wanted.get(id) === runtime.source) continue;
      for (const data of runtime.silence()) released.push({ panel: id, data });
      this.playing.delete(id);
    }
    for (const [id, panel] of wanted) if (!this.playing.has(id)) this.playing.set(id, new PanelRuntime(panel));
    return released;
  }

  /** A panel's runtime, or undefined: not active, or not in the library. */
  runtime(id: string): PanelRuntime | undefined {
    return this.playing.get(id);
  }

  /** Messages for panels (`panelForwardsOf`) handed to each one's runtime. */
  receive(forwards: readonly { readonly panel: string; readonly data: readonly number[] }[]): void {
    for (const f of forwards) this.playing.get(f.panel)?.receive(f.data);
  }
}
