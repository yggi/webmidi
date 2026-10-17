/**
 * `@yggi/webmidi/testing`: Web MIDI without a device, for tests only (a frontend's and webmidi's own), never for a page.
 * Core's fake ports, access and connection (core/fixtures.ts, held to the purity gate) and web's fake
 * `navigator.requestMIDIAccess` and listened input (web/fixtures.ts, held to the web gate), so a frontend's tests drive
 * the same fakes webmidi's tests do, and they can't drift apart. It imports core and web only, and nothing but a test
 * imports it or a fixtures module (tools/layering.ts).
 */
export { fakeAccess, fakeConnection, fakeInput, fakePort } from '../core/fixtures';
export { fakeListenedInput, installMidi, uninstallMidi } from '../web/fixtures';
