/**
 * The layering (AGENTS.md), as a check over what each file under `src/` imports:
 *
 * - Nothing imports the language, `@yggi/cells`, or a frontend (Cell studio, Jambot, KO-Multitool): webmidi sits below
 *   the frontends and beside cells, and cells never imports webmidi either (the owner's decision, 2026-10-16).
 * - `core` imports only `core`, and `web` only `core` and `web`: no package at all (webmidi has no runtime dependencies,
 *   so `web` meets a device's protocol, such as ep133-sysex's `Transport`, by its shape, not by importing it). Their
 *   tests may import their runner and Node's own modules besides.
 * - `ui` may import `core` and `web`, and packages (Svelte); none of them the other way round.
 * - A relative import never leaves `src/`.
 *
 * The purity of `core` (no host types) is the typecheck's (tsconfig.pure.json); this is about where imports point.
 */
import { posix } from 'node:path';

/** The packages no file here may import: the language, and the frontends by their package names. */
export const FORBIDDEN: readonly RegExp[] = [/^@yggi\/cells(\/|$)/, /^cell-studio(\/|$)/, /^jambot(\/|$)/, /^@jambot\//, /^ko133-multitool(\/|$)/];

/** The layers, lowest first: a file may import its own layer and those below it. */
const LAYERS = ['core', 'web', 'ui'] as const;

/** The layers that import no package. */
const NO_PACKAGES: readonly string[] = ['core', 'web'];

/** What a test may import besides: its runner and Node's modules. */
const TEST_ONLY = /^(vitest(\/|$)|node:)/;

/** The specifiers a source file imports: `import … from`, `export … from`, a bare `import '…'`, and `import('…')`. */
export function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g)) out.push(m[2]!);
  return out;
}

const layerOf = (path: string) => LAYERS.find((layer) => path.startsWith(`src/${layer}/`));

/** Each import that breaks the layering, as `file → specifier: why`; none for files that keep it. Paths are from the root. */
export function violations(files: readonly { readonly path: string; readonly text: string }[]): string[] {
  const out: string[] = [];
  for (const { path, text } of files) {
    const layer = layerOf(path);
    const test = /\.test\.ts$/.test(path);
    for (const spec of importsOf(text)) {
      const bad = (why: string) => out.push(`${path} → ${spec}: ${why}`);
      if (FORBIDDEN.some((re) => re.test(spec))) {
        bad('the language or a frontend, which webmidi never imports');
        continue;
      }
      if (spec.startsWith('.')) {
        const target = posix.normalize(posix.join(posix.dirname(path), spec));
        const to = layerOf(target);
        if (!target.startsWith('src/')) bad('outside src/');
        else if (layer && to && LAYERS.indexOf(to) > LAYERS.indexOf(layer)) bad(`${layer} imports ${to}, a layer above it`);
        continue;
      }
      if (layer && NO_PACKAGES.includes(layer) && !(test && TEST_ONLY.test(spec))) bad(`${layer} imports no package: webmidi has no runtime dependencies`);
    }
  }
  return out;
}
