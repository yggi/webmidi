/**
 * `@yggi/webmidi/ui`: the patchbay's components, Svelte 5, shipped as source (docs/proposals/patchbay.md, decision 001).
 * Presentational: a frontend owns the connection and the book (core's `setups.ts`) and passes what they say; each
 * component calls back with what was asked. Colours come from `--wm-*` custom properties, falling back to a neutral
 * palette in both themes.
 */
export { default as MidiStatus } from './MidiStatus.svelte';
export { default as DeviceInspector } from './DeviceInspector.svelte';
export { default as ChannelMeter } from './ChannelMeter.svelte';
export { default as PatchMatrix } from './PatchMatrix.svelte';
export { default as ChannelPicker } from './ChannelPicker.svelte';
export { default as SetupPicker } from './SetupPicker.svelte';
export { inputRows, type MatrixRow } from './rows';
export { CHANNELS, channelHue } from './channels';
