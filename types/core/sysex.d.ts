/**
 * Split a byte stream into complete SysEx messages (F0 … F7). A browser may deliver one message across several events,
 * or several in one; the bytes before an F0 are dropped, and an F0 before the F7 starts the message again.
 */
export declare class SysexAssembler {
    private buf;
    push(chunk: Iterable<number>): Uint8Array[];
    /** Bytes held back because no F7 has arrived yet. */
    get pending(): number;
}
