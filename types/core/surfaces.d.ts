/** A note read off a raw MIDI message. */
export interface ParsedNote {
    readonly on: boolean;
    readonly note: number;
    readonly velocity: number;
    /** The status byte's low nibble, 0–15: channel 1 is 0, channel 10 is 9. */
    readonly channel: number;
    /** When the port saw it (the event's `timeStamp`, ms on the page's clock), not when the page got to it. */
    readonly timeStamp?: number;
}
/**
 * A note-on or note-off, or null for anything else. A note-on with velocity 0 is a note-off, as the spec allows.
 * No running status: Web MIDI delivers whole messages, and a message cut short is nothing (the hub's midi-rx contract).
 */
export declare function parseMidiMessage(data: ArrayLike<number>, timeStamp?: number): ParsedNote | null;
/** The sustain pedal (CC 64) read off a raw message: down (64 … 127) or up, its channel; null for anything else, a message cut short too. */
export declare function parseSustain(data: ArrayLike<number>): {
    readonly down: boolean;
    readonly channel: number;
} | null;
/** a–l for the white keys, w e t y u o for the black ones, C4 to D5. */
export declare const COMPUTER_KEY_MAP: Readonly<Record<string, number>>;
/** 1–7 for a kit, by General MIDI drum note: kick, snare, closed hat, open hat, pedal hat, rim, ride. */
export declare const DRUM_KEY_MAP: Readonly<Record<string, number>>;
/**
 * Whether a keyboard event is to be left alone: a repeat, a modifier chord, or typing into a field. A field is an input,
 * a select, a text area or anything editable (the code editor is a contenteditable, which Jambot's version missed).
 */
export declare function ignoreKeyEvent(target: unknown, repeat: boolean, modifier: boolean): boolean;
