// The channels as the patchbay draws them (docs/proposals/patchbay.md): one hue each, the same in every component; a crossing's channels (a set of them, decision 010) as a chip says them.

import { AS_PLAYED, channelsOf, type Crossing } from '../core/setups';

/** The 16 MIDI channels, 1–16. */
export const CHANNELS: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1);

/** A channel's hue in degrees: the 16 spread round the wheel, so a cable to channel 10 is the same colour in the matrix, the picker and the meter. */
export const channelHue = (channel: number): number => ((channel - 1) * 22.5 + 12) % 360;

/** A number typed into a field, rounded into lo … hi (not a number: `fallback`), as core's `withProfile` keeps it. */
export const clamp = (v: number, lo: number, hi: number, fallback: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback);

/**
 * A crossing as its chip says it (decision 010): "=" as played, a channel's number, a set of 2 or 3 joined by "+" ("1+3"),
 * and from 4 channels their count ("×4"), which stays as wide as a chip is; `crossingWords` says every channel.
 * Ranges ("1–3") are not used: they read as a count of channels, and a set is seldom a run.
 */
export const crossingText = (c: Crossing): string => {
  const channels = channelsOf(c);
  return c === AS_PLAYED ? '=' : channels.length > 3 ? `×${channels.length}` : channels.join('+');
};

/** A crossing in words, for a label or a title: "as played", "channel 1", "channels 1 and 3", "channels 1, 3 and 5". */
export const crossingWords = (c: Crossing): string => {
  const channels = channelsOf(c);
  if (c === AS_PLAYED) return 'as played';
  if (channels.length === 1) return `channel ${channels[0]}`;
  return `channels ${channels.slice(0, -1).join(', ')} and ${channels.at(-1)}`;
};
