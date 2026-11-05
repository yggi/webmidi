// Lifted from yggi/cells tools/reading-list.test.ts @ 41ef16b, lifted there from yggi/jambot tooling/reading-list.test.ts @ 8871429.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALARM, alarm, BOOT_SET, bootBytes, CEILING, ownBootBytes } from './reading-list';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('the boot set', () => {
  it('is shown firing: a set past the ceiling is over it', () => {
    expect(bootBytes(() => 'x'.repeat(CEILING))).toBeGreaterThan(CEILING);
    expect(bootBytes(() => 'x'.repeat(CEILING / BOOT_SET.length))).toBeLessThanOrEqual(CEILING);
  });

  it('counts bytes, not characters', () => {
    expect(bootBytes(() => '♭')).toBe(3 * BOOT_SET.length);
  });

  it(`stays under ${CEILING / 1024} KB`, () => {
    const bytes = bootBytes((path) => readFileSync(`${root}/${path}`, 'utf8'));
    // Over the ceiling: open an issue and condense the boot set as a change of its own
    // (docs/MEMORY.md moves facts to the pages it points to, and to the modules).
    expect(bytes).toBeLessThanOrEqual(CEILING);
  });
  it('is shown firing: the alarm speaks from 90 % of the ceiling, and not below', () => {
    expect(ALARM).toBe(0.9);
    expect(alarm(Math.ceil(ALARM * CEILING))).toMatch(/^the boot set is \d+ B, 90 % of its ceiling/);
    expect(alarm(Math.ceil(ALARM * CEILING) - 1)).toBeUndefined();
  });

  it('says the alarm, run as a script by the pre-push hook, exactly when the set is past it', () => {
    const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(new URL('./reading-list.ts', import.meta.url))], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout.trim()).toBe(alarm(ownBootBytes()) ?? '');
  });
});
