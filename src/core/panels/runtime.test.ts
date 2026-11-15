import { describe, expect, it } from 'vitest';
import { EXAMPLE_MIXER } from './examples';
import type { Panel, PanelNode } from './model';
import { PanelRuntime } from './runtime';

const play = (children: readonly PanelNode[], rest: Partial<Panel> = {}): PanelRuntime => new PanelRuntime({ id: 'p', name: 'P', children, ...rest });

describe('PanelRuntime: the mixer', () => {
  it('sends each of its 33 controls’ bytes: a control change on channel 1, its controller, its value', () => {
    const mixer = new PanelRuntime(EXAMPLE_MIXER);
    const sent = mixer.panel.controls.map((c) => [c.key, mixer.move(c.key, { x: 1 })]);
    const strip = (ch: number) => [
      [`strips[${ch}]/high`, [[0xb0, 10 + ch, 127]]],
      [`strips[${ch}]/mid`, [[0xb0, 20 + ch, 127]]],
      [`strips[${ch}]/mute`, [[0xb0, 30 + ch, 127]]],
      [`strips[${ch}]/level`, [[0xb0, ch, 127]]],
    ];
    expect(sent).toEqual([...[1, 2, 3, 4, 5, 6, 7, 8].flatMap(strip), ['main', [[0xb0, 40, 127]]]]);
  });

  it('starts each control where its panel says, and sends its first move whatever it is', () => {
    const mixer = new PanelRuntime(EXAMPLE_MIXER);
    expect(mixer.value('strips[2]/high')).toEqual({ x: 0.5, y: 0.5 });
    expect(mixer.value('strips[2]/level').x).toBe(0);
    expect(mixer.move('strips[2]/level', { x: 0 })).toEqual([[0xb0, 2, 0]]);
  });

  it('sends only when the number on the wire changes, and holds a value to 0 … 1', () => {
    const mixer = new PanelRuntime(EXAMPLE_MIXER);
    expect(mixer.move('main', { x: 0.5 })).toEqual([[0xb0, 40, 64]]);
    expect(mixer.move('main', { x: 0.501 })).toEqual([]);
    expect(mixer.value('main').x).toBe(0.501);
    expect(mixer.move('main', { x: 0.51 })).toEqual([[0xb0, 40, 65]]);
    expect(mixer.move('main', { x: 7 })).toEqual([[0xb0, 40, 127]]);
    expect(mixer.move('main', { x: NaN })).toEqual([[0xb0, 40, 0]]);
    expect(mixer.move('nothing', { x: 1 })).toEqual([]);
  });

  it('is moved by what the mixer sends back, which is not echoed; a control held stays where the finger is', () => {
    const mixer = new PanelRuntime(EXAMPLE_MIXER);
    expect(mixer.receive([0xb0, 13, 127])).toEqual(['strips[3]/high']);
    expect(mixer.value('strips[3]/high').x).toBe(1);
    expect(mixer.move('strips[3]/high', { x: 1 })).toEqual([]);
    expect(mixer.receive([0xb1, 13, 0])).toEqual([]);
    expect(mixer.receive([0xb0, 99, 0])).toEqual([]);
    expect(mixer.receive([0xf8])).toEqual([]);
    mixer.press('main');
    expect(mixer.receive([0xb0, 40, 100])).toEqual([]);
    expect(mixer.value('main').x).toBe(0);
    mixer.lift('main');
    expect(mixer.receive(new Uint8Array([0xb0, 40, 100]))).toEqual(['main']);
    expect(mixer.value('main').x).toBeCloseTo(100 / 127);
  });
});

describe('PanelRuntime: every kind, both ways', () => {
  it('a range is linear and reads back, downward too', () => {
    const p = play([
      { type: 'knob', id: 'a', bind: [{ kind: 'cc', number: 7, range: [20, 120] }] },
      { type: 'knob', id: 'b', bind: [{ kind: 'cc', number: 8, range: [127, 0] }] },
      { type: 'knob', id: 'c', bind: [{ kind: 'cc', number: 9, range: [5, 5] }] },
    ]);
    expect(p.move('a', { x: 0.5 })).toEqual([[0xb0, 7, 70]]);
    p.receive([0xb0, 7, 120]);
    p.receive([0xb0, 8, 127]);
    p.receive([0xb0, 9, 5]);
    expect([p.value('a').x, p.value('b').x, p.value('c').x]).toEqual([1, 0, 0]);
    expect(p.move('b', { x: 0.25 })).toEqual([[0xb0, 8, 95]]);
    // (what is past the range is held to it)
    p.receive([0xb0, 7, 0]);
    expect(p.value('a').x).toBe(0);
  });

  it('a note is on while the value is above 0, its velocity the value’s; received, on and off move it', () => {
    const p = play([{ type: 'button', id: 'pad', bind: [{ kind: 'note', number: 36, channel: 10 }] }]);
    expect(p.move('pad', { x: 1 })).toEqual([[0x99, 36, 127]]);
    expect(p.move('pad', { x: 0.5 })).toEqual([]);
    expect(p.move('pad', { x: 0 })).toEqual([[0x89, 36, 0]]);
    expect(p.move('pad', { x: 0 })).toEqual([]);
    expect(p.move('pad', { x: 0.001 })).toEqual([[0x99, 36, 1]]);
    p.move('pad', { x: 0 });
    expect(p.receive([0x99, 36, 64])).toEqual(['pad']);
    expect(p.value('pad').x).toBeCloseTo(64 / 127);
    expect(p.move('pad', { x: 1 })).toEqual([]);
    p.receive([0x99, 36, 0]);
    expect(p.value('pad').x).toBe(0);
    p.receive([0x99, 36, 1]);
    p.receive([0x89, 36, 64]);
    expect(p.value('pad').x).toBe(0);
  });

  it('a program change, the bend and the pressure have no number', () => {
    const p = play([{ type: 'knob', id: 'k', bind: [{ kind: 'program' }, { kind: 'bend' }, { kind: 'pressure', channel: 2 }] }]);
    expect(p.move('k', { x: 1 })).toEqual([
      [0xc0, 127],
      [0xe0, 127, 127],
      [0xd1, 127],
    ]);
    p.receive([0xe0, 0, 64]);
    expect(p.value('k').x).toBeCloseTo(8192 / 16383);
    p.receive([0xc0, 0]);
    expect(p.value('k').x).toBe(0);
    p.receive([0xd1, 127]);
    expect(p.value('k').x).toBe(1);
    expect(p.receive([0xd0, 127])).toEqual([]);
  });

  it('a 14-bit controller is two control changes, and is read from its coarse half, then in full', () => {
    const p = play([{ type: 'fader', id: 'f', bind: [{ kind: 'cc14', number: 1 }] }]);
    expect(p.move('f', { x: 1 })).toEqual([
      [0xb0, 1, 127],
      [0xb0, 33, 127],
    ]);
    p.receive([0xb0, 1, 64]);
    expect(p.value('f').x).toBeCloseTo(8192 / 16383);
    p.receive([0xb0, 33, 1]);
    expect(p.value('f').x).toBeCloseTo(8193 / 16383);
    expect(p.move('f', { x: 8193 / 16383 })).toEqual([]);
  });

  it('an NRPN is four control changes, and is read as they complete it', () => {
    const p = play([
      { type: 'knob', id: 'n', bind: [{ kind: 'nrpn', number: 300 }] },
      { type: 'knob', id: 'r', bind: [{ kind: 'rpn', number: 0, range: [0, 24 << 7] }] },
    ]);
    expect(p.move('n', { x: 1 })).toEqual([
      [0xb0, 99, 2],
      [0xb0, 98, 44],
      [0xb0, 6, 127],
      [0xb0, 38, 127],
    ]);
    expect(
      [
        [0xb0, 99, 2],
        [0xb0, 98, 44],
        [0xb0, 6, 64],
      ].flatMap((m) => p.receive(m)),
    ).toEqual(['n']);
    expect(p.value('n').x).toBeCloseTo(8192 / 16383);
    expect(
      [
        [0xb0, 101, 0],
        [0xb0, 100, 0],
        [0xb0, 6, 12],
      ].flatMap((m) => p.receive(m)),
    ).toEqual(['r']);
    expect(p.value('r').x).toBe(0.5);
  });

  it('an xy has two values, each bound by its axis; one message may move several controls', () => {
    const p = play([
      {
        type: 'xy',
        id: 'pad',
        value: 0.5,
        bind: [
          { kind: 'cc', number: 1 },
          { kind: 'cc', number: 2, axis: 'y' },
        ],
      },
      { type: 'knob', id: 'twin', bind: [{ kind: 'cc', number: 2 }] },
    ]);
    expect(p.move('pad', { x: 1 })).toEqual([
      [0xb0, 1, 127],
      [0xb0, 2, 64],
    ]);
    expect(p.move('pad', { y: 0 })).toEqual([[0xb0, 2, 0]]);
    expect(p.value('pad')).toEqual({ x: 1, y: 0 });
    expect(p.receive([0xb0, 2, 127])).toEqual(['pad', 'twin']);
    expect(p.value('pad')).toEqual({ x: 1, y: 1 });
  });

  it('a keyboard and a pads strike their own notes, once until released, on the channel they stand in', () => {
    const p = play([
      { type: 'keyboard', id: 'keys', low: 60, high: 72 },
      { group: 'kit', channel: 10, children: [{ type: 'pads', id: 'pads', notes: [36, 38] }] },
    ]);
    expect(p.strike('keys', 60, 90)).toEqual([[0x90, 60, 90]]);
    expect(p.strike('keys', 60, 90)).toEqual([]);
    expect(p.strike('keys', 59)).toEqual([]);
    expect(p.strike('kit/pads', 38, 0)).toEqual([[0x99, 38, 1]]);
    expect(p.unstrike('keys', 60)).toEqual([[0x80, 60, 0]]);
    expect(p.unstrike('keys', 60)).toEqual([]);
    expect(p.strike('keys', 60)).toEqual([[0x90, 60, 100]]);
  });

  it('silence releases every note sounding, struck or held on by a control, and nothing else', () => {
    const p = play([
      { type: 'keyboard', id: 'keys' },
      {
        type: 'switch',
        id: 'drone',
        bind: [
          { kind: 'note', number: 40 },
          { kind: 'cc', number: 9 },
        ],
      },
    ]);
    p.strike('keys', 60);
    p.strike('keys', 64);
    p.move('drone', { x: 1 });
    p.press('drone');
    expect(p.silence()).toEqual([
      [0x80, 60, 0],
      [0x80, 64, 0],
      [0x80, 40, 0],
    ]);
    expect(p.value('drone').x).toBe(0);
    expect(p.silence()).toEqual([]);
    expect(p.receive([0xb0, 9, 127])).toEqual(['drone']);
  });
});
