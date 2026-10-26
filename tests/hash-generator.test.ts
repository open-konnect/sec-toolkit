import { describe, it, expect } from 'vitest';
import { computeHash } from '../src/tools/hash-generator/logic/hashCalculator';

describe('computeHash', () => {
  it('SHA-256 of "hello" produces a 64-char hex string', async () => {
    const result = await computeHash('hello', 'SHA-256');
    expect(result.hex).toHaveLength(64);
    expect(result.algorithm).toBe('SHA-256');
  });

  it('SHA-512 of "hello" produces a 128-char hex string', async () => {
    const result = await computeHash('hello', 'SHA-512');
    expect(result.hex).toHaveLength(128);
    expect(result.algorithm).toBe('SHA-512');
  });

  it('SHA-384 of "hello" produces a 96-char hex string', async () => {
    const result = await computeHash('hello', 'SHA-384');
    expect(result.hex).toHaveLength(96);
    expect(result.algorithm).toBe('SHA-384');
  });

  it('hash of empty string returns empty hex and zero lengths', async () => {
    const result = await computeHash('', 'SHA-256');
    expect(result.hex).toBe('');
    expect(result.bitLength).toBe(0);
    expect(result.byteLength).toBe(0);
  });

  it('result hex is lowercase', async () => {
    const result = await computeHash('Hello World', 'SHA-256');
    expect(result.hex).toMatch(/^[0-9a-f]+$/);
  });

  it('SHA-1 is flagged as weak', async () => {
    const result = await computeHash('test', 'SHA-1');
    expect(result.isWeak).toBe(true);
  });

  it('SHA-256 is not flagged as weak', async () => {
    const result = await computeHash('test', 'SHA-256');
    expect(result.isWeak).toBe(false);
  });
});
