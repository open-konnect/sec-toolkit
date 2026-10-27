/**
 * Security maturity dimensions.
 *
 * One headline score stays the primary number. These two dimensions split the
 * same checks by what they measure, so a reader can tell "something concerning
 * was observed in the markup" apart from "baseline hardening is thin":
 *
 * - Technical Security: concerns actually observed in what the pages do or
 *   carry — transport downgrades, risky forms, dangerous script patterns,
 *   permissive CSP combined with the thing it fails to contain, correlations.
 * - Security Hygiene: absent or weak defence-in-depth and housekeeping —
 *   response headers, disclosure policy, metadata and source-map leakage,
 *   resource hygiene, and related hardening. A missing header is not an
 *   observed weakness in the page, so it is kept out of the technical number.
 *
 * Assignment is by check id, so adding a check defaults it to technical until
 * it is deliberately listed here.
 */

import { MaturityDimension, MaturityDimensionId, MaturityDimensions } from '../types';

export const HYGIENE_CHECK_IDS: ReadonlySet<string> = new Set([
  // Security headers and related hardening
  'hsts',
  'http-to-https-upgrade',
  'x-content-type-options',
  'clickjacking-protection',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-isolation',
  'cors-allow-origin',
  'cache-control-sensitive',
  'csp-missing-directives',
  'csp-broad-sources',
  'csp-report-only',
  // Disclosure and metadata hygiene
  'security-txt-missing',
  'robots-txt',
  'sitemap-availability',
  'server-header-disclosure',
  'technology-disclosure',
  'debug-indicators',
  'source-map-indicators',
  // Dependency and resource hygiene
  'missing-sri',
  'third-party-surface',
  'external-link-hygiene'
]);

export const DIMENSION_LABELS: Record<MaturityDimensionId, string> = {
  'technical-security': 'Technical Security',
  'security-hygiene': 'Security Hygiene'
};

export function dimensionOf(checkId: string): MaturityDimensionId {
  return HYGIENE_CHECK_IDS.has(checkId) ? 'security-hygiene' : 'technical-security';
}

function emptyDimension(id: MaturityDimensionId): MaturityDimension {
  return {
    id,
    label: DIMENSION_LABELS[id],
    value: null,
    grade: null,
    availableWeight: 0,
    appliedPenalty: 0,
    scoredChecks: [],
    checkCount: 0
  };
}

/** Both dimensions unscored, for fallbacks when scoring itself failed. */
export function emptyDimensions(): MaturityDimensions {
  return {
    technical: emptyDimension('technical-security'),
    hygiene: emptyDimension('security-hygiene')
  };
}
