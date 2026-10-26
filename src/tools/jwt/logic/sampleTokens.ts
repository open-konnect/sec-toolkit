import { safeBase64Encode } from '../../../lib/security/safeParser';

function makeToken(header: object, payload: object, signature = 'TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ'): string {
  const h = safeBase64Encode(JSON.stringify(header), true).data || '';
  const p = safeBase64Encode(JSON.stringify(payload), true).data || '';
  return `${h}.${p}.${signature}`;
}

const now = Math.floor(Date.now() / 1000);

export interface SampleTokenItem {
  id: string;
  name: string;
  description: string;
  token: string;
}

export const SAMPLE_TOKENS: SampleTokenItem[] = [
  {
    id: 'valid-active',
    name: 'Standard RS256 Token',
    description: 'Realistic token with issuer, subject, active expiration, and RSA algorithm',
    token: makeToken(
      { alg: 'RS256', typ: 'JWT', kid: 'auth-key-2026-q1' },
      {
        iss: 'https://auth.example.com/',
        sub: 'usr_948f21e0b',
        aud: ['https://api.example.com/v1', 'https://api.example.com/billing'],
        iat: now - 3600, // issued 1 hour ago
        exp: now + 7200, // expires in 2 hours
        nbf: now - 3600,
        email: 'developer@example.com',
        roles: ['admin', 'security_auditor'],
        jti: 'e29d668f-9a03-4b66-a68d-8fd2301c34a9'
      },
      'dGVzdC1zaWduYXR1cmUtYnl0ZXMtc2FtcGxlLW9ubHktbm90LXZlcmlmaWVk'
    )
  },
  {
    id: 'expired-token',
    name: 'Expired HS256 Token',
    description: 'Token with an expiration date in the past (triggers expired finding)',
    token: makeToken(
      { alg: 'HS256', typ: 'JWT' },
      {
        iss: 'https://auth.example.com',
        sub: 'usr_expired_123',
        iat: now - (86400 * 30), // 30 days ago
        exp: now - (86400 * 15), // expired 15 days ago
        scope: 'read:profile write:profile'
      },
      '4O1U3w4gqDqZ9YqfXmS5_dummy_signature_sample'
    )
  },
  {
    id: 'alg-none',
    name: 'Insecure Token (alg: "none")',
    description: 'Unsigned token with alg: none demonstrating signature bypass risk',
    token: makeToken(
      { alg: 'none', typ: 'JWT' },
      {
        iss: 'https://auth.example.com',
        sub: 'admin_user',
        exp: now + 3600,
        is_admin: true
      },
      '' // No signature segment for alg: none
    )
  },
  {
    id: 'long-lived',
    name: 'Long-Lived Token (> 2 years)',
    description: 'Token with excessive expiration time (triggers excessive lifetime warning)',
    token: makeToken(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: 'https://internal-services.local',
        sub: 'service-worker-daemon',
        iat: now,
        exp: now + (86400 * 365 * 3), // 3 years in future
        role: 'system_daemon'
      },
      'long_lived_sample_signature_data_abcdef'
    )
  }
];
