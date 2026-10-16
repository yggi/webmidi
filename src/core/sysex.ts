// Lifted from yggi/ep133-sysex src/frame.ts @ ca8d819 (SysexAssembler, with its SOX and EOX). Pure: a byte stream in,
// whole SysEx messages out, so any host's transport (the Web MIDI one in `web`, a socket, a fake) can use it.

const SOX = 0xf0;
const EOX = 0xf7;

/**
 * Split a byte stream into complete SysEx messages (F0 … F7). A browser may deliver one message across several events,
 * or several in one; the bytes before an F0 are dropped, and an F0 before the F7 starts the message again.
 */
export class SysexAssembler {
  private buf: number[] = [];

  push(chunk: Iterable<number>): Uint8Array[] {
    const out: Uint8Array[] = [];
    for (const b of chunk) {
      if (b === SOX) this.buf = [b];
      else if (this.buf.length) {
        this.buf.push(b);
        if (b === EOX) {
          out.push(Uint8Array.from(this.buf));
          this.buf = [];
        }
      }
    }
    return out;
  }

  /** Bytes held back because no F7 has arrived yet. */
  get pending(): number {
    return this.buf.length;
  }
}
