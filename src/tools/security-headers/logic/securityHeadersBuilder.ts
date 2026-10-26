import { SecurityHeaderItem, SecurityHeadersResult } from '../types';

export const DEFAULT_SECURITY_HEADERS: SecurityHeaderItem[] = [
  {
    id: 'hsts',
    name: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
    enabled: true,
    recommendedValue: 'max-age=31536000; includeSubDomains; preload',
    description: 'Enforces encrypted HTTPS connections and mitigates SSL-stripping attacks.'
  },
  {
    id: 'nosniff',
    name: 'X-Content-Type-Options',
    value: 'nosniff',
    enabled: true,
    recommendedValue: 'nosniff',
    description: 'Prevents MIME-type sniffing, stopping browsers from executing non-script assets as scripts.'
  },
  {
    id: 'xframe',
    name: 'X-Frame-Options',
    value: 'DENY',
    enabled: true,
    recommendedValue: 'DENY',
    description: 'Legacy clickjacking defense preventing any site from embedding this page in a frame.'
  },
  {
    id: 'referrer',
    name: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
    enabled: true,
    recommendedValue: 'strict-origin-when-cross-origin',
    description: 'Protects privacy by limiting referrer information passed to third-party domains.'
  },
  {
    id: 'permissions',
    name: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
    enabled: true,
    recommendedValue: 'camera=(), microphone=(), geolocation=(), payment=()',
    description: 'Disables access to browser hardware and privileged APIs by default.'
  },
  {
    id: 'coop',
    name: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
    enabled: true,
    recommendedValue: 'same-origin',
    description: 'Isolates browsing context to protect against Spectre-like cross-origin attacks.'
  },
  {
    id: 'corp',
    name: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
    enabled: true,
    recommendedValue: 'same-origin',
    description: 'Prevents other origins from reading your sensitive static and media resources.'
  }
];

export function buildSecurityHeadersConfig(headers: SecurityHeaderItem[]): SecurityHeadersResult {
  const active = headers.filter(h => h.enabled);

  const raw = active.map(h => `${h.name}: ${h.value}`).join('\n');
  const nginx = active.map(h => `add_header ${h.name} "${h.value}" always;`).join('\n');
  const apache = active.map(h => `Header always set ${h.name} "${h.value}"`).join('\n');
  const cloudflare = `/*\n${active.map(h => `  ${h.name}: ${h.value}`).join('\n')}`;

  return {
    raw,
    nginx,
    apache,
    cloudflare
  };
}
