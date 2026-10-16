/**
 * `@yggi/webmidi/web`: the Web MIDI adapter. It touches the browser (the DOM's Web MIDI types, `navigator`), and reads
 * core; a frontend takes both, core for what it does with the messages and the ports, web for the connection.
 */
export * from './access';
export * from './ports';
export * from './transport';
