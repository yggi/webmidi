// `@yggi/webmidi/testing`: the fakes a frontend's tests drive are on the surface, shipped with their types, and drive
// webmidi as a page would (yggi/webmidi#6).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ParsedNote } from '../core/surfaces';
import { MidiAccess } from '../web/access';
import * as testing from './index';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { exports: Record<string, { types: string; default: string }> };

afterEach(testing.uninstallMidi);

describe('@yggi/webmidi/testing', () => {
  it("has core's fakes and web's, and nothing else", () => {
    expect(Object.keys(testing).sort()).toEqual(['fakeAccess', 'fakeConnection', 'fakeInput', 'fakeListenedInput', 'fakePort', 'installMidi', 'uninstallMidi']);
  });

  it('is an export of the package, its source and its declarations both there', () => {
    const entry = pkg.exports['./testing']!;
    expect(entry).toEqual({ types: './types/testing/index.d.ts', default: './src/testing/index.ts' });
    expect(existsSync(entry.default) && existsSync(entry.types)).toBe(true);
  });

  it('is held to the web gate: in tsconfig.web.json and not in the purity gate, which refuses a Node global there', () => {
    const tsc = (project: string, ...args: string[]) =>
      execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', project, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const listed = (project: string) =>
      tsc(project, '--listFilesOnly')
        .split('\n')
        .map((f) => resolve(f.trim()));
    const fakes = ['src/testing/index.ts', 'src/core/fixtures.ts', 'src/web/fixtures.ts'].map((f) => resolve(f));
    for (const f of fakes) expect(listed('tsconfig.web.json'), f).toContain(f);
    expect(listed('tsconfig.pure.json')).not.toContain(fakes[0]);
    // the gate firing: the same options over a fake that reaches for Node
    const dir = mkdtempSync(join(tmpdir(), 'webmidi-web-gate-'));
    writeFileSync(join(dir, 'fake.ts'), 'export const where = process.cwd();\n');
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ extends: resolve('tsconfig.web.json'), include: [join(dir, 'fake.ts')] }));
    const refused = (() => {
      try {
        return tsc(join(dir, 'tsconfig.json'));
      } catch (e) {
        return `refused: ${(e as { stdout: string }).stdout}`;
      }
    })();
    expect(refused).toMatch(/^refused: [^]*Cannot find name 'process'/);
  }, 60_000);

  it('is shipped: npm pack holds the fakes and their declarations, and no test', () => {
    const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as [{ files: { path: string }[] }];
    const paths = packed.files.map((f) => f.path);
    for (const path of ['src/testing/index.ts', 'src/core/fixtures.ts', 'src/web/fixtures.ts', 'types/testing/index.d.ts', 'types/core/fixtures.d.ts', 'types/web/fixtures.d.ts'])
      expect(paths, path).toContain(path);
    expect(paths.filter((p) => p.endsWith('.test.ts'))).toEqual([]);
  }, 20_000);

  it("drives webmidi as a frontend's test would: a fake access installed, a key played into its input, a note sent to its output", async () => {
    const input = testing.fakeInput('in-1', 'Keys');
    const output = testing.fakePort('out-1', 'Synth');
    testing.installMidi(testing.fakeAccess([input], [output]));
    const heard: ParsedNote[] = [];
    const midi = await MidiAccess.connect({ onNote: (note) => heard.push(note) });
    if (typeof midi === 'string') throw new Error(midi);
    midi.listen('all');
    input.play([0x90, 60, 100], 12.5);
    expect(heard).toEqual([{ on: true, note: 60, velocity: 100, channel: 0, timeStamp: 12.5 }]);
    midi.outputPort('out-1')?.send([0x80, 60, 0]);
    expect(output.sent).toEqual([{ data: [0x80, 60, 0], timestamp: undefined }]);
  });
});
