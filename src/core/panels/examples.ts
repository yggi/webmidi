import type { Panel } from './model';

/**
 * A panel to start from, and the test of the model (decision 005): eight channels, each a strip of one template (High on CC 10 + ch, Mid on 20 + ch, Mute on
 * 30 + ch, Level on CC ch), and a main fader of the panel's own. 8 strips, 32 controls in them, 33 in all.
 */
export const EXAMPLE_MIXER: Panel = {
  id: 'mixer',
  name: 'DM-8 mixer',
  templates: {
    strip: {
      params: ['ch'],
      columns: 1,
      children: [
        { type: 'knob', id: 'high', label: 'High', value: 0.5, bind: [{ kind: 'cc', number: '10 + ch' }] },
        { type: 'knob', id: 'mid', label: 'Mid', value: 0.5, bind: [{ kind: 'cc', number: '20 + ch' }] },
        { type: 'switch', id: 'mute', label: 'Mute', bind: [{ kind: 'cc', number: '30 + ch' }] },
        { type: 'fader', id: 'level', label: 'Level', bind: [{ kind: 'cc', number: 'ch' }] },
      ],
    },
  },
  children: [
    { group: 'strips', label: '{ch}', repeat: { name: 'ch', from: 1, to: 8 }, use: 'strip', with: { ch: 'ch' }, overrides: { '8': { label: 'FX' } } },
    { type: 'fader', id: 'main', label: 'Main', bind: [{ kind: 'cc', number: 40 }] },
  ],
};

/**
 * A panel of every kind of control, to play a synth from: an XY pad on the filter (cutoff across, resonance up), the
 * bend and the modulation as faders, two program buttons' worth of switches, a 14-bit volume, an NRPN, the drum pads
 * on channel 10, and two octaves of keys.
 */
export const EXAMPLE_PLAY: Panel = {
  id: 'play',
  name: 'Keys and pads',
  children: [
    {
      group: 'tone',
      label: 'TONE',
      columns: 2,
      children: [
        {
          type: 'xy',
          id: 'filter',
          label: 'Filter',
          value: 0.5,
          cell: { columns: 2 },
          bind: [
            { kind: 'cc', number: 74 },
            { kind: 'cc', number: 71, axis: 'y' },
          ],
        },
        { type: 'knob', id: 'volume', label: 'Volume', value: 0.8, bind: [{ kind: 'cc14', number: 7 }] },
        { type: 'knob', id: 'detune', label: 'Detune', value: 0.5, bind: [{ kind: 'nrpn', number: 300 }] },
      ],
    },
    {
      group: 'wheels',
      label: 'WHEELS',
      children: [
        { type: 'fader', id: 'bend', label: 'Bend', value: 0.5, bind: [{ kind: 'bend' }] },
        { type: 'fader', id: 'mod', label: 'Mod', bind: [{ kind: 'cc', number: 1 }] },
      ],
    },
    {
      group: 'play',
      label: 'PLAY',
      columns: 1,
      children: [
        {
          group: 'row',
          children: [
            { type: 'switch', id: 'hold', label: 'Hold', bind: [{ kind: 'cc', number: 64, channel: 1 }] },
            { type: 'button', id: 'accent', label: 'Accent', bind: [{ kind: 'note', number: 'ch + 35', channel: 'ch' }] },
            { type: 'pads', id: 'pads', label: 'Drums', notes: [36, 38, 42, 46] },
          ],
          repeat: { name: 'ch', from: 10, to: 10 },
          channel: 'ch',
        },
        { type: 'keyboard', id: 'keys', label: 'Keys', low: 48, high: 72 },
      ],
    },
  ],
};
