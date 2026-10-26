import { describe, it, expect } from 'vitest';
import { parseJwt } from '../src/tools/jwt/logic/jwtParser';
import { analyzeJwt } from '../src/tools/jwt/logic/jwtAnalyzer';
import { safeBase64Encode } from '../src/lib/security/safeParser';
import { formatUnixTimestamp } from '../src/lib/formatting/timestamp';

function makeToken(header: object, payload: object, sig = 'mock_signature_123'): string {
  const h = safeBase64Encode(JSON.stringify(header), true).data || '';
  const p = safeBase64Encode(JSON.stringify(payload), true).data || '';
  return `${h}.${p}.${sig}`;
}

describe('JWT Decoder & Analyzer Logic', () => {
  const now = Math.floor(Date.now() / 1000);

  it('correctly decodes a valid JWT token', () => {
    const raw = makeToken(
      { alg: 'RS256', typ: 'JWT', kid: 'k1' },
      { sub: 'user_123', iss: 'https://issuer.com', exp: now + 3600 }
    );

    const parsed = parseJwt(raw);
    expect(parsed.isValidStructure).toBe(true);
    expect(parsed.header?.alg).toBe('RS256');
    expect(parsed.header?.kid).toBe('k1');
    expect(parsed.payload?.sub).toBe('user_123');
    expect(parsed.payload?.iss).toBe('https://issuer.com');
    expect(parsed.hasSignature).toBe(true);
  });

  it('detects malformed tokens with wrong segment count', () => {
    const malformed = 'only.two_parts';
    const parsed = parseJwt(malformed);
    expect(parsed.isValidStructure).toBe(false);
    expect(parsed.parseError).toContain('must contain exactly 3 segments');

    const analysis = analyzeJwt(parsed);
    expect(analysis.overallStatus).toBe('invalid_structure');
    expect(analysis.findings.some(f => f.id === 'malformed-jwt')).toBe(true);
  });

  it('detects invalid Base64URL in header', () => {
    const invalidBase64 = '@@@invalid_header@@@.eyJzdWIiOiIxMjMifQ.sig';
    const parsed = parseJwt(invalidBase64);
    expect(parsed.isValidStructure).toBe(false);
    expect(parsed.parseError).toContain('Header segment is not valid Base64URL');
  });

  it('detects invalid JSON in payload', () => {
    // Valid base64, but not JSON
    const notJsonBase64 = safeBase64Encode('{ this is not json }', true).data!;
    const headerBase64 = safeBase64Encode('{"alg":"HS256"}', true).data!;
    const token = `${headerBase64}.${notJsonBase64}.signature`;

    const parsed = parseJwt(token);
    expect(parsed.isValidStructure).toBe(false);
    expect(parsed.parseError).toContain('Payload JSON is invalid');
  });

  it('flags expired tokens (exp in past)', () => {
    const expiredToken = makeToken(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'usr_abc', exp: now - 3600 } // expired 1 hr ago
    );

    const parsed = parseJwt(expiredToken);
    const analysis = analyzeJwt(parsed);
    const expiredFinding = analysis.findings.find(f => f.id === 'token-expired');
    expect(expiredFinding).toBeDefined();
    expect(expiredFinding?.severity).toBe('medium');
    expect(expiredFinding?.what).toContain('expired');
  });

  it('flags future nbf (not before)', () => {
    const futureToken = makeToken(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'usr_abc', exp: now + 7200, nbf: now + 3600 } // nbf in 1 hour
    );

    const parsed = parseJwt(futureToken);
    const analysis = analyzeJwt(parsed);
    const nbfFinding = analysis.findings.find(f => f.id === 'future-nbf');
    expect(nbfFinding).toBeDefined();
    expect(nbfFinding?.severity).toBe('medium');
  });

  it('flags critical alg: "none" signature bypass vulnerability', () => {
    const noneToken = makeToken(
      { alg: 'none', typ: 'JWT' },
      { sub: 'admin', role: 'superuser' },
      ''
    );

    const parsed = parseJwt(noneToken);
    const analysis = analyzeJwt(parsed);
    const algNoneFinding = analysis.findings.find(f => f.id === 'alg-none');
    expect(algNoneFinding).toBeDefined();
    expect(algNoneFinding?.severity).toBe('critical');
    expect(algNoneFinding?.what).toContain('alg": "none');
  });

  it('flags missing algorithm in header', () => {
    const missingAlgToken = makeToken(
      { typ: 'JWT' }, // missing alg
      { sub: 'admin' }
    );

    const parsed = parseJwt(missingAlgToken);
    const analysis = analyzeJwt(parsed);
    const missingAlgFinding = analysis.findings.find(f => f.id === 'missing-alg');
    expect(missingAlgFinding).toBeDefined();
    expect(missingAlgFinding?.severity).toBe('critical');
  });

  it('flags missing exp claim as high severity', () => {
    const noExpToken = makeToken(
      { alg: 'RS256', typ: 'JWT' },
      { sub: 'admin', iat: now }
    );

    const parsed = parseJwt(noExpToken);
    const analysis = analyzeJwt(parsed);
    const missingExp = analysis.findings.find(f => f.id === 'missing-exp');
    expect(missingExp).toBeDefined();
    expect(missingExp?.severity).toBe('high');
  });

  it('safely rejects oversized payloads without freezing', () => {
    // Generate an oversized 1MB string
    const hugeString = 'a'.repeat(600 * 1024);
    const parsed = parseJwt(hugeString);
    expect(parsed.isValidStructure).toBe(false);
    expect(parsed.parseError).toContain('exceeds the maximum client-side limit');
  });

  it('correctly converts unix epoch timestamps to UTC string and relative duration', () => {
    const sampleEpoch = 1700000000;
    const formatted = formatUnixTimestamp(sampleEpoch);
    expect(formatted).not.toBeNull();
    expect(formatted?.utcString).toContain('2023');
    expect(formatted?.isPast).toBe(true);

    // Non numeric should return null
    expect(formatUnixTimestamp('invalid' as unknown as number)).toBeNull();
  });
});
