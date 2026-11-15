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
