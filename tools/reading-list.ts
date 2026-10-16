// Lifted from yggi/cells tools/reading-list.ts @ 41ef16b, lifted there from yggi/jambot tooling/reading-list.ts @ 8871429.
/**
 * The boot set: what a fresh agent reads before it does anything, `AGENTS.md`
 * (imported by `CLAUDE.md`) and `docs/MEMORY.md` (which `AGENTS.md` names the
 * entry point). Its size has a ceiling, so the reading list stays something an
 * agent takes in whole.
 * Growth goes elsewhere by default: a fact lives next to what it describes.
 * Condensing the boot set is its own deliberate change, made when the ceiling
 * is reached, not a trim tucked into a feature's pull request.
 */
export const BOOT_SET = ['AGENTS.md', 'docs/MEMORY.md'];

/** In bytes: about 4k tokens, two thirds of the family's 24 KB, since this package is small; a ceiling far above the size could never fire. */
export const CEILING = 16 * 1024;

/** The boot set's size in bytes, given a reader of a path's text. */
export function bootBytes(read: (path: string) => string): number {
  return BOOT_SET.reduce((sum, path) => sum + Buffer.byteLength(read(path)), 0);
}
