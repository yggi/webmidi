// The rows a frontend hands the patch matrix (docs/proposals/patchbay.md): webmidi doesn't know what a voice is.

import type { PortOption } from '../core/port';
import { ANY_INPUT, inputRow, type Routes } from '../core/setups';

/**
 * A row of the matrix. `voice` and `kit` send on a channel; a `member` of a kit shows the note each output's drum map
 * sends it as, where its kit is routed; an `empty` row (a seat no part sits in) is hidden until asked for; an `input`
 * is one of the inputs plugged in, which the matrix adds itself.
 */
export interface MatrixRow {
  readonly id: string;
  readonly label: string;
  /** A word after the label: a seat's part. */
  readonly sub?: string;
  readonly kind: 'voice' | 'kit' | 'member' | 'empty' | 'input';
  /** A member's General MIDI note. */
  readonly note?: number;
  /** A rule drawn above it: the first of a group (the kit, the inputs). */
  readonly group?: boolean;
}

/**
 * The inputs' rows, after the frontend's: each input plugged in, then each one the routes still send from that isn't
 * (said so), then every input (`ANY_INPUT`) when the routes send from it.
 */
export function inputRows(plugged: readonly PortOption[], routes: Routes): MatrixRow[] {
  const rows: MatrixRow[] = plugged.map((p) => ({ id: inputRow(p), label: p.name || p.id, kind: 'input' }));
  for (const [id, crossings] of Object.entries(routes)) {
    if (!id.startsWith('in:') || id === ANY_INPUT || rows.some((r) => r.id === id) || !Object.keys(crossings).length) continue;
    rows.push({ id, label: id.slice(3), sub: 'not plugged in', kind: 'input' });
  }
  if (Object.keys(routes[ANY_INPUT] ?? {}).length) rows.push({ id: ANY_INPUT, label: 'All inputs', kind: 'input' });
  return rows.map((r, i) => (i === 0 ? { ...r, group: true } : r));
}
