# webmidi

The family's MIDI layer: what [Cell studio](https://github.com/yggi/cell-studio), [Jambot](https://github.com/yggi/jambot) and [KO-Multitool](https://github.com/yggi/KO-Multitool) share about MIDI, as one package, `@yggi/webmidi`, in three layers:

- `@yggi/webmidi/core`: pure TypeScript, no DOM, no Web MIDI, no timers. Messages in (notes, the sustain pedal, the computer's keys, the on-screen keyboard's layout, whole SysEx messages), drum maps, port adoption, the offset between the audio clock and the page's, and out: notes with their bends, and the clock (24 ticks a beat, Start, Stop, Continue, Song Position).
- `@yggi/webmidi/web`: the Web MIDI adapter. Access asked for, SysEx too; the permission query; the ports plugged in, and every port in full for a diagnostic; an input listened to, its notes read; a SysEx transport (whole F0 … F7 messages, each captured) of the shape a device's protocol asks for, as ep133-sysex's `Transport`, without depending on it.
- `@yggi/webmidi/ui` (to come): shared Svelte 5 components, as source.

It doesn't depend on the cells language, nor cells on it. A frontend depends on a tag:

```json
"@yggi/webmidi": "github:yggi/webmidi#vX.Y.Z"
```

No tag is cut yet. Start with [docs/MEMORY.md](https://github.com/yggi/webmidi/blob/main/docs/MEMORY.md) (an absolute link: the package ships no `docs/`). MIT.
