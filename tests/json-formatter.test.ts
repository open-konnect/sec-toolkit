import { describe, it, expect } from 'vitest';
import { processJson } from '../src/tools/json-formatter/logic/jsonFormatter';

describe('processJson', () => {
  it('formats valid JSON with default 2-space indent', () => {
    const input = '{"name":"Alice","age":30}';
    const result = processJson(input);
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe(JSON.stringify({ name: 'Alice', age: 30 }, null, 2));
  });

  it('minifies JSON (removes whitespace)', () => {
    const input = '{\n  "a": 1,\n  "b": 2\n}';
    const result = processJson(input);
    expect(result.isValid).toBe(true);
    expect(result.minified).toBe('{"a":1,"b":2}');
  });

  it('validates valid JSON and returns no error', () => {
    const result = processJson('[1, 2, 3]');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns isValid false and error info for malformed JSON', () => {
    const result = processJson('{"key": "value"');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles empty string input gracefully', () => {
    const result = processJson('');
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe('');
    expect(result.minified).toBe('');
    expect(result.byteSize).toBe(0);
  });

  it('handles whitespace-only input as empty', () => {
    const result = processJson('   ');
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe('');
  });

  it('counts keys in nested objects', () => {
    const result = processJson('{"a":{"b":1}}');
    expect(result.isValid).toBe(true);
    expect(result.keyCount).toBeGreaterThan(0);
  });
});
