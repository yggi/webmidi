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
export const MAX_EXPRESSION = 200;
/** How deep an expression nests (parentheses, calls, a chain of `-` or `!`, a conditional's branches). */
const MAX_NESTING = 32;

/** The functions, each with how many arguments it takes (null: one or more). */
const FUNCTIONS: Readonly<Record<string, { readonly arity: number | null; readonly fn: (...args: number[]) => number }>> = {
  min: { arity: null, fn: Math.min },
  max: { arity: null, fn: Math.max },
  round: { arity: 1, fn: Math.round },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  abs: { arity: 1, fn: Math.abs },
  /** `clamp(v, lo, hi)`: v held to lo … hi. */
  clamp: { arity: 3, fn: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) },
  /** `scale(x, lo, hi)`: x in 0 … 1 as lo … hi. */
  scale: { arity: 3, fn: (x, lo, hi) => lo + x * (hi - lo) },
};

/** The functions' names, for an editor to offer. */
export const EXPRESSION_FUNCTIONS: readonly string[] = Object.keys(FUNCTIONS);

type Token = { readonly t: 'number'; readonly v: number } | { readonly t: 'name' | 'op'; readonly s: string };

const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|&&|\|\||[-+*/%(),?:<>!]))/y;

function tokens(source: string): Token[] {
  const out: Token[] = [];
  let at = 0;
  TOKEN.lastIndex = 0;
  for (let m; (m = TOKEN.exec(source)); at = TOKEN.lastIndex) {
    if (m[1] !== undefined) out.push({ t: 'number', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'name', s: m[2] });
    else out.push({ t: 'op', s: m[3]! });
  }
  const rest = source.slice(at).trim();
  if (rest) throw new Error(`Can’t read “${rest}”.`);
  if (!out.length) throw new Error('Give a number or an expression.');
  return out;
}

const truth = (v: boolean): number => (v ? 1 : 0);

const BINARY: readonly Readonly<Record<string, (a: number, b: number) => number>>[] = [
  { '==': (a, b) => truth(a === b), '!=': (a, b) => truth(a !== b) },
  { '<': (a, b) => truth(a < b), '<=': (a, b) => truth(a <= b), '>': (a, b) => truth(a > b), '>=': (a, b) => truth(a >= b) },
  { '+': (a, b) => a + b, '-': (a, b) => a - b },
  { '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b },
];

/**
 * An expression compiled against the names in scope, or, in words, why it can't be: a name out of scope, a function
 * there is none of, a sign out of place, one too long or too deeply nested.
 */
export function compileExpression(source: string, names: readonly string[] = []): Expression | string {
  if (source.length > MAX_EXPRESSION) return `An expression is at most ${MAX_EXPRESSION} characters.`;
  try {
    const list = tokens(source);
    let i = 0;
    let depth = 0;
    const op = (s: string): boolean => {
      const t = list[i];
      return t?.t === 'op' && t.s === s ? (i++, true) : false;
    };
    const need = (s: string): void => {
      if (!op(s)) throw new Error(`A “${s}” is missing.`);
    };
    const enter = (): void => {
      if (++depth > MAX_NESTING) throw new Error('The expression is nested too deeply.');
    };

    const primary = (): Expression => {
      const t = list[i++];
      if (!t) throw new Error('The expression ends too soon.');
      if (t.t === 'number') return () => t.v;
      if (t.t === 'op') {
        if (t.s !== '(') throw new Error(`“${t.s}” is out of place.`);
        const inner = conditional();
        need(')');
        return inner;
      }
      const name = t.s;
      if (op('(')) {
        if (!Object.hasOwn(FUNCTIONS, name)) throw new Error(`No function “${name}”. There are: ${EXPRESSION_FUNCTIONS.join(', ')}.`);
        const { arity, fn } = FUNCTIONS[name]!;
        const args: Expression[] = [];
        if (!op(')')) {
          do args.push(conditional());
          while (op(','));
          need(')');
        }
        if (arity === null ? !args.length : args.length !== arity) throw new Error(`“${name}” takes ${arity ?? 'at least 1'} ${arity === 3 ? 'values' : 'value'}.`);
        return (scope) => fn(...args.map((a) => a(scope)));
      }
      if (!names.includes(name)) throw new Error(`No name “${name}” here. In scope: ${names.join(', ') || 'none'}.`);
      return (scope) => (Object.hasOwn(scope, name) ? scope[name]! : 0);
    };

    const unary = (): Expression => {
      enter();
      const sign = op('-') ? '-' : op('!') ? '!' : null;
      const e = sign ? unary() : primary();
      depth--;
      return sign === '-' ? (scope) => -e(scope) : sign === '!' ? (scope) => truth(e(scope) === 0) : e;
    };

    const binary = (level: number): Expression => {
      if (level === BINARY.length) return unary();
      let left = binary(level + 1);
      for (let t = list[i]; t?.t === 'op' && Object.hasOwn(BINARY[level]!, t.s); t = list[i]) {
        i++;
        const fn = BINARY[level]![t.s]!;
        const l = left;
        const r = binary(level + 1);
        left = (scope) => fn(l(scope), r(scope));
      }
      return left;
    };

    const logical = (sign: '&&' | '||', next: () => Expression) => (): Expression => {
      let left = next();
      while (op(sign)) {
        const l = left;
        const r = next();
        left = sign === '&&' ? (scope) => truth(l(scope) !== 0 && r(scope) !== 0) : (scope) => truth(l(scope) !== 0 || r(scope) !== 0);
      }
      return left;
    };
    const or = logical(
      '||',
      logical('&&', () => binary(0)),
    );

    const conditional = (): Expression => {
      enter();
      const test = or();
      let e = test;
      if (op('?')) {
        const yes = conditional();
        need(':');
        const no = conditional();
        e = (scope) => (test(scope) !== 0 ? yes(scope) : no(scope));
      }
      depth--;
      return e;
    };

    const whole = conditional();
    const left = list[i];
    if (left) throw new Error(`“${left.t === 'number' ? left.v : left.s}” is out of place.`);
    return (scope) => {
      const v = whole(scope);
      return Number.isFinite(v) ? v : 0;
    };
  } catch (e) {
    return (e as Error).message;
  }
}
