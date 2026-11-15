import { describe, expect, it } from 'vitest';
import { EXAMPLE_MIXER, EXAMPLE_PLAY } from './examples';
import { withPanel, type PanelLibrary } from './library';
import { PanelRack } from './rack';
import { PanelRuntime } from './runtime';

const library: PanelLibrary = { version: 1, panels: [EXAMPLE_MIXER, EXAMPLE_PLAY] };

describe('PanelRack', () => {
  it('plays the panels active, each kept while its panel is the same, and none for one the library lacks', () => {
    const rack = new PanelRack();
    expect(rack.sync(['mixer', 'gone'], library)).toEqual([]);
    const mixer = rack.runtime('mixer')!;
    mixer.move('main', { x: 1 });
    expect([rack.runtime('gone'), rack.runtime('play')]).toEqual([undefined, undefined]);
    rack.sync(['play', 'mixer'], library);
    expect(rack.runtime('mixer')).toBe(mixer);
    expect(rack.runtime('mixer')!.value('main').x).toBe(1);
    expect(rack.runtime('play')).toBeInstanceOf(PanelRuntime);
  });

  it('silences a panel taken out, and one an edit replaced, handing back what that sends', () => {
    const rack = new PanelRack();
    rack.sync(['play'], library);
    rack.runtime('play')!.strike('play/keys', 60);
    const edited = withPanel(library, { ...EXAMPLE_PLAY, name: 'Edited' });
    expect(rack.sync(['play'], edited)).toEqual([{ panel: 'play', data: [0x80, 60, 0] }]);
    expect(rack.runtime('play')!.panel.name).toBe('Edited');
    rack.runtime('play')!.strike('play/keys', 62);
    expect(rack.sync([], edited)).toEqual([{ panel: 'play', data: [0x80, 62, 0] }]);
    expect(rack.runtime('play')).toBeUndefined();
  });

  it('hands each panel the messages meant for it, and tells who watches a runtime when a value changes', () => {
    const rack = new PanelRack();
    rack.sync(['mixer', 'play'], library);
    let told = 0;
    const stop = rack.runtime('mixer')!.watch(() => told++);
    rack.receive([
      { panel: 'mixer', data: [0xb0, 3, 127] },
      { panel: 'play', data: [0xb0, 1, 127] },
      { panel: 'gone', data: [0xb0, 1, 127] },
      { panel: 'mixer', data: [0xb0, 99, 0] },
    ]);
    expect([rack.runtime('mixer')!.value('strips[3]/level').x, rack.runtime('play')!.value('wheels/mod').x, told]).toEqual([1, 1, 1]);
    rack.runtime('mixer')!.move('main', { x: 0.5 });
    expect(told).toBe(2);
    stop();
    rack.runtime('mixer')!.move('main', { x: 1 });
    expect(told).toBe(2);
  });
});
