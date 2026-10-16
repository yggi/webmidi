// Lifted from yggi/cell-studio src/midi/clock-out.test.ts @ 3813fbb. There the ticks came from a piece compiled by cells
// (`&bar scan(1 1 1 1) step=120bpm`, its windows' `ticksBetween`, retimed); here from a steady grid at the same tempo
// (`piece(bpm)`, and `windowAt` and `retime` that stand in for cells' over it), since webmidi doesn't read the language.
import { describe, expect, it } from 'vitest';
import { ClockOut, PPQN, type ClockTicks } from './clock-out';
import { fakePort } from './fixtures';

const TICK = 0xf8;
const START = 0xfa;
const CONTINUE = 0xfb;
const STOP = 0xfc;
const SPP = 0xf2;

/** Seconds to milliseconds, one to one, so timestamps in tests read as seconds. */
const toDeviceMs = (seconds: number) => seconds * 1000;

/** A steady grid of ticks: a beat of 4/4 at `bpm`, held (as a piece's main meter at that tempo, or a `free()` tempo held). */
type Plan = { readonly tick: number };
const piece = (bpm: number): Plan => ({ tick: 60 / bpm / PPQN });

/** The ticks in [from, from + length) code seconds, as cells' `ticksBetween` lays them on a steady grid: each from its own index. */
type Window = { readonly from: number; readonly clock: ClockTicks | null };
const windowAt = (p: Plan, from: number, length: number): Window => {
  const first = Math.max(0, Math.ceil(from / p.tick - 1e-9));
  const at: number[] = [];
  for (let k = first; k * p.tick < from + length; k++) at.push(k * p.tick);
  return { from, clock: at.length ? { first, at, before: first > 0 ? (first - 1) * p.tick : -Infinity } : null };
};

/** A window's ticks put onto the audio clock (cells' `retime`): code second x sounds at `time + (x − from) × scale`. */
const retime = (w: Window, time: number, scale: number): { clock: ClockTicks | null } => {
  const to = (x: number) => time + (x - w.from) * scale;
  return { clock: w.clock && { first: w.clock.first, at: w.clock.at.map(to), before: to(w.clock.before) } };
};
const AT_120 = piece(120);
/** A tick's spacing at 120 bpm. */
const T120 = 0.5 / PPQN;

/**
 * The player, as far as the clock sees it: windows of 0.25 code seconds from `cursor`, the first heard at audio second
 * `start`, sent to `out` up to (not including) code second `to`.
 */
function run(out: ClockOut, p: Plan, cursor: number, start: number, to: number, ms = toDeviceMs) {
  for (let x = cursor; x < to - 1e-9; x += 0.25) out.play(retime(windowAt(p, x, 0.25), start + (x - cursor), 1).clock, ms);
}

const made = () => {
  const port = fakePort('out', 'Drums');
  return { out: new ClockOut(port), sent: port.sent };
};
const ticks = (sent: { data: number[]; timestamp?: number }[]) => sent.filter((m) => m.data[0] === TICK).map((m) => m.timestamp! / 1000);
const kinds = (sent: { data: number[] }[]) =>
  sent
    .map((m) => ({ [TICK]: 't', [START]: 'Start', [CONTINUE]: 'Continue', [STOP]: 'Stop', [SPP]: 'SPP' })[m.data[0]] ?? '?')
    .filter((k, i, all) => k !== 't' || all[i - 1] !== 't')
    .map((k) => (k === 't' ? 'ticks' : k))
    .join(' ');
const position = (m: { data: number[] }) => m.data[1] | (m.data[2] << 7);

describe('ClockOut', () => {
  it('sends nothing without a port, or without ticks', () => {
    const out = new ClockOut(null);
    expect(() => run(out, AT_120, 0, 0, 2)).not.toThrow();
    const { out: o, sent } = made();
    o.play(null, toDeviceMs);
    expect(sent).toEqual([]);
  });

  it('sends Start 2 ms before the first tick, then 96 ticks to a 4/4 bar, each where its index puts it', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 1, 2);
    expect(sent[0]).toEqual({ data: [START], timestamp: 998 });
    const t = ticks(sent);
    expect(t).toHaveLength(96);
    t.forEach((x, k) => expect(x).toBeCloseTo(1 + k * T120, 9));
  });

  it('sends Stop on stopping, just after the last tick already sent, and no tick after it', () => {
    const { out, sent } = made();
    // (sent ahead to 1.5 s, stopped at 1 s: what was sent can't be taken back)
    run(out, AT_120, 0, 0, 1.5);
    out.stop(1, toDeviceMs);
    const last = ticks(sent).at(-1)!;
    expect(sent.at(-1)!.data).toEqual([STOP]);
    expect(sent.at(-1)!.timestamp! / 1000).toBeCloseTo(last + 0.001, 9);
    out.stop(1.2, toDeviceMs);
    expect(sent.filter((m) => m.data[0] === STOP)).toHaveLength(1);
  });

  it('Stop at once when nothing was sent ahead', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 0, 1);
    out.stop(3, toDeviceMs);
    expect(sent.at(-1)).toEqual({ data: [STOP], timestamp: 3000 });
  });

  it('Pause and Play quickly: Stop after what was sent ahead, then the Song Position and Continue, ticks on from the next 16th; none doubled', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 0, 1.5);
    out.stop(1, toDeviceMs);
    // (played again 0.1 s later from where it was heard, 0.95: Play sounds 0.05 s after the press)
    run(out, AT_120, 0.95, 1.15, 3);
    expect(kinds(sent)).toBe('Start ticks Stop SPP Continue ticks');
    const stopAt = sent.find((m) => m.data[0] === STOP)!.timestamp!;
    const spp = sent.find((m) => m.data[0] === SPP)!;
    const cont = sent.findIndex((m) => m.data[0] === CONTINUE);
    const first = sent[cont + 1];
    expect(spp.timestamp!).toBeGreaterThan(stopAt);
    expect(sent[cont].timestamp!).toBeCloseTo(first.timestamp! - 2, 9);
    // (the position it says is where the first tick after it falls: 16th p is tick 6p, at code second 6p·T120)
    const k = position(spp) * 6;
    expect(first.timestamp! / 1000).toBeCloseTo(1.15 + (k * T120 - 0.95), 9);
    // (it picks up after the ticks already sent: nothing lands before the Stop that follows them)
    expect(first.timestamp!).toBeGreaterThan(stopAt);
    const t = ticks(sent);
    expect(t.every((x, i) => i === 0 || x > t[i - 1])).toBe(true);
  });

  it('a seek back: Stop, then the Song Position of the place sought and Continue', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 0, 4.5);
    out.stop(4, toDeviceMs);
    run(out, AT_120, 0.3, 4.05, 2);
    expect(kinds(sent)).toBe('Start ticks Stop SPP Continue ticks');
    const spp = sent.find((m) => m.data[0] === SPP)!;
    const cont = sent.findIndex((m) => m.data[0] === CONTINUE);
    // (the first 16th from 0.3 s that falls after the Stop: the run picks up after what was sent ahead)
    expect(sent[cont + 1].timestamp! / 1000).toBeCloseTo(4.05 + (position(spp) * 6 * T120 - 0.3), 9);
    expect(sent[cont + 1].timestamp!).toBeGreaterThan(sent.find((m) => m.data[0] === STOP)!.timestamp!);
  });

  it('played from the start again (Stop, then Play): Start, not Continue', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 0, 1);
    out.stop(1, toDeviceMs);
    run(out, AT_120, 0, 2, 1);
    expect(kinds(sent)).toBe('Start ticks Stop Start ticks');
  });

  it('switched on while playing: the Song Position and Continue before the next 16th', () => {
    const { out, sent } = made();
    out.play(retime(windowAt(AT_120, 1.1, 0.25), 1.1, 1).clock, toDeviceMs);
    expect(kinds(sent)).toBe('SPP Continue ticks');
    expect(position(sent[0])).toBe(Math.ceil(1.1 / T120 / 6));
  });

  it('a tempo moved while playing (a held free()): it follows the new grid from the next window, none doubled, none added', () => {
    const slow = piece(112);
    const fast = piece(130);
    for (const [a, b] of [
      [slow, fast],
      [fast, slow],
    ]) {
      for (const at of [10, 10.25, 37.5]) {
        const { out, sent } = made();
        run(out, a, 0, 0, at);
        const n = ticks(sent).length;
        run(out, b, at, at, at + 10);
        const t = ticks(sent);
        const [pa, pb] = [a, b].map((p) => (p === slow ? 60 / 112 : 60 / 130) / PPQN);
        // (every gap: at least half a tick of the new grid, at most a tick of each)
        const gaps = t.slice(1).map((x, i) => x - t[i]);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.min(pa, pb) / 2 - 1e-9);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(pa + pb + 1e-9);
        // (after the change, the new grid's own ticks: one at most left out where the grids meet)
        const after = Math.round(10 / pb);
        expect(t.length - n).toBeGreaterThanOrEqual(after - 1);
        expect(t.length - n).toBeLessThanOrEqual(after + 1);
        expect(kinds(sent)).toBe('Start ticks');
      }
    }
  });

  it('each timestamp no earlier than the one before, when the clock offset jumps back between windows', () => {
    const { out, sent } = made();
    run(out, AT_120, 0, 0, 1);
    run(out, AT_120, 1, 1, 2, (s) => s * 1000 - 8);
    const ms = sent.map((m) => m.timestamp!);
    expect(ms.every((x, i) => i === 0 || x >= ms[i - 1])).toBe(true);
    expect(ticks(sent)).toHaveLength(96);
  });

  it('never a timestamp in the past, and a port that throws is ignored', () => {
    const { out, sent } = made();
    out.play(retime(windowAt(AT_120, 0, 0.25), 0, 1).clock, (s) => s * 1000 - 50);
    expect(sent.every((m) => m.timestamp! >= 0)).toBe(true);
    const throws = new ClockOut({
      send: () => {
        throw new Error('unplugged');
      },
    });
    expect(() => run(throws, AT_120, 0, 0, 1)).not.toThrow();
    expect(() => throws.stop(1, toDeviceMs)).not.toThrow();
  });
});
