// @vitest-environment jsdom
// The standalone page end to end on the fake Web MIDI (`@yggi/webmidi/testing`): connect, patch, play a panel, hear an
// input, and the page drawn over it.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { activeSetup, AS_PLAYED, chooseDevice, inputRow, memoryStore, panelKey, panelsOf, withCrossing, withPanelActive } from '../src/core/index';
import { exportPanel, memoryPanelStore, readLibrary } from '../src/core/panels/index';
import { fakeAccess, fakeInput, fakePort, installMidi, uninstallMidi } from '../src/testing/index';
import App from './App.svelte';
import { Bay, CONTEXT } from './bay.svelte';

let mounted: Record<string, unknown>[] = [];
afterEach(() => {
  for (const m of mounted) unmount(m);
  mounted = [];
  document.body.replaceChildren();
  uninstallMidi();
});

/** A mixer with its own port each way, and a keyboard; a page connected to them. */
async function rig() {
  const mixerIn = fakeInput('in-1', 'DM-8');
  const keys = fakeInput('in-2', 'KeyStep 37');
  const mixerOut = fakePort('out-1', 'DM-8');
  const synth = fakePort('out-2', 'Minilogue xd');
  installMidi(fakeAccess([mixerIn, keys], [mixerOut, synth]));
  const stores = { book: memoryStore(), panels: memoryPanelStore() };
  const bay = new Bay(stores.book, stores.panels);
  await bay.connect();
  return { bay, stores, mixerIn, keys, mixerOut, synth };
}

describe('the standalone patchbay', () => {
  it('says why it isn’t connected where there is no Web MIDI, and starts with two panels to play', async () => {
    const bay = new Bay(memoryStore(), memoryPanelStore());
    await bay.connect();
    expect([bay.connected, bay.message]).toEqual([false, expect.stringMatching(/MIDI/)]);
    expect(bay.library.panels.map((p) => p.name)).toEqual(['DM-8 mixer', 'Keys and pads']);
    expect(bay.runtimeOf('mixer')).toBeUndefined();
  });

  it('sends what a panel plays where its row is crossed, moves it by what its column is sent, and sends none of that back', async () => {
    const { bay, mixerIn, mixerOut, synth, stores } = await rig();
    expect(bay.message).toBe('MIDI connected: 2 inputs, 2 outputs.');
    let book = chooseDevice(bay.book, 'o1', { id: 'out-1', name: 'DM-8' });
    book = withPanelActive(book, 'mixer', true);
    book = withCrossing(book, CONTEXT, panelKey('mixer'), 'o1', AS_PLAYED);
    bay.keep(withCrossing(book, CONTEXT, inputRow({ id: 'in-1', name: 'DM-8' }), panelKey('mixer'), AS_PLAYED));
    expect([bay.shown, bay.missing]).toEqual(['mixer', 0]);
    const mixer = bay.runtimeOf('mixer')!;
    for (const data of mixer.move('main', { x: 1 })) bay.played('mixer', data);
    expect(mixerOut.sent.map((m) => m.data)).toEqual([[0xb0, 40, 127]]);
    mixerIn.play([0xb0, 3, 127]);
    expect(mixer.value('strips[3]/level').x).toBe(1);
    expect([mixerOut.sent.length, synth.sent.length]).toEqual([1, 0]);
    expect(bay.seen.map((s) => `${s.bytes} ${s.from} → ${s.to}`)).toEqual(['B0 03 7F DM-8 → DM-8 mixer', 'B0 28 7F DM-8 mixer → DM-8']);
    expect(panelsOf(activeSetup(JSON.parse(JSON.stringify(stores.book.kept))))).toEqual(['mixer']);
  });

  it('passes an input on where its row is crossed, on the crossing’s channel; a test note and all notes off reach an output', async () => {
    const { bay, keys, synth } = await rig();
    let book = chooseDevice(bay.book, 'o1', { id: 'out-2', name: 'Minilogue xd' });
    book = withCrossing(book, CONTEXT, inputRow({ id: 'in-2', name: 'KeyStep 37' }), 'o1', 3);
    bay.keep(book);
    keys.play([0x90, 60, 100]);
    expect(synth.sent.map((m) => m.data)).toEqual([[0x92, 60, 100]]);
    bay.test('o1');
    bay.panic('o1');
    expect(synth.sent.slice(1).map((m) => m.data)).toEqual([[0x90, 60, 100], ...Array.from({ length: 16 }, (_, ch) => [0xb0 | ch, 123, 0])]);
  });

  it('releases a panel’s notes on its row when it is taken out of the setup, and finds a setup’s port again after a replug', async () => {
    const { bay, synth } = await rig();
    let book = chooseDevice(bay.book, 'o1', { id: 'old-id', name: 'Minilogue xd' });
    book = withPanelActive(book, 'play', true);
    bay.keep(withCrossing(book, CONTEXT, panelKey('play'), 'o1', AS_PLAYED));
    for (const data of bay.runtimeOf('play')!.strike('play/keys', 60)) bay.played('play', data);
    bay.keep(withPanelActive(bay.book, 'play', false));
    expect(synth.sent.map((m) => m.data)).toEqual([
      [0x90, 60, 100],
      [0x80, 60, 0],
    ]);
    expect([bay.shown, bay.runtimeOf('play')]).toEqual([null, undefined]);
  });

  it('opens a panel’s file into the library, says what is wrong with one that isn’t, and saves one as its file', async () => {
    const { bay, stores } = await rig();
    expect(bay.importPanel('nope')).toBe('This file isn’t a panel: it isn’t JSON.');
    expect(bay.importPanel(exportPanel({ id: 'x', name: 'Lights', children: [{ type: 'knob', bind: [{ kind: 'cc', number: 1 }] }] }))).toBeNull();
    expect(readLibrary(stores.panels.kept).panels.map((p) => p.name)).toEqual(['DM-8 mixer', 'Keys and pads', 'Lights']);
    expect(bay.exportPanel('p3')).toEqual({ text: expect.stringContaining('"webmidi-panel"'), filename: 'lights.midipanel.json' });
    expect(bay.exportPanel('none')).toBeNull();
  });

  it('is drawn: the devices and the panels to add as chips, a panel added a row, a column and a tab, and played from the page', async () => {
    const { bay, mixerOut } = await rig();
    mounted.push(mount(App, { target: document.body, props: { bay } }));
    flushSync();
    const chips = () => [...document.querySelectorAll('.tray .dev')].map((b) => b.textContent);
    const press = (text: string) => {
      ([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement).click();
      flushSync();
    };
    expect(chips()).toEqual(['+ DM-8', '+ Minilogue xd', '+ DM-8 mixer', '+ Keys and pads']);
    expect(document.querySelector('.hint')?.textContent).toContain('No panel in this setup yet');
    press('+ DM-8');
    press('+ DM-8 mixer');
    expect([...document.querySelectorAll('tbody th .label')].map((l) => l.textContent)).toEqual(['DM-8 mixer', 'DM-8', 'KeyStep 37']);
    expect([...document.querySelectorAll('thead .name')].map((l) => l.textContent)).toEqual(['DM-8', 'DM-8 mixer']);
    expect([...document.querySelectorAll('[role=tab]')].map((t) => t.textContent)).toEqual(['DM-8 mixer']);
    (document.querySelector('button.jack[aria-label^="DM-8 mixer to DM-8"]') as HTMLButtonElement).click();
    flushSync();
    press('= As played');
    document.querySelector('[role=slider][aria-label="Main"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    flushSync();
    expect(mixerOut.sent.map((m) => m.data)).toEqual([[0xb0, 40, 127]]);
    expect(document.querySelector('.seen li')?.textContent).toContain('B0 28 7F');
  });
});
