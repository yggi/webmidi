import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN, importsOf, violations } from './layering';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? sources(join(dir, f)) : /\.(ts|js|mjs|svelte)$/.test(f) ? [join(dir, f)] : []));

const file = (path: string, ...specs: string[]) => ({ path, text: specs.map((s) => `import { x } from '${s}';`).join('\n') });

describe('the layering', () => {
  it('is shown firing: the language, each frontend, a package in core or web, a layer above, a path out of src/', () => {
    const bad = [
      file('src/core/a.ts', '@yggi/cells'),
      file('src/web/a.ts', '@yggi/cells/engine/midi'),
      file('src/ui/a.ts', 'cell-studio/src/midi/out'),
      file('src/web/b.ts', '@jambot/engine'),
      file('src/web/c.ts', 'jambot'),
      file('src/web/d.ts', 'ko133-multitool'),
      file('src/core/b.ts', 'some-package'),
      file('src/core/c.ts', '../web/access'),
      file('src/web/e.ts', '../ui/Keys.svelte'),
      file('src/core/d.ts', '../../tools/layering'),
      file('src/core/e.ts', 'node:fs'),
      file('src/web/f.ts', '@yggi/ep133-sysex'),
      file('src/web/g.ts', 'node:fs'),
      file('src/web/h.test.ts', 'some-package'),
    ];
    expect(violations(bad)).toHaveLength(bad.length);
    expect(FORBIDDEN).toHaveLength(5);
  });

  it('reads every form of import: from, export from, a bare import and a dynamic one', () => {
    const text = `import a from '@yggi/cells';\nexport { b } from "./b";\nimport './c';\nconst d = await import('./d');\nimport type { E } from '../e';`;
    expect(importsOf(text)).toEqual(['@yggi/cells', './b', './c', './d', '../e']);
  });

  it('lets a layer import itself and those below, a core or web test its runner and Node, and ui a package', () => {
    const good = [
      file('src/core/a.ts', './b', './c.ts'),
      file('src/core/a.test.ts', 'vitest', 'node:fs', './a', './fixtures'),
      file('src/web/a.ts', '../core/out', './b'),
      file('src/web/a.test.ts', 'vitest', 'node:fs', '../core/fixtures', './fixtures'),
      file('src/ui/a.ts', '../core/out', '../web/access', 'svelte'),
    ];
    expect(violations(good)).toEqual([]);
  });

  it('holds over src/', () => {
    const files = sources(join(root, 'src')).map((p) => ({ path: relative(root, p).split('\\').join('/'), text: readFileSync(p, 'utf8') }));
    expect(files.length).toBeGreaterThan(0);
    expect(violations(files)).toEqual([]);
  });
});
