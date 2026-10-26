import { describe, it, expect } from 'vitest';
import { parseEpoch, parseDateString } from '../src/tools/timestamp-converter/logic/timestampConverter';

describe('parseEpoch', () => {
  it('epoch 0 returns 1970-01-01 ISO string', () => {
    const result = parseEpoch(0);
    expect(result).not.toBeNull();
    expect(result!.isoString).toContain('1970-01-01');
  });

  it('returns correct seconds and milliseconds for epoch 0', () => {
    const result = parseEpoch(0);
    expect(result!.seconds).toBe(0);
    expect(result!.milliseconds).toBe(0);
  });

  it('auto-detects milliseconds for large epoch value', () => {
    // 1700000000000 ms = Nov 2023
    const result = parseEpoch(1700000000000);
    expect(result).not.toBeNull();
    // Should interpret as milliseconds (>= 1e11)
    expect(result!.milliseconds).toBe(1700000000000);
    expect(result!.isoString).toContain('2023');
  });

  it('auto-detects seconds for smaller epoch value', () => {
    // 1700000000 s = Nov 2023
    const result = parseEpoch(1700000000);
    expect(result).not.toBeNull();
    expect(result!.seconds).toBe(1700000000);
  });

  it('accepts epoch as a string', () => {
    const result = parseEpoch('0');
    expect(result).not.toBeNull();
    expect(result!.isoString).toContain('1970-01-01');
  });

  it('returns null for NaN input', () => {
    const result = parseEpoch('not-a-number');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseEpoch('');
    expect(result).toBeNull();
  });

  it('dayOfWeek for epoch 0 is Thursday', () => {
    const result = parseEpoch(0);
    expect(result!.dayOfWeek).toBe('Thursday');
  });
});

describe('parseDateString', () => {
  it('parses ISO string and returns valid epoch timestamps', () => {
    const result = parseDateString('1970-01-01T00:00:00.000Z');
    expect(result).not.toBeNull();
    expect(result!.seconds).toBe(0);
    expect(result!.milliseconds).toBe(0);
  });

  it('parses a known date and returns correct isoString', () => {
    const result = parseDateString('2023-11-14T00:00:00.000Z');
    expect(result).not.toBeNull();
    expect(result!.isoString).toContain('2023-11-14');
  });

  it('returns null for invalid date string', () => {
    const result = parseDateString('not-a-date');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseDateString('');
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    const result = parseDateString('   ');
    expect(result).toBeNull();
  });
});
