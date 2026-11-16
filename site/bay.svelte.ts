/**
 * The standalone patchbay (docs/proposals/patchbay.md, section 4): what the page keeps and does, apart from how it is
 * drawn. The inputs are the rows, the outputs and the panels the columns; a message from an input goes where its row
 * is crossed, as it came or on the crossing's channel, and a panel's messages where its row is. Nothing here is the
 * package's: a frontend wires its own page the same way, from the same parts.
 */
import {
  activeSetup,
  BUILT_IN,
  HEARD,
  newBook,
  overwrite,
  withBuiltIn,
  withCrossing,
  builtInHears,
  forwardsOf,
  forwardsOfInput,
  inputRow,
  hardwareOutputs,
  probeMarker,
  loadBook,
  namePorts,
  panelForwardsOf,
  panelKey,
  panelsOf,
  portsMessage,
  portsOf,
  ThruMeter,
  withPanelActive,
  type BookStore,
  type Forward,
  type LinkLength,
  type LinkReport,
  type MidiPort,
  type PortOption,
  type SetupBook,
  type ThruStats,
} from '../src/core/index';
import {
  EXAMPLE_MIXER,
  EXAMPLE_PLAY,
  exportPanel,
  importPanel,
  loadLibrary,
  PanelRack,
  panelOf,
  removePanel,
  withPanel,
  type Panel,
  type PanelLibrary,
  type PanelRuntime,
  type PanelStore,
} from '../src/core/panels/index';
import { MidiAccess, runLinkProbe } from '../src/web/index';

/** The one context of the page's routes. */
export const CONTEXT = 'bay';
/** How many of the last messages the monitor keeps. */
const KEPT = 8;

/** A message as the monitor shows it: where from, where to, its bytes. */
export interface Seen {
  readonly from: string;
  readonly to: string;
  readonly bytes: string;
}

const hex = (data: ArrayLike<number>) =>
  Array.from(data)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');

export class Bay {
  book: SetupBook = $state.raw(undefined as unknown as SetupBook);
  library: PanelLibrary = $state.raw(undefined as unknown as PanelLibrary);
  inputs: readonly PortOption[] = $state.raw([]);
  outputs: readonly PortOption[] = $state.raw([]);
  message = $state('MIDI isn’t connected.');
  connected = $state(false);
  connecting = $state(false);
  /** The panel being played, by id. */
  shown: string | null = $state(null);
  seen: readonly Seen[] = $state.raw([]);
  /** What the page added to the messages it passed on from an input to an output: its own delay, measured. */
  thru: ThruStats | null = $state.raw(null);
  private readonly meter = new ThruMeter();
  /** Bumped when the rack's runtimes change, for what reads one. */
  private racked = $state(0);

  private midi: MidiAccess | null = null;
  private readonly rack = new PanelRack();
  private ports = new Map<string, MidiPort | null>();
  /** A link measurement is out: its probes, heard back on an input, are the measurement's and go nowhere. */
  private probing = false;

  constructor(
    private readonly books: BookStore,
    private readonly panels: PanelStore,
    /** The page's own sound, the built-in of its setups: what a row crossed with it is played on. None: silent. */
    private readonly sound: { play(data: ArrayLike<number>): void } | null = null,
    /** The page's clock, in ms: the one an input's messages are stamped on. */
    private readonly now: () => number = () => performance.now(),
  ) {
    const kept = loadLibrary(panels);
    // (a first visit starts with two panels, and the one with keys playing the page's own sound: something to hear at once)
    this.library = kept.panels.length ? kept : { version: 1, panels: [EXAMPLE_MIXER, EXAMPLE_PLAY] };
    this.book = loadBook(books, () =>
      sound ? overwrite(withCrossing(withPanelActive(withBuiltIn(newBook(), true), EXAMPLE_PLAY.id, true), CONTEXT, panelKey(EXAMPLE_PLAY.id), BUILT_IN.key, HEARD)) : null,
    );
    this.adopt();
  }

  /** Ask for Web MIDI and take the ports as they are; in words why not, when it can't. */
  async connect(): Promise<void> {
    this.connecting = true;
    const result = await MidiAccess.connect({ onMessage: (data, source, timeStamp) => this.heard(data, source, timeStamp), onChange: () => this.refresh() });
    this.connecting = false;
    if (typeof result === 'string') return void (this.message = result);
    this.midi = result;
    this.connected = true;
    this.refresh();
  }

  /** The ports as they are now: listed, named in the book where it kept ids alone, the setup's found again. */
  refresh(): void {
    if (!this.midi) return;
    this.inputs = this.midi.inputs;
    this.outputs = this.midi.outputs;
    this.message = portsMessage(this.midi);
    const named = namePorts(this.book, this.midi);
    if (named !== this.book) this.keep(named);
    else this.adopt();
  }

  /** A change to the book, kept. */
  keep(book: SetupBook): void {
    const before = this.book;
    this.book = book;
    this.books.save(book);
    this.adopt(before);
  }

  /** The setup in use taken up: its outputs' ports, the inputs it listens to, its panels playing. */
  private adopt(before: SetupBook = this.book): void {
    const setup = activeSetup(this.book);
    // (a panel taken out releases its notes where its row was crossed, before the change, and through the ports of before)
    for (const released of this.rack.sync(panelsOf(setup), this.library)) this.route(panelKey(released.panel), released.data, released.panel, before);
    this.racked++;
    if (this.shown !== null && !panelsOf(setup).includes(this.shown)) this.shown = null;
    this.shown ??= panelsOf(setup).find((id) => panelOf(this.library, id)) ?? null;
    if (!this.midi) return;
    const live = portsOf(setup, this.midi);
    this.ports = new Map(live.outputs.map((o) => [o.key, o.port]));
    this.midi.listen(live.listen);
  }

  /** How many of the setup's devices aren't plugged in. */
  get missing(): number {
    return this.connected ? hardwareOutputs(activeSetup(this.book)).filter((o) => o.id !== 'none' && !this.ports.get(o.key)).length : 0;
  }

  /** A panel's runtime, to draw and to play; undefined when it isn't active or isn't in the library. */
  runtimeOf(id: string | null): PanelRuntime | undefined {
    void this.racked;
    return id === null ? undefined : this.rack.runtime(id);
  }

  /** Messages sent to their outputs: how many reached a port plugged in. */
  private send(forwards: readonly Forward[], from: string, book: SetupBook): number {
    const setup = activeSetup(book);
    let reached = 0;
    for (const f of forwards) {
      const port = this.ports.get(f.output);
      port?.send(f.data);
      if (port) reached++;
      this.note(from, setup.outputs.find((o) => o.key === f.output)?.name || f.output, f.data);
    }
    return reached;
  }

  /** A message on a row, sent where the row is crossed: to outputs, and to panels. */
  private route(row: string | PortOption, data: ArrayLike<number>, from: string, book: SetupBook = this.book): number {
    // (the built-in takes MIDI here: a row crossed with it is played on the page's own sound)
    if (this.sound && builtInHears(book, CONTEXT, typeof row === 'string' ? row : inputRow(row))) (this.sound.play(data), this.note(from, 'Synth', data));
    const reached = this.send(typeof row === 'string' ? forwardsOf(book, CONTEXT, row, data) : forwardsOfInput(book, CONTEXT, row, data), from, book);
    const toPanels = panelForwardsOf(book, CONTEXT, row, data);
    this.rack.receive(toPanels);
    for (const f of toPanels) this.note(from, panelOf(this.library, f.panel)?.name ?? f.panel, f.data);
    return reached;
  }

  /** A message a panel made, by a touch. */
  played(id: string, data: number[]): void {
    this.route(panelKey(id), data, panelOf(this.library, id)?.name ?? id);
  }

  /** A message from an input, by its port's name. */
  private heard(data: ArrayLike<number>, source: string, seen: number): void {
    if (this.probing && probeMarker(data) !== null) return;
    if (!this.route({ id: source, name: source }, data, source)) return;
    // (passed on to an output: the time from the port seeing it to the page having sent it)
    this.meter.add(seen, this.now());
    this.thru = this.meter.stats;
  }

  /**
   * The link to an output measured (yggi/webmidi#75), by the output's key, over the input of its loop: probes go out only
   * as this is called, which the page does when the person presses the button. While it runs the probes heard back on
   * an input aren't passed on.
   */
  async measureLink(
    key: string,
    run: { readonly input: PortOption; readonly length: LinkLength; readonly signal: AbortSignal; readonly onprogress: (progress: { sent: number; of: number }) => void },
  ): Promise<LinkReport> {
    const output = this.ports.get(key);
    const input = this.midi?.access.inputs.get(run.input.id);
    if (!output || !input) throw new Error('That port is not plugged in.');
    const name = activeSetup(this.book).outputs.find((o) => o.key === key)?.name || key;
    this.probing = true;
    try {
      return await runLinkProbe({ output, input, outputName: name, inputName: run.input.name, length: run.length, signal: run.signal, onprogress: run.onprogress });
    } finally {
      this.probing = false;
    }
  }

  /** The measurement begun again. */
  resetThru(): void {
    this.meter.reset();
    this.thru = null;
  }

  private note(from: string, to: string, data: ArrayLike<number>): void {
    this.seen = [{ from, to, bytes: hex(data) }, ...this.seen].slice(0, KEPT);
  }

  /** A test note to an output: middle C on channel 1, a third of a second. */
  test(key: string): void {
    const port = this.ports.get(key);
    port?.send([0x90, 60, 100]);
    setTimeout(() => port?.send([0x80, 60, 0]), 300);
  }

  /** All notes off, on every channel of one output, or of every output; the panels' notes released too. */
  panic(key?: string): void {
    for (const id of panelsOf(activeSetup(this.book))) for (const data of this.rack.runtime(id)?.silence() ?? []) this.played(id, data);
    if (key === undefined) for (let ch = 0; ch < 16; ch++) this.sound?.play([0xb0 | ch, 123, 0]);
    for (const [k, port] of this.ports) if (key === undefined || k === key) for (let ch = 0; ch < 16; ch++) port?.send([0xb0 | ch, 123, 0]);
  }

  private keepLibrary(library: PanelLibrary): void {
    this.library = library;
    this.panels.save(library);
    this.adopt();
  }

  /** A panel changed in the editor: kept, and played anew where it is active (its notes released first). */
  editPanel(panel: Panel): void {
    this.keepLibrary(withPanel(this.library, panel));
  }

  /** A new, empty panel in the library, active in the setup and shown: its id. */
  newPanel(): string {
    let n = this.library.panels.length + 1;
    while (panelOf(this.library, `p${n}`)) n++;
    const id = `p${n}`;
    this.keepLibrary(withPanel(this.library, { id, name: `Panel ${n}`, children: [] }));
    this.keep(withPanelActive(this.book, id, true));
    this.shown = id;
    return id;
  }

  /** A panel taken out of the library, and out of the setup in use with its routes. */
  deletePanel(id: string): void {
    this.keep(withPanelActive(this.book, id, false));
    this.keepLibrary(removePanel(this.library, id));
  }

  /** A panel's file added to the library, or in words why not. */
  importPanel(text: string): string | null {
    const next = importPanel(this.library, text);
    if (typeof next === 'string') return next;
    this.keepLibrary(next);
    return null;
  }

  /** A panel as its file's text and name, or null: not in the library. */
  exportPanel(id: string): { text: string; filename: string } | null {
    const panel = panelOf(this.library, id);
    return panel ? { text: exportPanel(panel), filename: `${panel.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'panel'}.midipanel.json` } : null;
  }
}
