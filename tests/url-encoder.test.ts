import { describe, it, expect } from 'vitest';
import { convertUrl } from '../src/tools/url-encoder/logic/urlConverter';

describe('convertUrl', () => {
  it('encodes a space as %20 with component scope', () => {
    const result = convertUrl('hello world', 'encode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello%20world');
  });

  it('decodes %20 back to a space', () => {
    const result = convertUrl('hello%20world', 'decode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello world');
  });

  it('encodes special characters with component scope', () => {
    const result = convertUrl('a=1&b=2', 'encode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toContain('%3D');
    expect(result.output).toContain('%26');
  });

  it('decodes malformed percent-encoding gracefully (no throw)', () => {
    // A bare '%' that is not valid percent-encoding
    const result = convertUrl('%ZZ', 'decode', 'component');
    // Should not throw – must return a result object
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('full URI encode does not encode : / ? # etc.', () => {
    const result = convertUrl('https://example.com/path?q=hello world', 'encode', 'full');
    expect(result.success).toBe(true);
    expect(result.output).toContain('https://');
    expect(result.output).toContain('%20');
  });

  it('component encode encodes : and /', () => {
    const result = convertUrl('https://example.com', 'encode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toContain('%3A');
    expect(result.output).toContain('%2F');
  });

  it('returns empty output for empty input', () => {
    const result = convertUrl('', 'encode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toBe('');
  });

  it('decodes + as space in decode mode', () => {
    const result = convertUrl('hello+world', 'decode', 'component');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello world');
  });
});
