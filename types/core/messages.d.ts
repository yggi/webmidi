export type ChannelMessage = {
    readonly type: 'note_off';
    readonly channel: number;
    readonly note: number;
    readonly velocity: number;
}
/** As on the wire: a note-on at velocity 0 is a note-on here, and a release to `parseMidiMessage`. */
 | {
    readonly type: 'note_on';
    readonly channel: number;
    readonly note: number;
    readonly velocity: number;
} | {
    readonly type: 'poly_aftertouch';
    readonly channel: number;
    readonly note: number;
    readonly pressure: number;
} | {
    readonly type: 'control_change';
    readonly channel: number;
    readonly code: number;
    readonly value: number;
} | {
    readonly type: 'program_change';
    readonly channel: number;
    readonly program: number;
} | {
    readonly type: 'channel_aftertouch';
    readonly channel: number;
    readonly pressure: number;
}
/** 14 bits, 0 … 16383, 8192 the centre (`BEND_CENTRE`). */
 | {
    readonly type: 'pitch_bend';
    readonly channel: number;
    readonly bend: number;
};
export type ChannelMessageType = ChannelMessage['type'];
/**
 * A whole channel message (status 0x80–0xEF) read, or null: a system message, a message cut short, a data byte with its
 * high bit set. Bytes after the message's own are ignored. No running status: Web MIDI delivers whole messages.
 */
export declare function readChannelMessage(data: ArrayLike<number>): ChannelMessage | null;
/** A channel message's bytes. A value past its range is held to it (a data byte never has its high bit set); the channel is 0–15. */
export declare function writeChannelMessage(m: ChannelMessage): number[];
/** The parameter that selects none (MSB and LSB both 127): what follows a Data Entry meant for no parameter. */
export declare const NO_PARAMETER = 16383;
/**
 * A 14-bit controller (0 … 16383) as its two control changes: `code` (0–31) the coarse half, `code + 32` the fine, the
 * coarse first, so a receiver that reads 7 bits is already right.
 */
export declare function controlChange14(channel: number, code: number, value: number): number[][];
/** A parameter of a channel set: which kind, its number (0 … 16383), its value (0 … 16383; a 7-bit device reads the top 7). */
export interface ParameterChange {
    readonly type: 'nrpn' | 'rpn';
    readonly channel: number;
    readonly parameter: number;
    readonly value: number;
}
/**
 * A parameter change as its four control changes, always all four: the parameter selected (MSB, LSB), then Data Entry
 * (MSB, LSB). A device that takes 7 bits is sent `value << 7`, and ignores the last.
 */
export declare function parameterMessages(change: ParameterChange): number[][];
/**
 * Parameter changes out of a stream of control changes, channel by channel. A channel's selection is kept (a device
 * selects once and sends Data Entry many times). Each Data Entry gives a change: the coarse half the value with its
 * fine half 0, the fine half after it the value in full, so a device that sends 7 bits is read at once and one that
 * sends 14 is read twice, the second exact. Data Entry with nothing selected, or after `NO_PARAMETER`, gives nothing.
 */
export declare class ParameterReader {
    private readonly channels;
    /** The parameter change this message completes, or null: any message may be passed, and only control changes are read. */
    read(m: ChannelMessage | null): ParameterChange | null;
    /** Forget what every channel has selected (a port unplugged, a device restarted). */
    reset(): void;
}
