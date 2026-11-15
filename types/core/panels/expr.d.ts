/**
 * A panel's expressions (decision 005): wherever a panel's file expects a number, a formula may stand, over the names
 * in scope (a group's parameters). The language is total, so a shared panel is safe by design: numbers, names,
 * arithmetic, comparison, `!`, `&&`, `||`, `a ? b : c`, and a fixed set of functions. No loops, no assignment, no
 * strings, no member access, nothing of the host's. It is parsed here and never handed to `eval` or `Function`.
 *
 * A comparison gives 1 or 0, and anything but 0 is true. What isn't a finite number (a division by 0) is 0.
 */
/** The names in scope and their values. */
export type Scope = Readonly<Record<string, number>>;
/** An expression compiled: its value in a scope. A name the scope lacks reads 0. */
export type Expression = (scope: Scope) => number;
/** The longest expression read, in characters. */
export declare const MAX_EXPRESSION = 200;
/** The functions' names, for an editor to offer. */
export declare const EXPRESSION_FUNCTIONS: readonly string[];
/**
 * An expression compiled against the names in scope, or, in words, why it can't be: a name out of scope, a function
 * there is none of, a sign out of place, one too long or too deeply nested.
 */
export declare function compileExpression(source: string, names?: readonly string[]): Expression | string;
