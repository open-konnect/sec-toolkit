import { describe, it, expect } from 'vitest';
import { testRegex } from '../src/tools/regex-tester/logic/regexMatcher';

describe('testRegex', () => {
  it('valid pattern finds a match in test string', () => {
    const result = testRegex('hello', '', 'say hello world');
    expect(result.isValid).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].match).toBe('hello');
  });

  it('invalid regex returns isValid false and error message (no throw)', () => {
    const result = testRegex('[unclosed', '', 'test string');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.matches).toHaveLength(0);
  });

  it('global flag finds all matches', () => {
    const result = testRegex('a', 'g', 'banana');
    expect(result.isValid).toBe(true);
    expect(result.matches.length).toBe(3);
    expect(result.matches.every(m => m.match === 'a')).toBe(true);
  });

  it('capture groups are returned in groups array', () => {
    const result = testRegex('(\\w+)\\s(\\w+)', '', 'hello world');
    expect(result.isValid).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].groups).toEqual(['hello', 'world']);
  });

  it('replace mode replaces matched text correctly', () => {
    const result = testRegex('world', 'g', 'hello world', 'vitest');
    expect(result.isValid).toBe(true);
    expect(result.replacedText).toBe('hello vitest');
  });

  it('empty pattern returns empty matches with isValid true', () => {
    const result = testRegex('', '', 'anything');
    expect(result.isValid).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it('case-insensitive flag finds match regardless of case', () => {
    const result = testRegex('HELLO', 'i', 'say hello world');
    expect(result.isValid).toBe(true);
    expect(result.matches).toHaveLength(1);
  });

  it('no match returns empty matches array', () => {
    const result = testRegex('xyz', '', 'hello world');
    expect(result.isValid).toBe(true);
    expect(result.matches).toHaveLength(0);
  });
});
