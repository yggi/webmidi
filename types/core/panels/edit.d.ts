/**
 * A panel edited (decision 005, the editor's pure part): each operation takes a panel and a place (`NodePath`) and
 * gives a new panel, so an editor keeps nothing of its own but what is selected. A place inside a template is the
 * template's, so a change there is a change to every group that uses it; adding into a group that uses a template
 * adds to the template. An operation on a place that isn't there gives the panel as it was.
 */
import { type Binding, type Control, type ControlType, type Group, type NodePath, type Panel, type PanelNode } from './model';
export declare const samePath: (a: NodePath | null | undefined, b: NodePath | null | undefined) => boolean;
/** The node at a place, or undefined: nothing there, or the empty path (which is the panel or the template itself). */
export declare function nodeAt(panel: Panel, path: NodePath): PanelNode | undefined;
/**
 * Where a node's children are kept: the place itself for the panel, a template, or a group with children inline; the
 * template for a group that uses one; undefined for a control, or nothing there.
 */
export declare function containerOf(panel: Panel, path: NodePath): NodePath | undefined;
/** The children kept at a container's place (`containerOf`), or undefined. */
export declare function childrenAt(panel: Panel, container: NodePath): readonly PanelNode[] | undefined;
/** The node at a place changed. */
export declare function updateNode(panel: Panel, path: NodePath, change: (node: PanelNode) => PanelNode): Panel;
/** A node put among a container's children, last or at an index: the panel, and the node's place. */
export declare function insertNode(panel: Panel, container: NodePath, node: PanelNode, index?: number): {
    panel: Panel;
    path: NodePath;
};
export declare function removeNode(panel: Panel, path: NodePath): Panel;
/** A node moved among its siblings, one earlier (`-1`) or later (`1`): the panel, and its place now (as it was at an end). */
export declare function moveNode(panel: Panel, path: NodePath, by: -1 | 1): {
    panel: Panel;
    path: NodePath;
};
/** A node again right after itself, under a name of its own: the panel, and the copy's place. */
export declare function duplicateNode(panel: Panel, path: NodePath): {
    panel: Panel;
    path: NodePath;
};
/**
 * A new control of a type, to put among `siblings`: named after its type, and bound so it does something at once (a
 * knob, a fader and a switch to the panel's next free controller, an XY pad to the next two, a button to middle C).
 */
export declare function newControl(panel: Panel, type: ControlType, siblings: readonly PanelNode[]): Control;
/** A new group, to put among `siblings`: empty, its children in a row. */
export declare const newGroup: (siblings: readonly PanelNode[]) => Group;
/** A binding of another kind: its number kept where the new kind has one, its range dropped (each kind has its own). */
export declare function ofKind(binding: Binding, kind: Binding['kind']): Binding;
