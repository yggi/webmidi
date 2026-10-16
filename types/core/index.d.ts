/**
 * `@yggi/webmidi/core`: the family's MIDI layer, the pure part. No DOM, no Web MIDI, no timers: ports and clocks come in
 * as interfaces (`MidiPort`, `PortAccess`, `OutputClock`), so it runs in a browser, a worker or node alike.
 */
export * from './surfaces';
export * from './keyboard';
export * from './drum-presets';
export * from './port';
export * from './routing';
export * from './clock';
export * from './bend';
export * from './rotation';
export * from './out';
export * from './clock-out';
