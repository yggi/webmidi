/**
 * What a panel's names mean where they stand (decision 005), shared by the editor's operations (`edit.ts`,
 * `templates.ts`), and not part of the surface: the one scoped walk of the names a node's expressions read
 * (`mapNames`: a name is bound by the nearest group that repeats over it, and free otherwise), what it is used for
 * (`freeNames` collects, `templates.ts` renames and substitutes), the parameters in scope at a place, the templates a
 * node uses, and how deep groups go.
 */
import { type NodePath, type Panel, type PanelNode } from './model';
/** A name the reader keeps: a letter or `_`, then letters, digits and `_`, at most 32. Any other is dropped, and with it the key. */
export declare const NAME: RegExp;
export declare const NAME_RULE = "A name starts with a letter or _, then letters, digits and _, up to 32 characters.";
/** The children a path's top is among: the panel's, or a template's (undefined: no such template). */
export declare const topChildren: (panel: Panel, path: NodePath) => readonly PanelNode[] | undefined;
/** An expression, or the `{…}` of a label, with each name it reads (not a function's) given by `to`. */
export declare function renameIn(source: string, braced: boolean, to: (name: string) => string): string;
/** What `mapNames` asks about each name an expression reads: its text there, given the names bound by the repeats around it. */
export type NameMap = (name: string, bound: ReadonlySet<string>) => string;
/**
 * A node with every name its expressions read replaced by `to`'s answer (the name itself leaves it as it was): a
 * control's label, binding numbers, ranges and channels; a group's label, overrides' labels, channel, `with` values and
 * children read the scope the group stands in and its own repeat's name, its repeat's bounds the scope alone. `bound`
 * is what the groups around the node repeat over. A group that uses a template has no children of its own here.
 */
export declare function mapNames(node: PanelNode, to: NameMap, bound?: ReadonlySet<string>): PanelNode;
/** The parameters a node reads from the place it stands in: its own repeat's are its own. */
export declare function freeNames(node: PanelNode): Set<string>;
/** The parameters in scope for the children kept at a container: a template's, and the repeats of the groups on the way down. */
export declare function scopeOf(panel: Panel, container: NodePath): Set<string>;
/** The templates a node uses, and those they use, and so on. */
export declare function usedBy(panel: Panel, node: PanelNode, seen?: Set<string>): Set<string>;
/** How many groups deep a node's own groups go: a control none, a group one more than its deepest child (a template's, counted for a group that uses one). */
export declare function height(panel: Panel, node: PanelNode, seen?: readonly string[]): number;
/** The depth the reader reads the children kept at a container at (top is 1); a template's are counted where it is used, the deepest use. */
export declare function depthAt(panel: Panel, container: NodePath, seen?: readonly string[]): number;
