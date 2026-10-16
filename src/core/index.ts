/**
 * `@yggi/webmidi/core`: the family's MIDI layer, the pure part. No DOM, no Web MIDI, no timers: ports and clocks come in
 * as interfaces (`MidiPort`, `PortAccess`, `OutputClock`), so it runs in a browser, a worker or node alike.
 */
// Messages in: notes and the sustain pedal off the wire, the computer's keys, the on-screen keyboard.
export * from './surfaces';
export * from './keyboard';
export * from './drum-presets';
// Ports: what a connection is, and adopting the ones chosen as they come and go.
export * from './port';
export * from './routing';
