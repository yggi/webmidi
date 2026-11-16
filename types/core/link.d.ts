/**
 * The MIDI link, measured as far as a page can (yggi/webmidi#75): a probe goes out on a port at a time the page chose and
 * comes back on an input of a loop (a cable from an out to an in, or a device that echoes), and the page keeps three
 * times of it. `Ts`, when it was told to leave; `Tr`, the event's `timeStamp` (when the browser had it from the OS); `Th`,
 * `performance.now()` in the handler. From them:
 *
 * - page lag = `Th − Tr`: the page's own delay on the way in (what `ThruMeter` reads), kept for every message heard, so a
 *   connection can be watched passively, while the band plays, with no probes;
 * - loop = `Tr − Ts`: output path, wire, device, wire, input path. Measured. One clock cannot tell the out from the in;
 * - one way = loop / 2: an ASSUMPTION, never a measure; the report says so.
 *
 * The link is not the device's latency offset (its profile): that compensates the time from a message to its sound and
 * is not set from this. Nor is it the audio chain's.
 *
 * Pure: the frontend gives the times, and `web/link-probe.ts` runs the probes. The marker is a control change on a
 * controller no instrument is known to use, on channel 16, with the probe's number as its value. The tiers are
 * SPECULATIVE until real hardware numbers replace the limits (`LINK_LIMITS`).
 */
import { type ThruStats } from './thru';
/** The probe's controller (102 … 119 are undefined in the MIDI specification; 120 and up are channel modes) and its channel, from 1. */
export declare const LINK_CONTROLLER = 119;
export declare const LINK_CHANNEL = 16;
/** How far ahead of the call a scheduled probe is stamped (ms): what a band's notes do. */
export declare const LINK_LEAD = 20;
/** How long a probe may take before it is counted lost (ms, after the time it was to leave). */
export declare const LINK_TIMEOUT = 250;
/** The runs: how many probes, how far apart (ms). Quick is 2 s, long is 60 s. */
export declare const LINK_RUNS: {
    readonly quick: {
        readonly probes: 100;
        readonly spacing: 20;
    };
    readonly long: {
        readonly probes: 600;
        readonly spacing: 100;
    };
};
export type LinkLength = keyof typeof LINK_RUNS;
/** The shortest span of probes (ms) over which a drift is told from jitter: a quick run says "not measured". */
export declare const LINK_DRIFT_SPAN = 30000;
/** The tiers' limits, each tier up to and including its number; above the last is poor. SPECULATIVE. Jitter, drift in ms (drift in ms a minute), loss a share, played in ms. */
export declare const LINK_LIMITS: {
    readonly jitter: readonly [1, 3, 8];
    readonly loss: readonly [0, 0.002, 0.01];
    readonly drift: readonly [0.5, 2, 5];
    readonly played: readonly [6, 12, 25];
};
export type LinkTier = 'tight' | 'good' | 'loose' | 'poor';
/** The probe's bytes: its number is the value, 0 … 127 over and over. */
export declare const probeBytes: (seq: number) => [number, number, number];
/** A message's probe number (0 … 127), or null: it isn't a probe. */
export declare function probeMarker(data: ArrayLike<number>): number | null;
/** What a message heard was. */
export type Heard = 'matched' | 'late' | 'duplicate' | 'foreign' | 'other';
/** The loop over the probes back, in ms. */
export interface LoopStats {
    readonly count: number;
    readonly median: number;
    readonly p95: number;
    readonly worst: number;
    /** p95 − median. */
    readonly jitter: number;
}
export interface LinkStats {
    /** `loop` when probes were sent, `passive` when only messages were heard. */
    readonly method: 'loop' | 'passive';
    readonly sent: number;
    readonly back: number;
    /** Not back within the timeout (so far: one still within it is pending, not lost). */
    readonly lost: number;
    /** Of the probes whose time has come, a share, 0 … 1. */
    readonly loss: number;
    readonly outOfOrder: number;
    readonly duplicates: number;
    /** Loops beyond the median plus 3 × the median absolute deviation. */
    readonly outliers: number;
    /** How many times the probe number has wrapped. */
    readonly wraps: number;
    readonly loop: LoopStats | null;
    /** The loop's least-squares slope against time, ms a minute; null over a run too short to tell it from jitter. */
    readonly drift: number | null;
    /** Page lag over the messages heard (`ThruStats`: the last 4096). */
    readonly lag: ThruStats | null;
    /** Whether a scheduled probe left at its time; null: not known (too few probes of either kind, or a difference between). */
    readonly timestampsHonoured: boolean | null;
}
export declare class LinkMeter {
    private readonly timeout;
    private readonly probes;
    private readonly lag;
    private duplicates;
    private outOfOrder;
    private highest;
    constructor(timeout?: number);
    /**
     * A probe about to be sent: when `send` is called (ms on the page's clock) and how far ahead it is stamped (0: sent at
     * once, no timestamp). Returns its bytes to send.
     */
    sent(called: number, ahead?: number): {
        readonly seq: number;
        readonly bytes: [number, number, number];
    };
    /**
     * A message heard: its bytes, `Tr` (the event's `timeStamp`) and `Th` (`performance.now()` in the handler), on one
     * clock. Its page lag is kept; a probe is matched to the oldest probe of its number that is out and still within the
     * timeout (the number wraps, so a lost probe a wrap before is never matched), or counted late, a duplicate or foreign.
     */
    heard(data: ArrayLike<number>, tr: number, th: number): Heard;
    /** The statistics at `now` (ms on the page's clock): a probe is lost once its timeout has passed. */
    stats(now: number): LinkStats;
    reset(): void;
}
/** What a tier is rated from, each null when it was not measured. */
export interface LinkMeasures {
    /** The loop's jitter, ms. */
    readonly jitter: number | null;
    /** A share, 0 … 1. */
    readonly loss: number | null;
    /** ms a minute, up or down. */
    readonly drift: number | null;
    /** The loop's median / 2: an assumption. */
    readonly oneWay: number | null;
    /** The page lag's median, ms. */
    readonly lag: number | null;
    readonly timestampsHonoured: boolean | null;
}
export interface LinkRating {
    readonly tier: LinkTier;
    /** In words: "loose: jitter 4.1 ms", "loose: capped by jitter 4.1 ms". */
    readonly reason: string;
}
/**
 * The link's two tiers, the worst of each one's rows (limits in `LINK_LIMITS`, each tier up to and including its number).
 * **Scheduled** (the band sends ahead, the latency offset compensates; jitter and loss are what is left): from jitter,
 * loss, drift, and whether timestamps are honoured (not: poor, since sending ahead is the premise). **Played** (a hand
 * on a key, passed through): one way + page lag, capped by the jitter's tier. A tier needs its measures: with no loop
 * the page lag alone rates a played tier, said so, and there is no scheduled one. Speculative until hardware numbers.
 */
export declare function linkTier(m: LinkMeasures): {
    readonly scheduled: LinkRating | null;
    readonly played: LinkRating | null;
};
/** What a frontend says about the run: when (ISO 8601), the ports' names, the browser and OS (the user agent). */
export interface LinkReportInfo {
    readonly at: string;
    readonly output: string;
    readonly input: string | null;
    readonly environment: string;
}
/** The JSON a frontend's timing export carries. Every number is measured except `oneWay` and `wireMsPerByte`, which says so. */
export interface LinkReport extends LinkReportInfo {
    readonly report: 'webmidi link';
    readonly method: 'loop' | 'passive';
    /** Probes sent. */
    readonly n: number;
    readonly loop: LoopStats | null;
    readonly drift: number | null;
    readonly loss: {
        readonly lost: number;
        readonly of: number;
        readonly share: number;
    };
    readonly outOfOrder: number;
    readonly duplicates: number;
    readonly outliers: number;
    readonly wraps: number;
    /** The page's own delay on the way in. */
    readonly lag: {
        readonly count: number;
        readonly median: number;
        readonly p95: number;
        readonly worst: number;
    } | null;
    readonly timestampsHonoured: boolean | null;
    /** loop / 2: an assumption (`assumed`), one clock cannot tell the out from the in. */
    readonly oneWay: {
        readonly ms: number;
        readonly assumed: true;
    } | null;
    /** 3 bytes against a long SysEx: not measured yet. */
    readonly wireMsPerByte: null;
    /** What is assumed here and not measured. */
    readonly assumes: readonly string[];
    readonly tier: {
        readonly scheduled: LinkTier | null;
        readonly played: LinkTier | null;
    };
    readonly reasons: readonly string[];
    /** The limits are proposals until real hardware numbers replace them. */
    readonly tiersSpeculative: true;
}
/** The measures a tier is rated from, out of a run's statistics. */
export declare function measuresOf(stats: LinkStats): LinkMeasures;
/** A run's statistics as the report: what was measured, what was assumed, the tiers and their reasons. */
export declare function linkReport(info: LinkReportInfo, stats: LinkStats): LinkReport;
