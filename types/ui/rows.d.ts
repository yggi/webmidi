import type { PortOption } from '../core/port';
import { type PlaysChoice, type Routes } from '../core/setups';
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
    /** What part it is (`'lead'`, `'drums'`), for an input that plays it to find it again elsewhere, and for a preset. */
    readonly role?: string;
    /**
     * Whether an input can play it (offered in an input's Plays choice): by default a voice or a kit can. A frontend
     * that plays along on some parts alone says so (Jambot's bass, pad and stab, its keys' row: false).
     */
    readonly playable?: boolean;
}
/**
 * The inputs' rows, after the frontend's: each input plugged in, then each one the routes still send from, or that has
 * a choice of what it plays, that isn't (said so), then every input (`ANY_INPUT`) when the routes send from it or it
 * has a choice.
 */
export declare function inputRows(plugged: readonly PortOption[], routes: Routes, plays?: Readonly<Record<string, PlaysChoice>>): MatrixRow[];
