/**
 * `@yggi/webmidi/ui/panels`: control panels to play (decision 005), Svelte 5, shipped as source: `PanelView`, a panel
 * laid out and driven by core's `PanelRuntime`, and `Keys`, the on-screen keyboard, which stands on its own too. The
 * other widgets (knob, fader, XY pad, button and switch, drum pads) are the view's. A surface of its own, outside what
 * `@yggi/webmidi/ui` promises.
 */
export { default as PanelView } from './PanelView.svelte';
export { default as Keys } from './Keys.svelte';
