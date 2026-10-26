import { describe, it, expect } from 'vitest';
import { convertBase64 } from '../src/tools/base64/logic/base64Converter';

describe('Base64 & Base64URL Converter Logic', () => {
  it('encodes and decodes standard ASCII text', () => {
    const raw = 'Hello World';
    const encoded = convertBase64(raw, { mode: 'encode', variant: 'standard' });
    expect(encoded.success).toBe(true);
    expect(encoded.output).toBe('SGVsbG8gV29ybGQ=');

    const decoded = convertBase64(encoded.output, { mode: 'decode', variant: 'standard' });
    expect(decoded.success).toBe(true);
    expect(decoded.output).toBe(raw);
  });

  it('correctly handles multi-byte UTF-8 Unicode and emojis without corruption', () => {
    const unicodeText = '🔐 Security & Privacy 🚀 — 100% 浏览器 (Browser) Client-Side 💻';
    const encoded = convertBase64(unicodeText, { mode: 'encode', variant: 'standard' });
    expect(encoded.success).toBe(true);

    const decoded = convertBase64(encoded.output, { mode: 'decode', variant: 'standard' });
    expect(decoded.success).toBe(true);
    expect(decoded.output).toBe(unicodeText);
  });

  it('encodes and decodes Base64URL without plus, slash, or padding', () => {
    // String containing characters that would generate + and / in standard base64
    const text = 'subjects?user=123&action=delete>>45';
    const standard = convertBase64(text, { mode: 'encode', variant: 'standard' });
    const urlSafe = convertBase64(text, { mode: 'encode', variant: 'urlSafe' });

    expect(urlSafe.success).toBe(true);
    expect(urlSafe.output).not.toContain('+');
    expect(urlSafe.output).not.toContain('/');
    expect(urlSafe.output).not.toContain('=');

    // Decode URL-safe back to original
    const decodedUrlSafe = convertBase64(urlSafe.output, { mode: 'decode', variant: 'urlSafe' });
    expect(decodedUrlSafe.success).toBe(true);
    expect(decodedUrlSafe.output).toBe(text);
  });

  it('handles empty input gracefully', () => {
    const res = convertBase64('', { mode: 'encode', variant: 'standard' });
    expect(res.success).toBe(true);
    expect(res.output).toBe('');

    const resDec = convertBase64('', { mode: 'decode', variant: 'standard' });
    expect(resDec.success).toBe(true);
    expect(resDec.output).toBe('');
  });

  it('handles malformed base64 input in decode mode without throwing', () => {
    const malformed = 'Not@Valid$Base64!!';
    const res = convertBase64(malformed, { mode: 'decode', variant: 'standard' });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
