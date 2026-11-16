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
import { type LinkLength, type LinkReport } from '../core/link';
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
        readonly onprogress: (progress: {
            readonly sent: number;
            readonly of: number;
        }) => void;
    }) => Promise<LinkReport>;
    /** A report made. */
    onreport?: (report: LinkReport) => void;
    /** The output isn't plugged in. */
    disabled?: boolean;
}
declare const LinkMeasure: import("svelte").Component<Props, {}, "">;
type LinkMeasure = ReturnType<typeof LinkMeasure>;
export default LinkMeasure;
