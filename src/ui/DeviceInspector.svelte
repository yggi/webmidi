<script lang="ts">
  /**
   * One output of the setup in use, in full (docs/proposals/patchbay.md, `DeviceInspector`): the port it sends to (one
   * not plugged in kept and said so), then its device's profile, kept with the device in every setup (decision 002): clock,
   * drum map, bend range, a channel per note (MPE), latency. Under them the channels routed here, a test note, notes off
   * here, and removing the output. Presentational: a change is a call back (`onport`, `onprofile`), which the frontend
   * makes with core's `chooseDevice` and `withProfile`.
   */
  import { DRUM_PRESETS, presetNameOf } from '../core/drum-presets';
  import type { PortOption } from '../core/port';
  import type { DeviceProfile, SetupOutput } from '../core/setups';
  import ChannelMeter from './ChannelMeter.svelte';
  import { clamp } from './channels';

  interface Props {
    output: SetupOutput;
    /** Its place in the setup, from 1. */
    slot: number;
    /** The outputs plugged in now. */
    ports: readonly PortOption[];
    profile: DeviceProfile;
    /** The channels routed to it. */
    used?: readonly number[];
    /** The channels sounding on it now. */
    lit?: ReadonlySet<number>;
    /** Whether a kit is routed here, so its drum map matters. */
    drums?: boolean;
    canRemove?: boolean;
    onport: (port: PortOption) => void;
    onprofile: (change: Partial<DeviceProfile>) => void;
    ontest?: () => void;
    onpanic?: () => void;
    onremove?: () => void;
  }

  let { output, slot, ports, profile, used = [], lit, drums = true, canRemove = false, onport, onprofile, ontest, onpanic, onremove }: Props = $props();

  const none = $derived(output.id === 'none');
  const plugged = $derived(!none && ports.some((p) => p.id === output.id || (!!output.name && p.name === output.name)));
  const title = $derived(none ? 'No device' : output.name || output.id);
  const preset = $derived(presetNameOf(profile.drums));
  const uid = $props.id();

  /** A number field set: clamped as core keeps it, shown so at once (a value clamped to the one there changes no prop, so nothing would redraw it). */
  function typed(e: Event & { currentTarget: HTMLInputElement }, lo: number, hi: number, fallback: number, set: (n: number) => void) {
    const n = clamp(e.currentTarget.valueAsNumber, lo, hi, fallback);
    e.currentTarget.value = String(n);
    set(n);
  }

  function choosePort(id: string) {
    if (id === output.id) return;
    onport(id === 'none' ? { id: 'none', name: '' } : (ports.find((p) => p.id === id) ?? { id, name: '' }));
  }
</script>

<section class="wm-inspector" aria-labelledby="{uid}-title">
  <div class="block">
    <p class="eyebrow"><span class="led" class:on={plugged} aria-hidden="true"></span>Out {slot}</p>
    <h3 id="{uid}-title">{title}</h3>
    <label class="field">
      <span>Port</span>
      <select value={output.id} onchange={(e) => choosePort(e.currentTarget.value)}>
        <option value="none">No device</option>
        {#each ports as p (p.id)}<option value={p.id}>{p.name || p.id}</option>{/each}
        {#if !none && !plugged}<option value={output.id}>{output.name || output.id} (not plugged in)</option>{/if}
      </select>
    </label>
    {#if !none && !plugged}<p class="warn" role="status">Not plugged in: its routes are kept and come back when it is.</p>{/if}
  </div>

  {#if !none}
    <div class="block">
      <p class="scope"><span class="tag">Device</span> Kept with {title}, in every setup</p>
      <label class="field">
        <span>Send clock<small>24 ticks a beat, Start, Stop, Continue</small></span>
        <input type="checkbox" role="switch" class="switch" checked={profile.clock} onchange={(e) => onprofile({ clock: e.currentTarget.checked })} />
      </label>
      {#if drums}
        <label class="field">
          <span>Drum map<small>General MIDI note to the device’s</small></span>
          <select
            value={preset}
            onchange={(e) => {
              const map = DRUM_PRESETS[e.currentTarget.value];
              if (map) onprofile({ drums: { ...map } });
            }}
          >
            {#each Object.keys(DRUM_PRESETS) as name (name)}<option value={name}>{name}</option>{/each}
            {#if preset === 'Custom'}<option value="Custom" disabled>Custom</option>{/if}
          </select>
        </label>
      {/if}
      <label class="field">
        <span>Bend range<small>Semitones each way</small></span>
        <input type="number" min="1" max="96" value={profile.bend} onchange={(e) => typed(e, 1, 96, profile.bend, (bend) => onprofile({ bend }))} />
      </label>
      <label class="field">
        <span>A channel per note (MPE)<small>For microtonal pieces</small></span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          checked={profile.mpe !== null}
          onchange={(e) => onprofile({ mpe: e.currentTarget.checked ? { from: 2, to: 16 } : null })}
        />
      </label>
      {#if profile.mpe}
        {@const mpe = profile.mpe}
        <div class="field">
          <span>Channels</span>
          <span class="range">
            <input
              type="number"
              min="1"
              max="16"
              aria-label="First channel"
              value={mpe.from}
              onchange={(e) => typed(e, 1, 16, mpe.from, (from) => onprofile({ mpe: { from, to: mpe.to } }))}
            />
            to
            <input
              type="number"
              min="1"
              max="16"
              aria-label="Last channel"
              value={mpe.to}
              onchange={(e) => typed(e, 1, 16, mpe.to, (to) => onprofile({ mpe: { from: mpe.from, to } }))}
            />
          </span>
        </div>
      {/if}
      <label class="field">
        <span>Latency<small>Sent this much earlier, in ms</small></span>
        <input type="number" min="0" max="1000" value={profile.latency} onchange={(e) => typed(e, 0, 1000, profile.latency, (latency) => onprofile({ latency }))} />
      </label>
    </div>
  {/if}

  <div class="block">
    <p class="eyebrow">Channels on this output</p>
    <ChannelMeter {used} {lit} label="Channels routed to {title}" />
    <div class="actions">
      {#if ontest}<button type="button" onclick={ontest} disabled={!plugged}>Test note</button>{/if}
      {#if onpanic}<button type="button" onclick={onpanic} disabled={!plugged}>Notes off here</button>{/if}
      {#if onremove}<button type="button" class="ghost" onclick={onremove} disabled={!canRemove}>Remove output</button>{/if}
    </div>
  </div>
</section>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-inspector {
    --_text: var(--wm-text, #1c2029);
    --_muted: var(--wm-muted, #5a6172);
    --_faint: var(--wm-faint, #8b91a0);
    --_off: var(--wm-off, #b8bdc8);
    --_line: var(--wm-line, #c9ced8);
    --_panel: var(--wm-panel, #f8f9fb);
    --_panel-2: var(--wm-panel-2, #e2e5eb);
    --_accent: var(--wm-accent, #2f62d8);
    --_live: var(--wm-live, #1f9d55);
    --_warn: var(--wm-warn, #c47a12);
  }
  @media (prefers-color-scheme: dark) {
    .wm-inspector {
      --_text: var(--wm-text, #e9ebf0);
      --_muted: var(--wm-muted, #a2a8b6);
      --_faint: var(--wm-faint, #6c7282);
      --_off: var(--wm-off, #4a505e);
      --_line: var(--wm-line, #343945);
      --_panel: var(--wm-panel, #1d2027);
      --_panel-2: var(--wm-panel-2, #262a33);
      --_accent: var(--wm-accent, #7aa2ff);
      --_live: var(--wm-live, #3fd17f);
      --_warn: var(--wm-warn, #f0a63a);
    }
  }
  /* end palette */
  .wm-inspector {
    display: grid;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  .block {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
  }
  .block + .block {
    border-top: 1px solid var(--_line);
  }
  h3 {
    margin: 0;
    font: 700 20px/1.2 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    overflow-wrap: anywhere;
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font: 600 12px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--_muted);
  }
  .led {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--_off);
  }
  .led.on {
    background: var(--_live);
  }
  .field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }
  .field small {
    display: block;
    font-size: 12px;
    color: var(--_muted);
  }
  .range {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .scope {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    color: var(--_muted);
  }
  .tag {
    padding: 3px 5px;
    border-radius: 4px;
    font: 600 11px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--_accent);
    background: color-mix(in oklab, var(--_accent) 14%, transparent);
  }
  .warn {
    margin: 0;
    color: var(--_warn);
  }
  select,
  input[type='number'],
  button {
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: inherit;
    font: inherit;
  }
  input[type='number'] {
    width: 70px;
    font-family: var(--wm-font-num, ui-monospace, monospace);
  }
  .switch {
    appearance: none;
    position: relative;
    width: 40px;
    height: 22px;
    margin: 0;
    border-radius: 999px;
    border: 1px solid var(--_line);
    background: var(--_panel-2);
    cursor: pointer;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--_faint);
    transition: left 0.12s;
  }
  .switch:checked {
    border-color: var(--_accent);
  }
  .switch:checked::after {
    left: 20px;
    background: var(--_accent);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  button {
    padding: 0 12px;
    font-weight: 600;
    cursor: pointer;
  }
  button.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--_muted);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  :is(select, input, button):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .switch::after {
      transition: none;
    }
  }
</style>
