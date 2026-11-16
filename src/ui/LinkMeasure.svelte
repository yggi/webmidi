<script lang="ts">
  /**
   * Measure the link of an output (yggi/webmidi#75, decision 009): probes go out of it and are timed back on an input of
   * its loop (a cable from the out to an in, or a device that echoes), and the report is said in words. It sends only
   * when the button is pressed, and says so. What is a measurement (the loop, the page lag, jitter, drift, loss, order,
   * whether timestamps are honoured) and what is an assumption (one way, half the loop; the wire time per byte, not
   * measured) is said of each, and the tiers are marked speculative: their limits are proposals until numbers from
   * hardware replace them. Presentational: the frontend runs the probe (`onmeasure`, which web's `runLinkProbe` answers
   * to) and may keep the report (`onreport`, the JSON its timing export carries). The link is not the device's latency
   * offset, which compensates the time to a sound and is set apart.
   */
  import { LINK_RUNS, LINK_TIMEOUT, type LinkLength, type LinkReport } from '../core/link';
  import { delayText } from '../core/thru';
  import type { PortOption } from '../core/port';

  interface Props {
    /** The output measured, as its name. */
    outputName: string;
    /** The inputs plugged in: the loop's is one of them. */
    inputs: readonly PortOption[];
    /** Run the probes over `input`: resolves with the report, rejects with an `AbortError` when `signal` aborts; `onprogress` is told how many are sent. */
    onmeasure: (run: {
      readonly input: PortOption;
      readonly length: LinkLength;
      readonly signal: AbortSignal;
      readonly onprogress: (progress: { readonly sent: number; readonly of: number }) => void;
    }) => Promise<LinkReport>;
    /** A report made. */
    onreport?: (report: LinkReport) => void;
    /** The output isn't plugged in. */
    disabled?: boolean;
  }

  let { outputName, inputs, onmeasure, onreport, disabled = false }: Props = $props();

  let inputId = $state('');
  let length: LinkLength = $state('quick');
  let running = $state(false);
  let sent = $state(0);
  let report: LinkReport | null = $state(null);
  let stopped = $state(false);
  let failure = $state('');
  let controller: AbortController | null = null;

  const input = $derived(inputs.find((p) => p.id === inputId) ?? inputs[0] ?? null);
  const run = $derived(LINK_RUNS[length]);
  const uid = $props.id();

  async function measure() {
    if (!input || running) return;
    controller = new AbortController();
    [running, sent, report, stopped, failure] = [true, 0, null, false, ''];
    try {
      const made = await onmeasure({ input, length, signal: controller.signal, onprogress: (p) => (sent = p.sent) });
      report = made;
      onreport?.(made);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') stopped = true;
      else failure = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
      controller = null;
    }
  }

  const seconds = (r: { probes: number; spacing: number }) => (r.probes * r.spacing) / 1000;
  const share = (n: number) => `${Math.round(n * 1000) / 10}%`;
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n) * 10) / 10}`;
  const honoured = (h: boolean | null) => (h === null ? 'not known' : h ? 'yes' : 'no: the platform sent them at once');
</script>

<section class="wm-link" aria-labelledby="{uid}-title">
  <p class="eyebrow" id="{uid}-title">Link</p>
  {#if inputs.length === 0}
    <p class="note">No input is plugged in. Measuring the link needs a cable from {outputName} back to an input, or a device that echoes what it is sent.</p>
  {:else}
    <p class="note">
      Measure link sends {run.probes} control changes (CC 119 on channel 16) out of {outputName}, only when you press the button, and times them back on the input you choose: about {seconds(
        run,
      )} s. It needs a cable from this output to that input, or a device that echoes them.
    </p>
    <label class="field">
      <span>Input of the loop</span>
      <select value={input?.id} disabled={running} onchange={(e) => (inputId = e.currentTarget.value)}>
        {#each inputs as p (p.id)}<option value={p.id}>{p.name || p.id}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>Run</span>
      <select value={length} disabled={running} onchange={(e) => (length = e.currentTarget.value as LinkLength)}>
        <option value="quick">Quick: {LINK_RUNS.quick.probes} probes, about {seconds(LINK_RUNS.quick)} s</option>
        <option value="long">Long: {LINK_RUNS.long.probes} probes, about {seconds(LINK_RUNS.long)} s, and the drift</option>
      </select>
    </label>
    <div class="actions">
      {#if running}
        <button type="button" onclick={() => controller?.abort()}>Stop</button>
      {:else}
        <button type="button" onclick={measure} disabled={disabled || !input}>Measure link</button>
      {/if}
    </div>
    {#if running}
      <p class="note" role="status">Measuring: {sent} of {run.probes} probes</p>
      <div class="bar" role="progressbar" aria-label="Probes sent" aria-valuemin="0" aria-valuemax={run.probes} aria-valuenow={sent}>
        <span style:width="{(sent / run.probes) * 100}%"></span>
      </div>
    {:else if stopped}
      <p class="note" role="status">Stopped: no report. Nothing more is sent.</p>
    {:else if failure}
      <p class="warn" role="alert">Could not measure: {failure}</p>
    {/if}
  {/if}

  {#if report}
    {@const r = report}
    <div class="report">
      <p class="eyebrow">Measured</p>
      {#if r.loop}
        <p>
          Loop: median {delayText(r.loop.median)}, 95 in 100 within {delayText(r.loop.p95)}, worst {delayText(r.loop.worst)}. Out of the page, through the driver and the wire, and
          back.
        </p>
        <p>Jitter: {delayText(r.loop.jitter)} (95 in 100 within, less the median).</p>
      {:else}
        <p>Loop: nothing came back, so it is not measured.</p>
      {/if}
      {#if r.lag}<p>Page lag in: median {delayText(r.lag.median)}, 95 in 100 within {delayText(r.lag.p95)}. The page’s own delay on the way in.</p>{/if}
      <p>
        Loss: {r.loss.lost} of {r.loss.of} probes ({share(r.loss.share)}), not back within {LINK_TIMEOUT} ms. Out of order {r.outOfOrder}, twice {r.duplicates}, outliers {r.outliers}.
      </p>
      <p>Drift: {r.drift === null ? 'not measured: it takes the long run' : `${signed(r.drift)} ms a minute`}.</p>
      <p>Timestamps honoured: {honoured(r.timestampsHonoured)}.</p>
      <p class="eyebrow">Assumed</p>
      {#if r.oneWay}<p>One way: about {delayText(r.oneWay.ms)}. An assumption: half the loop, since one clock cannot tell the out from the in.</p>{/if}
      <p>Wire time per byte: not measured.</p>
      <p class="eyebrow">Tier <span class="tag">speculative</span></p>
      {#each r.reasons as reason (reason)}<p class="tier">{reason.charAt(0).toUpperCase() + reason.slice(1)}</p>{:else}<p>Nothing to rate.</p>{/each}
      <p class="note">
        The tiers are speculative: their limits are proposals until numbers from real hardware replace them. Scheduled is what the band sends ahead; played is a hand on a key. The
        device’s own latency offset is set apart from all of this.
      </p>
      <details>
        <summary>Report as JSON</summary>
        <pre>{JSON.stringify(r, null, 2)}</pre>
      </details>
    </div>
  {/if}
</section>

<style>
  /* palette: the same in every component (ui.svelte.test.ts); a frontend sets --wm-* to its own tokens */
  .wm-link {
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
    .wm-link {
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
  .wm-link {
    display: grid;
    gap: 10px;
    font: 14px/1.4 var(--wm-font, system-ui, sans-serif);
    color: var(--_text);
  }
  p {
    margin: 0;
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 600 12px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--_muted);
  }
  .note {
    font-size: 12px;
    color: var(--_muted);
  }
  .warn {
    color: var(--_warn);
  }
  .field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }
  select,
  button {
    min-height: 34px;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--_line);
    border-radius: var(--wm-radius, 6px);
    background: var(--_panel);
    color: inherit;
    font: inherit;
  }
  button {
    padding: 0 12px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--_panel-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--_accent);
  }
  .report {
    display: grid;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    background: var(--_panel-2);
  }
  .report .eyebrow {
    margin-top: 6px;
  }
  .tag {
    padding: 3px 5px;
    border-radius: 4px;
    font: 600 11px/1 var(--wm-font-label, var(--wm-font, system-ui, sans-serif));
    color: var(--_warn);
    background: color-mix(in oklab, var(--_warn) 14%, transparent);
  }
  .tier {
    font-weight: 600;
  }
  pre {
    margin: 6px 0 0;
    max-height: 220px;
    overflow: auto;
    font: 12px/1.4 var(--wm-font-num, ui-monospace, monospace);
  }
  :is(select, button, summary):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }
</style>
