import { type NodePath, type Panel } from './model';
/**
 * Why the group at `path` can't be made a template of this name, in words; undefined when it can. It must be a group
 * that holds its children, the name one the reader keeps and no template's, and the template it stands in not one it
 * would then use.
 */
export declare const templateProblem: (panel: Panel, path: NodePath, name: string) => string | undefined;
/**
 * The group at `path` made a template of this name: its children move into it, with the names they read that the
 * group's scope gave as its parameters, and the group uses it, giving each its own name. The group keeps its repeat,
 * channel, label, overrides and columns (the template has the columns too). As it was when `templateProblem` has
 * something to say.
 */
export declare const extractTemplate: (panel: Panel, path: NodePath, name: string) => Panel;
/**
 * Why the group at `path` can't be detached from its template, in words; undefined when it can. It must use a template
 * that is there, give every parameter a value its scope reads that goes in the parameter's place exactly (no division,
 * no name a repeat inside the template would capture), and hold the template's children at a depth the reader reads.
 */
export declare const detachProblem: (panel: Panel, path: NodePath) => string | undefined;
/**
 * The group at `path` holding a copy of its template's children, its `with` values in place of the parameters, so what
 * plays is the same. The template stays for the groups that still use it and is taken out of the panel when none
 * does. As it was when `detachProblem` has something to say.
 */
export declare const detachTemplate: (panel: Panel, path: NodePath) => Panel;
/** Why a template can't be called this, in words; undefined when it can: there is one of that name, the name is one the reader keeps, and no template has it. */
export declare const renameTemplateProblem: (panel: Panel, from: string, to: string) => string | undefined;
/** A template under another name, every group that uses it following. As it was when `renameTemplateProblem` has something to say. */
export declare const renameTemplate: (panel: Panel, from: string, to: string) => Panel;
/**
 * Why a template’s parameter can't be called this, in words; undefined when it can: the template has the parameter,
 * the name is one the reader keeps, no parameter has it, the template doesn't read it already, and no repeat inside
 * binds it around a place the parameter is read.
 */
export declare const renameParamProblem: (panel: Panel, template: string, from: string, to: string) => string | undefined;
/** A template's parameter under another name: every expression in the template and every `with` of the groups that use it follows. As it was when `renameParamProblem` has something to say. */
export declare const renameParam: (panel: Panel, template: string, from: string, to: string) => Panel;
