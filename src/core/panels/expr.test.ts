import { describe, expect, it } from 'vitest';
import { compileExpression, EXPRESSION_FUNCTIONS, MAX_EXPRESSION } from './expr';

const value = (source: string, scope: Record<string, number> = {}): number | string => {
  const e = compileExpression(source, Object.keys(scope));
  return typeof e === 'string' ? e : e(scope);
};

describe('compileExpression', () => {
  it.each([
    ['7', 7],
    ['.5 + 1.25', 1.75],
    ['10 + ch', 13],
    ['20 + ch * 2', 26],
    ['(20 + ch) * 2', 46],
    ['10 - 2 - 3', 5],
    ['7 % 4', 3],
    ['-ch + 1', -2],
    ['--ch', 3],
    ['ch == 3', 1],
    ['ch != 3', 0],
    ['ch < 3 || ch >= 3', 1],
    ['ch > 1 && ch <= 2', 0],
    ['!ch', 0],
    ['!0', 1],
    ['ch > 2 ? 100 : 200', 100],
    ['ch > 5 ? 100 : ch > 2 ? 50 : 0', 50],
    ['1 + 2 == 3', 1],
    ['min(ch, 2, 9)', 2],
    ['max(ch, 2)', 3],
    ['round(2.5) + floor(2.9) + ceil(2.1) + abs(-1)', 9],
    ['clamp(ch * 100, 0, 127)', 127],
    ['scale(0.5, 10, 20)', 15],
  ])('%s is %d with ch = 3', (source, expected) => {
    expect(value(source, { ch: 3 })).toBe(expected);
  });

  it('gives 0 for what is no finite number, and for a name its scope lacks', () => {
    expect(value('1 / 0')).toBe(0);
    expect(value('0 / 0')).toBe(0);
    expect(value('5 % 0')).toBe(0);
    const e = compileExpression('ch', ['ch']);
    expect(typeof e === 'function' && e({})).toBe(0);
  });

  it.each([
    ['', 'Give a number or an expression.'],
    ['   ', 'Give a number or an expression.'],
    ['chan + 1', 'No name “chan” here. In scope: ch.'],
    ['sqrt(4)', `No function “sqrt”. There are: ${EXPRESSION_FUNCTIONS.join(', ')}.`],
    ['1 +', 'The expression ends too soon.'],
    ['(1 + 2', 'A “)” is missing.'],
    ['1 2', '“2” is out of place.'],
    ['* 2', '“*” is out of place.'],
    ['ch ? 1', 'A “:” is missing.'],
    ['round(1, 2)', '“round” takes 1 value.'],
    ['clamp(1)', '“clamp” takes 3 values.'],
    ['min()', '“min” takes at least 1 value.'],
    ['ch = 3', 'Can’t read “= 3”.'],
    ['"a"', 'Can’t read “"a"”.'],
    ['ch.x', 'Can’t read “.x”.'],
    ['a[0]', 'Can’t read “[0]”.'],
  ])('%s is refused in words', (source, why) => {
    expect(value(source, { ch: 3 })).toBe(why);
  });

  it('reaches nothing of the host: a name is in scope or refused, a function is one of its own', () => {
    for (const source of ['constructor', '__proto__', 'globalThis', 'toString(1)', 'constructor(1)', 'hasOwnProperty(1)']) expect(typeof value(source), source).toBe('string');
    // a parameter named as a property of every object is still only the scope's own
    const e = compileExpression('toString + 1', ['toString']);
    expect(typeof e === 'function' && e({})).toBe(1);
  });

  it('is bounded: its length, and how deep it nests', () => {
    expect(value(`1${' + 1'.repeat(49)}`)).toBe(50);
    expect(value(`1${' + 1'.repeat(50)}`)).toBe(`An expression is at most ${MAX_EXPRESSION} characters.`);
    expect(value(`${'('.repeat(15)}1${')'.repeat(15)}`)).toBe(1);
    expect(value(`${'('.repeat(40)}1${')'.repeat(40)}`)).toBe('The expression is nested too deeply.');
    expect(value(`${'-'.repeat(40)}1`)).toBe('The expression is nested too deeply.');
  });
});
