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
import { delayText, nearestRank, ThruMeter, type ThruStats } from './thru';

/** The probe's controller (102 … 119 are undefined in the MIDI specification; 120 and up are channel modes) and its channel, from 1. */
export const LINK_CONTROLLER = 119;
export const LINK_CHANNEL = 16;
/** A probe number's values: 0 … 127, so a run longer than this wraps, and the meter counts its wraps. */
const MARKERS = 128;

/** How far ahead of the call a scheduled probe is stamped (ms): what a band's notes do. */
export const LINK_LEAD = 20;
/** How long a probe may take before it is counted lost (ms, after the time it was to leave). */
export const LINK_TIMEOUT = 250;
/** The runs: how many probes, how far apart (ms). Quick is 2 s, long is 60 s. */
export const LINK_RUNS = { quick: { probes: 100, spacing: 20 }, long: { probes: 600, spacing: 100 } } as const;
export type LinkLength = keyof typeof LINK_RUNS;
/** The shortest span of probes (ms) over which a drift is told from jitter: a quick run says "not measured". */
export const LINK_DRIFT_SPAN = 30_000;
/** How many probes of each kind (at once, scheduled) it takes to say whether timestamps are honoured. */
const HONOURED_MIN = 5;
/** The scheduled probes take the lead longer by at least this share of it: honoured; at most `1 − share`: not; between: not known. */
const HONOURED_SHARE = 0.75;

/** The tiers' limits, each tier up to and including its number; above the last is poor. SPECULATIVE. Jitter, drift in ms (drift in ms a minute), loss a share, played in ms. */
export const LINK_LIMITS = {
  jitter: [1, 3, 8],
  loss: [0, 0.002, 0.01],
  drift: [0.5, 2, 5],
  played: [6, 12, 25],
} as const;

export type LinkTier = 'tight' | 'good' | 'loose' | 'poor';
const TIERS: readonly LinkTier[] = ['tight', 'good', 'loose', 'poor'];

/** The probe's bytes: its number is the value, 0 … 127 over and over. */
export const probeBytes = (seq: number): [number, number, number] => [0xb0 | (LINK_CHANNEL - 1), LINK_CONTROLLER, seq % MARKERS];

/** A message's probe number (0 … 127), or null: it isn't a probe. */
export function probeMarker(data: ArrayLike<number>): number | null {
  const [status, controller, value] = [data[0], data[1], data[2]];
  if (status !== (0xb0 | (LINK_CHANNEL - 1)) || controller !== LINK_CONTROLLER || value === undefined || value > 127) return null;
  return value;
}

interface Probe {
  readonly seq: number;
  /** When `send` was called, and how far ahead it was stamped (0: at once). */
  readonly called: number;
  readonly ahead: number;
  /** Back (within the timeout), late (after it) or still out. */
  state: 'out' | 'back' | 'late';
  /** When it came back (`Tr`). */
  tr: number;
}

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

const median = (values: readonly number[]) =>
  nearestRank(
    [...values].sort((a, b) => a - b),
    0.5,
  );

export class LinkMeter {
  private readonly probes: Probe[] = [];
  private readonly lag = new ThruMeter(4096);
  private duplicates = 0;
  private outOfOrder = 0;
  private highest = -1;

  constructor(private readonly timeout = LINK_TIMEOUT) {}

  /**
   * A probe about to be sent: when `send` is called (ms on the page's clock) and how far ahead it is stamped (0: sent at
   * once, no timestamp). Returns its bytes to send.
   */
  sent(called: number, ahead = 0): { readonly seq: number; readonly bytes: [number, number, number] } {
    const seq = this.probes.length;
    this.probes.push({ seq, called, ahead, state: 'out', tr: NaN });
    return { seq, bytes: probeBytes(seq) };
  }

  /**
   * A message heard: its bytes, `Tr` (the event's `timeStamp`) and `Th` (`performance.now()` in the handler), on one
   * clock. Its page lag is kept; a probe is matched to the oldest probe of its number that is out and still within the
   * timeout (the number wraps, so a lost probe a wrap before is never matched), or counted late, a duplicate or foreign.
   */
  heard(data: ArrayLike<number>, tr: number, th: number): Heard {
    this.lag.add(tr, th);
    const marker = probeMarker(data);
    if (marker === null) return 'other';
    const same = this.probes.filter((p) => p.seq % MARKERS === marker);
    const open = same.filter((p) => p.state === 'out');
    const probe = open.find((p) => tr - (p.called + p.ahead) <= this.timeout) ?? open[0];
    if (!probe) return same.length ? (this.duplicates++, 'duplicate') : 'foreign';
    probe.tr = tr;
    if (tr - (probe.called + probe.ahead) > this.timeout) return ((probe.state = 'late'), 'late');
    probe.state = 'back';
    if (probe.seq < this.highest) this.outOfOrder++;
    this.highest = Math.max(this.highest, probe.seq);
    return 'matched';
  }

  /** The statistics at `now` (ms on the page's clock): a probe is lost once its timeout has passed. */
  stats(now: number): LinkStats {
    const back = this.probes.filter((p) => p.state === 'back');
    const lost = this.probes.filter((p) => p.state === 'late' || (p.state === 'out' && now - (p.called + p.ahead) > this.timeout)).length;
    const settled = back.length + lost;

    // are timestamps honoured: the scheduled probes take the lead longer, counted from the call, than the ones sent at once
    const since = (list: readonly Probe[]) => list.map((p) => p.tr - p.called);
    const scheduled = back.filter((p) => p.ahead > 0);
    const at_once = back.filter((p) => p.ahead === 0);
    let honoured: boolean | null = null;
    if (scheduled.length >= HONOURED_MIN && at_once.length >= HONOURED_MIN) {
      const lead = scheduled.reduce((sum, p) => sum + p.ahead, 0) / scheduled.length;
      const difference = median(since(scheduled)) - median(since(at_once));
      honoured = difference >= HONOURED_SHARE * lead ? true : difference <= (1 - HONOURED_SHARE) * lead ? false : null;
    }

    // the loop, from the time it left: the call, or (honoured) the time asked for; scheduled ones are left out when not known
    const samples = back
      .filter((p) => p.ahead === 0 || honoured !== null)
      .map((p) => {
        const left = p.ahead > 0 && honoured ? p.called + p.ahead : p.called;
        return { at: left, loop: p.tr - left };
      });
    const values = samples.map((s) => s.loop);
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length ? nearestRank(sorted, 0.5) : 0;
    const loop: LoopStats | null = sorted.length
      ? { count: sorted.length, median: mid, p95: nearestRank(sorted, 0.95), worst: sorted.at(-1)!, jitter: nearestRank(sorted, 0.95) - mid }
      : null;
    const mad = sorted.length
      ? nearestRank(
          values.map((v) => Math.abs(v - mid)).sort((a, b) => a - b),
          0.5,
        )
      : 0;

    return {
      method: this.probes.length ? 'loop' : 'passive',
      sent: this.probes.length,
      back: back.length,
      lost,
      loss: settled ? lost / settled : 0,
      outOfOrder: this.outOfOrder,
      duplicates: this.duplicates,
      outliers: values.filter((v) => v > mid + 3 * mad).length,
      wraps: this.probes.length ? Math.floor((this.probes.length - 1) / MARKERS) : 0,
      loop,
      drift: drift(samples),
      lag: this.lag.stats,
      timestampsHonoured: honoured,
    };
  }

  reset(): void {
    this.probes.length = 0;
    this.lag.reset();
    this.duplicates = this.outOfOrder = 0;
    this.highest = -1;
  }
}

/** The least-squares slope of the loop against time, in ms a minute; null over fewer than 3 samples or less than `LINK_DRIFT_SPAN`. */
function drift(samples: readonly { readonly at: number; readonly loop: number }[]): number | null {
  if (samples.length < 3) return null;
  const xs = samples.map((s) => s.at);
  if (Math.max(...xs) - Math.min(...xs) < LINK_DRIFT_SPAN) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = samples.reduce((a, s) => a + s.loop, 0) / samples.length;
  let num = 0;
  let den = 0;
  for (const s of samples) {
    num += (s.at - mx) * (s.loop - my);
    den += (s.at - mx) ** 2;
  }
  return (num / den) * 60_000;
}

// ---- the tier ---------------------------------------------------------------------------------------------------

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

interface Row {
  readonly text: string;
  readonly tier: LinkTier;
  /** From another tier's measure, capping this one. */
  readonly cap?: boolean;
}

const tierOf = (value: number, limits: readonly number[]): LinkTier => {
  const i = limits.findIndex((limit) => value <= limit);
  return TIERS[i === -1 ? 3 : i]!;
};
const worse = (a: LinkTier, b: LinkTier) => (TIERS.indexOf(a) >= TIERS.indexOf(b) ? a : b);
const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

/** A tier from its rows: the worst of them, and the reason names the rows that are at it (everything, when tight). */
function rate(rows: readonly Row[], notes: readonly string[] = [], suffix = ''): LinkRating | null {
  if (!rows.length) return null;
  const tier = rows.map((r) => r.tier).reduce(worse);
  const at = tier === 'tight' ? rows : rows.filter((r) => r.tier === tier);
  const own = at.filter((r) => !r.cap || tier === 'tight').map((r) => r.text);
  const capped = tier === 'tight' ? [] : at.filter((r) => r.cap).map((r) => r.text);
  const parts = [own.join(', '), capped.length ? `capped by ${capped.join(', ')}` : ''].filter(Boolean).join('; ');
  return { tier, reason: `${tier}: ${[parts + suffix, ...notes].filter(Boolean).join('; ')}` };
}

/**
 * The link's two tiers, the worst of each one's rows (limits in `LINK_LIMITS`, each tier up to and including its number).
 * **Scheduled** (the band sends ahead, the latency offset compensates; jitter and loss are what is left): from jitter,
 * loss, drift, and whether timestamps are honoured (not: poor, since sending ahead is the premise). **Played** (a hand
 * on a key, passed through): one way + page lag, capped by the jitter's tier. A tier needs its measures: with no loop
 * the page lag alone rates a played tier, said so, and there is no scheduled one. Speculative until hardware numbers.
 */
export function linkTier(m: LinkMeasures): { readonly scheduled: LinkRating | null; readonly played: LinkRating | null } {
  const jitter: Row | null = m.jitter === null ? null : { text: `jitter ${delayText(m.jitter)}`, tier: tierOf(m.jitter, LINK_LIMITS.jitter) };
  const scheduled: Row[] = [];
  if (jitter) scheduled.push(jitter);
  if (m.loss !== null) scheduled.push({ text: `loss ${pct(m.loss)}`, tier: tierOf(m.loss, LINK_LIMITS.loss) });
  if (m.drift !== null) scheduled.push({ text: `drift ${Math.round(m.drift * 10) / 10} ms/min`, tier: tierOf(Math.abs(m.drift), LINK_LIMITS.drift) });
  if (m.timestampsHonoured === false) scheduled.push({ text: 'timestamps not honoured', tier: 'poor' });

  const played: Row[] = [];
  let suffix = '';
  if (m.oneWay !== null || m.lag !== null) {
    const value = (m.oneWay ?? 0) + (m.lag ?? 0);
    const what = m.oneWay === null ? 'page lag' : m.lag === null ? 'one way' : 'one way + page lag';
    if (m.oneWay === null) suffix = ' (the loop was not measured)';
    played.push({ text: `${what} ${delayText(value)}`, tier: tierOf(value, LINK_LIMITS.played) });
    if (jitter) played.push({ ...jitter, cap: true });
  }
  return {
    scheduled: rate(scheduled, m.timestampsHonoured === null && scheduled.length ? ['timestamps honoured: not measured'] : []),
    played: rate(played, [], suffix),
  };
}

// ---- the report -------------------------------------------------------------------------------------------------

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
  readonly loss: { readonly lost: number; readonly of: number; readonly share: number };
  readonly outOfOrder: number;
  readonly duplicates: number;
  readonly outliers: number;
  readonly wraps: number;
  /** The page's own delay on the way in. */
  readonly lag: { readonly count: number; readonly median: number; readonly p95: number; readonly worst: number } | null;
  readonly timestampsHonoured: boolean | null;
  /** loop / 2: an assumption (`assumed`), one clock cannot tell the out from the in. */
  readonly oneWay: { readonly ms: number; readonly assumed: true } | null;
  /** 3 bytes against a long SysEx: not measured yet. */
  readonly wireMsPerByte: null;
  /** What is assumed here and not measured. */
  readonly assumes: readonly string[];
  readonly tier: { readonly scheduled: LinkTier | null; readonly played: LinkTier | null };
  readonly reasons: readonly string[];
  /** The limits are proposals until real hardware numbers replace them. */
  readonly tiersSpeculative: true;
}

/** The measures a tier is rated from, out of a run's statistics. */
export function measuresOf(stats: LinkStats): LinkMeasures {
  return {
    jitter: stats.loop?.jitter ?? null,
    loss: stats.loop ? stats.loss : null,
    drift: stats.drift,
    oneWay: stats.loop ? stats.loop.median / 2 : null,
    lag: stats.lag?.median ?? null,
    timestampsHonoured: stats.timestampsHonoured,
  };
}

/** A run's statistics as the report: what was measured, what was assumed, the tiers and their reasons. */
export function linkReport(info: LinkReportInfo, stats: LinkStats): LinkReport {
  const rated = linkTier(measuresOf(stats));
  return {
    report: 'webmidi link',
    ...info,
    method: stats.method,
    n: stats.sent,
    loop: stats.loop,
    drift: stats.drift,
    loss: { lost: stats.lost, of: stats.back + stats.lost, share: stats.loss },
    outOfOrder: stats.outOfOrder,
    duplicates: stats.duplicates,
    outliers: stats.outliers,
    wraps: stats.wraps,
    lag: stats.lag && { count: stats.lag.count, median: stats.lag.median, p95: stats.lag.p95, worst: stats.lag.worst },
    timestampsHonoured: stats.timestampsHonoured,
    oneWay: stats.loop ? { ms: stats.loop.median / 2, assumed: true } : null,
    wireMsPerByte: null,
    assumes: ['one way is the loop divided by 2: one clock cannot tell the out from the in', 'wire time per byte is not measured'],
    tier: { scheduled: rated.scheduled?.tier ?? null, played: rated.played?.tier ?? null },
    reasons: [rated.scheduled && `scheduled: ${rated.scheduled.reason}`, rated.played && `played: ${rated.played.reason}`].filter((r): r is string => !!r),
    tiersSpeculative: true,
  };
}
