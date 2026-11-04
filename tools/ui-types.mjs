// `ui`'s declarations (types/ui/), which tsc can't write for .svelte files: svelte2tsx's `emitDts`, as @sveltejs/package
// uses it, over tsconfig.ui.json. It writes every module the program reads; only ui/ is kept, since tsc writes the
// others (tsconfig.types.json). `npm run types` runs it after tsc; tools/types.test.ts holds types/ to both.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { emitDts } from 'svelte2tsx';

const require = createRequire(import.meta.url);

/** Write `ui`'s declarations into `<out>/ui` (types/ by default), replacing what was there. */
export async function uiTypes(out = 'types') {
  const scratch = mkdtempSync(join(tmpdir(), 'webmidi-ui-types-'));
  await emitDts({
    libRoot: resolve('src'),
    declarationDir: scratch,
    svelteShimsPath: require.resolve('svelte2tsx/svelte-shims-v4.d.ts'),
    tsconfig: resolve('tsconfig.ui.json'),
  });
  rmSync(join(out, 'ui'), { recursive: true, force: true });
  cpSync(join(scratch, 'ui'), join(out, 'ui'), { recursive: true });
  rmSync(scratch, { recursive: true, force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) await uiTypes(process.argv[2]);
