// The channels as the patchbay draws them (docs/proposals/patchbay.md): one hue each, the same in every component.

/** The 16 MIDI channels, 1–16. */
export const CHANNELS: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1);

/** A channel's hue in degrees: the 16 spread round the wheel, so a cable to channel 10 is the same colour in the matrix, the picker and the meter. */
export const channelHue = (channel: number): number => ((channel - 1) * 22.5 + 12) % 360;

/** A number typed into a field, rounded into lo … hi (not a number: `fallback`), as core's `withProfile` keeps it. */
export const clamp = (v: number, lo: number, hi: number, fallback: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback);
