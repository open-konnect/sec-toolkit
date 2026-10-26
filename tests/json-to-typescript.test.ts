import { describe, it, expect } from 'vitest';
import { generateTypeScriptFromJson } from '../src/tools/json-to-typescript/logic/jsonToTsGenerator';

describe('generateTypeScriptFromJson', () => {
  it('converts a simple flat object to a TypeScript interface', () => {
    const json = '{"name":"Alice","age":30}';
    const result = generateTypeScriptFromJson(json);
    expect(result.success).toBe(true);
    expect(result.code).toContain('interface');
    expect(result.code).toContain('name: string');
    expect(result.code).toContain('age: number');
  });

  it('converts a nested object to nested interfaces', () => {
    const json = '{"user":{"id":1,"email":"a@b.com"}}';
    const result = generateTypeScriptFromJson(json);
    expect(result.success).toBe(true);
    expect(result.code).toContain('interface');
    expect(result.code).toContain('id: number');
    expect(result.code).toContain('email: string');
  });

  it('converts an array of objects to typed array', () => {
    const json = '[{"id":1},{"id":2}]';
    const result = generateTypeScriptFromJson(json);
    expect(result.success).toBe(true);
    expect(result.code).toContain('id: number');
  });

  it('handles primitive types: string, number, boolean, null', () => {
    const json = '{"s":"text","n":42,"b":true,"x":null}';
    const result = generateTypeScriptFromJson(json);
    expect(result.success).toBe(true);
    expect(result.code).toContain('s: string');
    expect(result.code).toContain('n: number');
    expect(result.code).toContain('b: boolean');
    expect(result.code).toContain('x: null');
  });

  it('empty object produces an interface with empty body', () => {
    const json = '{}';
    const result = generateTypeScriptFromJson(json);
    expect(result.success).toBe(true);
    expect(result.code).toContain('interface');
  });

  it('returns empty code for empty input', () => {
    const result = generateTypeScriptFromJson('');
    expect(result.success).toBe(true);
    expect(result.code).toBe('');
  });

  it('returns success false for invalid JSON', () => {
    const result = generateTypeScriptFromJson('{bad json');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('uses custom rootName in the generated interface', () => {
    const json = '{"id":1}';
    const result = generateTypeScriptFromJson(json, { rootName: 'MyModel', declarationType: 'interface' });
    expect(result.success).toBe(true);
    expect(result.code).toContain('MyModel');
  });

  it('can generate type aliases when declarationType is "type"', () => {
    const json = '{"id":1}';
    const result = generateTypeScriptFromJson(json, { rootName: 'Root', declarationType: 'type' });
    expect(result.success).toBe(true);
    expect(result.code).toContain('export type');
  });
});
