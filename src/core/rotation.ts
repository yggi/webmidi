// Lifted from yggi/cells src/engine/midi.ts @ 41ef16b (`Rotation`; `rotationChannels`, which knows a piece's kit, stays there).

/**
 * MPE-style channels for microtonal pieces: a note takes, from `channels`, one that nothing still sounds on (the one
 * free longest), so notes with different bends never share a channel; when all are busy, the one that frees first.
 */
export class Rotation {
  #busy = new Map<number, number>();
  constructor(readonly channels: readonly number[]) {}

  take(end: number): number {
    // (the channel whose last note ends earliest: free longest if any is free, else the first to free)
    let best = this.channels[0]!;
    for (const c of this.channels) if ((this.#busy.get(c) ?? -Infinity) < (this.#busy.get(best) ?? -Infinity)) best = c;
    this.#busy.set(best, Math.max(end, this.#busy.get(best) ?? -Infinity));
    return best;
  }

  forget(): void {
    this.#busy.clear();
  }
}
