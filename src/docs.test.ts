// Lifted from yggi/cells src/docs.test.ts @ 41ef16b (lifted there from yggi/cell-studio src/docs.test.ts @ e168c8d),
// without the language's blocks: INDEX.md lists every page, relative links resolve, every decision is listed, and the
// changelog has its headings.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const DOCS = resolve(import.meta.dirname, '../docs');
const markdown = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? markdown(p) : p.endsWith('.md') ? [p] : [];
  });
const rel = (p: string) => relative(DOCS, p).split('\\').join('/');
const pages = markdown(DOCS);
const read = (p: string) => readFileSync(p, 'utf8');

/** The pages INDEX.md doesn't list: every page but itself and those under a directory it lists as one (decisions/). */
const unlisted = (index: string, paths: readonly string[]): string[] => paths.filter((p) => !/^decisions\//.test(p) && p !== 'INDEX.md' && !index.includes(`](${p})`));

describe('docs: structure', () => {
  const index = read(join(DOCS, 'INDEX.md'));

  it('is shown firing: a page INDEX.md does not link is unlisted', () => {
    expect(unlisted('- [MEMORY.md](MEMORY.md)', ['MEMORY.md', 'notes/new.md', 'decisions/001-x.md'])).toEqual(['notes/new.md']);
  });

  it('INDEX.md lists every page, and decisions/', () => {
    expect(unlisted(index, pages.map(rel))).toEqual([]);
    expect(index).toContain('](decisions/)');
  });

  for (const page of [...pages, ...['README.md', 'AGENTS.md', 'CHANGELOG.md'].map((f) => resolve(DOCS, '..', f))])
    it(`links in ${rel(page)} resolve`, () => {
      const text = read(page).replace(/^```[\s\S]*?^```/gm, '');
      for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const file = resolve(dirname(page), target.split('#')[0]);
        expect(existsSync(file), `${rel(page)} → ${target}`).toBe(true);
      }
    });

  it('every decision linked from MEMORY.md exists, and every decision is linked', () => {
    const memory = read(join(DOCS, 'MEMORY.md'));
    const linked = [...memory.matchAll(/→ (decisions\/[\w.-]+\.md)/g)].map((m) => m[1]);
    for (const target of linked) expect(existsSync(join(DOCS, target)), target).toBe(true);
    const records = readdirSync(join(DOCS, 'decisions')).filter((f) => /^\d{3}-.*\.md$/.test(f));
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) expect(linked, r).toContain(`decisions/${r}`);
  });
});

/** The headings CHANGELOG.md lacks: *Unreleased*, and the version package.json names (the tag a frontend pins) once there is one. */
const changelogMisses = (text: string, version: string): string[] =>
  ['Unreleased', ...(version === '0.0.0' ? [] : [`v${version}`])].filter((h) => !new RegExp(`^## ${h.replace(/\./g, '\\.')}\\b`, 'm').test(text));

describe('docs: the changelog', () => {
  it('is shown firing: a changelog without the version is missing it', () => {
    expect(changelogMisses('## Unreleased\n\n## v0.1.0 — 2026-10-14\n', '0.2.0')).toEqual(['v0.2.0']);
    expect(changelogMisses('## v0.1.0\n', '0.1.0')).toEqual(['Unreleased']);
    expect(changelogMisses('## Unreleased\n', '0.0.0')).toEqual([]);
  });

  it("has Unreleased and a section for package.json's version", () => {
    const { version } = JSON.parse(read(resolve(DOCS, '../package.json')));
    expect(changelogMisses(read(resolve(DOCS, '../CHANGELOG.md')), version)).toEqual([]);
  });
});
