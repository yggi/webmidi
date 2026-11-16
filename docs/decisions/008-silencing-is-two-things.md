# 008 · Silencing is two things: a stop that knows, and a sweep that doesn't

**Date:** 2026-11-16 · **Status:** accepted (the owner chose "the third way" in session, on Jambot's move to `MidiOut`, yggi/jambot#680) · Extends the note-off rule in `out.ts`

## Context

`MidiOut.panic` was one operation doing the job of two. It silenced what it knew it had sent (a note-off for each held note, the bends put back) and sent All notes off on the channels it had used, immediately.
Jambot's own output did it differently, and each had something the other lacked:

- **Jambot's** sent All notes off on every configured channel whether or not anything had played, so it worked after a reload; and on stop it let notes already sent ahead sound out, then cut everything a lookahead and 0.4 s later. A timestamped message can't be taken back, so that was kinder to the music, but it leaned on a device honouring All notes off (many don't), and cut notes that hadn't yet ended.
- **Webmidi's** is exact and works on every device, but it forgets what it never sent: after a reload nothing is held, so a panic sends nothing; and it always cuts.

## Decision

- **`panic(now, toDeviceMs, { tail })` is the stop, state-based.** `tail` is how long notes already sent ahead may sound on, in seconds: each is released at its own end but no later than `now + tail`, and a key two notes hold is released when the last ends. `tail` 0, the default, is the cut it was (All notes off now, a note-off at once, or at the start of a note struck ahead). With a tail no All notes off goes, since it would cut the very notes let ring; the note-offs do it exactly. A bend is put back after the last note of its channel has sounded out. `Infinity` lets every note sound out.
- **`sweep(now, toDeviceMs, channels?)` is the panic button, stateless.** All notes off, All sound off and sustain off on each channel (all sixteen by default), now, from nothing `MidiOut` knows. It counts as no use of a channel. A frontend's panic is `panic` then `sweep`.
- **The default changes nothing.** `panic` without options sends what it sent; both additions are new, so Cell studio and `site/` see no change.
- **`ClockOut` is as it was.** A Stop goes just after the last tick already sent and not at all outside a run, which is correct for a device following the clock; a frontend that sent Stop at "now" sent ticks after it.

## Consequences

- A frontend that moves to `MidiOut` from its own output with a deferred All notes off (Jambot) gets its ring-out as `tail`, exact where it was a timer, and no longer depends on the device honouring All notes off.
- The wire is not byte-for-byte what such a frontend sent: the order of All notes off, the note-offs for held notes, and the moment of the last cut differ. The bound for such a move is what the device hears (every onset on time, nothing sounding after a stop, no clock message after Stop), not a byte literal.
- A long `tail` sends note-offs far ahead that can't be recalled; it is for notes within the lookahead.
