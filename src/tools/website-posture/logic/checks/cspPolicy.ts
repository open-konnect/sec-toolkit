/**
 * Content-Security-Policy reading and parsing, shared by the CSP checks.
 *
 * A policy can arrive in a response header or in a `<meta http-equiv>` tag.
 * The header is invisible to a cross-origin `fetch` unless the server exposes
 * it, so `headersReadable` must be consulted before concluding that a site has
 * no policy: "no header seen" and "no header sent" are different facts.
 */

import { AnalyzedPage } from '../../types';

export type CspDeliveryChannel = 'header' | 'meta';

export interface CspPolicySource {
  channel: CspDeliveryChannel;
  reportOnly: boolean;
  policy: string;
}

export interface PageCspInfo {
  /** Policies the browser enforces. */
  enforced: CspPolicySource[];
  /** Report-only policies, which do not block anything. */
  reportOnly: CspPolicySource[];
  /** True when the page's response headers were fully observable. */
  headersReadable: boolean;
  /** Why headers were not observable, when applicable. */
  headersReason?: string;
}

const HEADER_ENFORCED = 'content-security-policy';
const HEADER_REPORT_ONLY = 'content-security-policy-report-only';

export function readPageCsp(page: AnalyzedPage): PageCspInfo {
  const enforced: CspPolicySource[] = [];
  const reportOnly: CspPolicySource[] = [];

  const headerPolicy = page.headers.values[HEADER_ENFORCED];
  if (headerPolicy) {
    enforced.push({ channel: 'header', reportOnly: false, policy: headerPolicy });
  }

  const headerReportOnly = page.headers.values[HEADER_REPORT_ONLY];
  if (headerReportOnly) {
    reportOnly.push({ channel: 'header', reportOnly: true, policy: headerReportOnly });
  }

  for (const meta of page.metaTags) {
    const httpEquiv = (meta.httpEquiv || '').toLowerCase();
    if (httpEquiv !== HEADER_ENFORCED) continue;
    if (!meta.content.trim()) continue;
    // `<meta>` cannot deliver a report-only policy; browsers ignore it.
    enforced.push({ channel: 'meta', reportOnly: false, policy: meta.content });
  }

  return {
    enforced,
    reportOnly,
    headersReadable: page.headers.visibility === 'readable',
    headersReason: page.headers.reason
  };
}

/**
 * Parses a policy into directive name to source list.
 *
 * Directive names are lowercased; source values keep their original case
 * because nonces and hashes are case-sensitive.
 */
export function parseCspDirectives(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();

  for (const segment of policy.split(';')) {
    const parts = segment.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;

    const name = parts[0].toLowerCase();
    // A repeated directive is ignored by browsers after the first occurrence.
    if (!directives.has(name)) {
      directives.set(name, parts.slice(1));
    }
  }

  return directives;
}

export interface EffectiveDirective {
  /** The directive that actually governs, after default-src fallback. */
  name: string;
  values: string[];
  /** True when the value came from `default-src` rather than the exact name. */
  inherited: boolean;
}

/**
 * Resolves a directive, falling back to `default-src`.
 *
 * Returns null when neither is present, which means the directive is
 * unrestricted rather than empty.
 */
export function effectiveDirective(
  directives: Map<string, string[]>,
  name: string
): EffectiveDirective | null {
  const direct = directives.get(name);
  if (direct) return { name, values: direct, inherited: false };

  const fallback = directives.get('default-src');
  if (fallback) return { name: 'default-src', values: fallback, inherited: true };

  return null;
}

/** Case-insensitive keyword test against a directive's source list. */
export function hasKeyword(values: readonly string[], keyword: string): boolean {
  const needle = keyword.toLowerCase();
  return values.some((value) => value.toLowerCase() === needle);
}

/**
 * True when a nonce or hash source is present.
 *
 * In CSP Level 2 and later a browser that honours a nonce or hash ignores
 * `'unsafe-inline'` entirely, so the combination is a deliberate fallback for
 * old browsers rather than a live weakness.
 */
export function hasNonceOrHash(values: readonly string[]): boolean {
  return values.some((value) => {
    const lower = value.toLowerCase().replace(/^'|'$/g, '');
    return lower.startsWith('nonce-') || lower.startsWith('sha256-') || lower.startsWith('sha384-') || lower.startsWith('sha512-');
  });
}

/** `'strict-dynamic'` also neutralizes host and `'unsafe-inline'` sources. */
export function hasStrictDynamic(values: readonly string[]): boolean {
  return hasKeyword(values, "'strict-dynamic'");
}
