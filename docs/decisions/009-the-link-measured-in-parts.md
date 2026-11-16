# 009 · The link is measured in parts, rated in two tiers, and the tiers say they are speculative

**Date:** 2026-11-16 · **Status:** accepted (the owner approved the numbers and thresholds of yggi/webmidi#75 as written) · Tiers speculative until hardware numbers replace them

## Context

`ThruMeter` reads only what the page adds to a message it passes on. Nothing sent a probe and timed it back, so a frontend could not say how stable a MIDI connection is, and Jambot's timing budget (yggi/jambot#27) had no MIDI path in it. A device's latency offset is another thing: it compensates the time from a message to its sound, and the link (page, driver, cable or USB, back) is a few milliseconds and says nothing of that.

## Decision

- **Measured apart, in parts.** A probe leaves at `Ts` and comes back at `Tr` (the event's `timeStamp`), handled at `Th`. Page lag = `Th − Tr`, loop = `Tr − Ts`. One way = loop / 2 is an assumption, since one clock cannot tell the out from the in, and the report and the page say so. Wire time per byte (3 bytes against a long SysEx) is not measured: the report carries `wireMsPerByte: null`.
- **True names.** *Loop*, *page lag* and *one way* are three things, and none of them is called latency; the device's latency offset keeps that word.
- **Core is pure.** `LinkMeter` takes the times the frontend gives it. The probe is a control change on controller 119 (the last of the undefined 102 … 119, none of the channel modes from 120) on channel 16 with the probe's number as its value; it wraps every 128 and a long run counts its wraps. A probe is matched to the oldest one of its number still within the timeout, so a lost probe a wrap before is never taken for it.
- **The bounds, as approved.** Quick run 100 probes 20 ms apart (2 s); long run 600 probes 100 ms apart (60 s); `LEAD` 20 ms; `TIMEOUT` 250 ms. A probe that comes back after the timeout is lost.
- **Timestamps honoured?** Probes alternate between scheduled (`LEAD` ahead) and at once. Counted from the call, the scheduled ones take `LEAD` longer when the platform honours timestamps and about the same when it doesn't; at least 75 % of `LEAD` is yes, at most 25 % is no, between is "not known", as is fewer than 5 of either kind. The loop is counted from when a probe left: the call, or the time asked for where honoured; scheduled probes are left out of it when not known.
- **Drift needs a span.** A least-squares slope over 2 s is noise, so drift is reported only over 30 s or more (`LINK_DRIFT_SPAN`): a quick run says "not measured", a long run measures it.
- **Two tiers**, `tight`, `good`, `loose`, `poor`, each the worst of its rows, each limit inclusive (`LINK_LIMITS`, one place, every boundary tested on both sides). Scheduled: jitter, loss, drift, and timestamps (not honoured is `poor`, since sending ahead is the premise). Played: one way + page lag (the median), capped by the jitter's tier. With no loop the page lag alone rates a played tier, said so. A reason is given in words.
- **Speculative.** Every tier is marked so in the report (`tiersSpeculative`), the page and the docs until real hardware numbers (yggi/jambot#27 step 5, yggi/jambot#242) replace the limits.
- **Only when asked.** The probe goes out when the person presses the button, and the page says so.

## Consequences

- A frontend's timing export can carry a `LinkReport`, and a budget can read the MIDI path from it. A shape for the family is a contract in yggi/music-commons, for the owner to ask for.
- The device's latency is not set from the link.
- The limits will move when measured; a moved limit is a change to `LINK_LIMITS` and its tests.
- Left for later, each its own issue: a live tier chip from the passive page lag (yggi/webmidi#77: the page lag is measured on an input, so where the chip sits is open), and the wire time per byte (yggi/webmidi#78, speculative, needs SysEx).
