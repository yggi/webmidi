<script lang="ts">
  /**
   * The on-screen keyboard (yggi/webmidi#3): the keys from `low` to `high`, laid out by core's `keyboardLayout`. A key
   * struck lower sounds louder (`velocityAt`), a finger that slides plays each key it crosses, and several fingers play
   * several keys. It says what was struck and released (`onstrike`, `onunstrike`); the sound is the frontend's. `lit`
   * shows notes sounding from elsewhere. On its own or in a panel: it carries the palette.
   */
  import { isBlackKey, keyboardLayout, keyName, velocityAt } from '../../core/keyboard';

  interface Props {
    low: number;
    high: number;
    label?: string;
    /** Notes sounding from elsewhere (a sequence, another input), drawn as held. */
    lit?: ReadonlySet<number>;
    onstrike: (note: number, velocity: number) => void;
    onunstrike: (note: number) => void;
  }

  let { low, high, label = 'Keyboard', lit, onstrike, onunstrike }: Props = $props();

  const layout = $derived(keyboardLayout(low, high));
  /** How far down a black key reaches, of the keyboard's height. */
  const BLACK = 0.62;

  /** The note each pointer holds, and those held by the computer's keys (by note). */
  const fingers = new Map<number, number>();
  let down: number[] = $state([]);
  const hit = (note: number, velocity: number) => ((down = [...down, note]), onstrike(note, velocity));
  const lift = (note: number) => {
    const at = down.indexOf(note);
    if (at < 0) return;
    down = down.filter((_, i) => i !== at);
    // (two fingers on one key: it sounds until the last lifts)
    if (!down.includes(note)) onunstrike(note);
  };

  /** The key under a point, black keys first where they reach, and how hard it is struck there; null outside the keyboard. */
  function keyAt(el: HTMLElement, e: PointerEvent): { note: number; velocity: number } | null {
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = e.clientY - rect.top;
    if (x < 0 || x >= 100 || y < 0 || y > rect.height) return null;
    const over = (black: boolean) => layout.find((k) => k.black === black && x >= k.left && x < k.left + k.width);
    const black = y < rect.height * BLACK ? over(true) : undefined;
    const key = black ?? over(false);
    return key ? { note: key.note, velocity: velocityAt(y, rect.height * (black ? BLACK : 1)) } : null;
  }

  function pointer(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    if (e.type === 'pointerdown') {
      e.preventDefault();
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // (a pointer already gone)
      }
    } else if (!fingers.has(e.pointerId)) return;
    const held = fingers.get(e.pointerId);
    const now = e.type === 'pointerdown' || e.type === 'pointermove' ? keyAt(el, e) : null;
    if (now?.note === held) return;
    if (held !== undefined) lift(held);
    if (now) (fingers.set(e.pointerId, now.note), hit(now.note, now.velocity));
    else if (e.type === 'pointermove')
      fingers.set(e.pointerId, -1); // (off the keyboard, still down: back on it, it plays again)
    else fingers.delete(e.pointerId);
  }

  const isKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="wm-keys" role="group" aria-label={label} onpointerdown={pointer} onpointermove={pointer} onpointerup={pointer} onpointercancel={pointer} onlostpointercapture={pointer}>
  {#each layout as k (k.note)}
    <button
      type="button"
      class="key"
      class:black={k.black}
      class:c={k.note % 12 === 0}
      aria-label={keyName(k.note)}
      aria-pressed={down.includes(k.note) || !!lit?.has(k.note)}
      style:left="{k.left}%"
      style:width="{k.width}%"
      onkeydown={(e) => isKey(e) && !e.repeat && (e.preventDefault(), hit(k.note, 100))}
      onkeyup={(e) => isKey(e) && (e.preventDefault(), lift(k.note))}
      >{#if !isBlackKey(k.note) && k.note % 12 === 0}<span aria-hidden="true">{keyName(k.note)}</span>{/if}</button
    >
  {/each}
</div>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-keys {
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
    .wm-keys {
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
  .wm-keys {
    position: relative;
    width: 100%;
    height: var(--wm-keys-height, 132px);
    overflow: hidden;
    border: 1px solid var(--_line);
    border-radius: 8px;
    background: var(--_line);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .key {
    position: absolute;
    top: 0;
    bottom: 0;
    display: grid;
    align-items: end;
    justify-items: center;
    box-sizing: border-box;
    padding: 0 0 6px;
    border: 0;
    border-right: 1px solid var(--_line);
    border-radius: 0 0 4px 4px;
    background: linear-gradient(#ffffff, #f1f3f6);
    color: #8b91a0;
    font: 600 9.5px/1 var(--wm-font-num, ui-monospace, monospace);
    /* (the keyboard takes the pointer: a key is pressed through it, and by the computer's keys) */
    pointer-events: none;
  }
  .key.black {
    z-index: 1;
    bottom: 38%;
    border: 0;
    border-radius: 0 0 3px 3px;
    background: linear-gradient(#2b2f39, #14161b);
    box-shadow: 0 2px 3px rgb(0 0 0 / 0.35);
  }
  .key[aria-pressed='true'] {
    background: color-mix(in oklab, var(--_accent) 45%, #ffffff);
    color: #1c2029;
  }
  .key.black[aria-pressed='true'] {
    background: color-mix(in oklab, var(--_accent) 70%, #14161b);
  }
  .key:focus-visible {
    z-index: 2;
    outline: 2px solid var(--_accent);
    outline-offset: -2px;
  }
</style>
