/**
 * `@yggi/webmidi/web`: the Web MIDI adapter. It touches the browser (the DOM's Web MIDI types, `navigator`), and reads
 * core; a frontend takes both, core for what it does with the messages and the ports, web for the connection.
 */
// The connection: Web MIDI asked for (SysEx too, or not), the ports plugged in, an input listened to, notes read.
export * from './access';
// The ports in full, for a diagnostic, and a device's port guessed by its name.
export * from './ports';
// SysEx to a device and back, whole messages, every one captured.
export * from './transport';
