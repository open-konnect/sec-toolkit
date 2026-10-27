/**
 * Response-header reading and parsing, shared by every header-aware check.
 *
 * The single most important rule in this file: **a header this engine could
 * not read is not a header the target failed to send.** A cross-origin `fetch`
 * exposes only CORS-safelisted response headers, so "absent from
 * `page.headers.values`" means nothing unless `page.headers.visibility` is
 * `readable`. Every helper here forces that distinction to be handled
 * explicitly rather than assumed away.
 */

import { AnalyzedPage } from '../../types';

/**
 * The standard explanation used whenever a header could not be inspected.
 *
 * Checks must use this (or the capability-level equivalent) instead of
 * reporting a missing header.
 */
export const HEADER_UNREADABLE_REASON =
  'Could not verify this response header from the browser because the target does not expose it to client-side inspection. A cross-origin response only reveals CORS-safelisted headers unless the server opts in with Access-Control-Expose-Headers, so the header may well be present on the real response. This is a browser restriction, not a finding about the site.';

/** True only when the full response header set for this page was observable. */
export function headersReadable(page: AnalyzedPage): boolean {
  return page.headers.visibility === 'readable';
}

/** Reads one header, or null when it was absent *or* unreadable. */
export function readHeader(page: AnalyzedPage, name: string): string | null {
  const value = page.headers.values[name.toLowerCase()];
  return value === undefined || value === '' ? null : value;
}

/** Splits the pages of a run by whether their headers could be inspected. */
export function partitionByHeaderVisibility(pages: readonly AnalyzedPage[]): {
  readable: AnalyzedPage[];
  unreadable: AnalyzedPage[];
} {
  const readable: AnalyzedPage[] = [];
  const unreadable: AnalyzedPage[] = [];

  for (const page of pages) {
    if (headersReadable(page)) readable.push(page);
    else unreadable.push(page);
  }

  return { readable, unreadable };
}

/** Why a specific page's headers were not observable, in plain language. */
export function headerUnreadableReason(page: AnalyzedPage): string {
  return page.headers.reason ? `${HEADER_UNREADABLE_REASON} ${page.headers.reason}` : HEADER_UNREADABLE_REASON;
}

/* -------------------------------------------------------------------------- */
/* Value parsing                                                              */
/* -------------------------------------------------------------------------- */

/** Lowercase, comma-separated header tokens with empties removed. */
export function headerTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

/** Lowercase, semicolon-separated directives, e.g. for Strict-Transport-Security. */
export function headerDirectives(value: string): string[] {
  return value
    .toLowerCase()
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface HstsPolicy {
  /** Seconds, or null when `max-age` was absent or unparseable. */
  maxAge: number | null;
  includeSubDomains: boolean;
  preload: boolean;
}

/** Six months, the threshold the major preload programs expect. */
export const HSTS_RECOMMENDED_MAX_AGE = 15_552_000;

export function parseHsts(value: string): HstsPolicy {
  let maxAge: number | null = null;
  let includeSubDomains = false;
  let preload = false;

  for (const directive of headerDirectives(value)) {
    if (directive.startsWith('max-age')) {
      const raw = directive.split('=')[1];
      const parsed = Number.parseInt((raw ?? '').replace(/"/g, '').trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 0) maxAge = parsed;
    } else if (directive === 'includesubdomains') {
      includeSubDomains = true;
    } else if (directive === 'preload') {
      preload = true;
    }
  }

  return { maxAge, includeSubDomains, preload };
}

/**
 * Referrer policies that send a full URL to a cross-origin destination.
 *
 * A full URL can carry a session identifier, a reset token, or an internal
 * path, which is why these are worth flagging even though none of them is a
 * vulnerability by itself.
 */
const CROSS_ORIGIN_LEAKING_REFERRER_POLICIES = new Set([
  'unsafe-url',
  'no-referrer-when-downgrade',
  'origin-when-cross-origin'
]);

const KNOWN_REFERRER_POLICIES = new Set([
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url'
]);

export interface ReferrerPolicyAssessment {
  /** The last token a browser would honour, or null when none is valid. */
  effective: string | null;
  /** True when the effective policy sends a full URL across origins. */
  leaksFullUrl: boolean;
  /** True when no token in the value was a recognized policy. */
  unrecognized: boolean;
}

/**
 * Resolves a Referrer-Policy value the way a browser does: the last token it
 * recognizes wins, so unknown tokens act as graceful fallbacks.
 */
export function assessReferrerPolicy(value: string): ReferrerPolicyAssessment {
  const tokens = headerTokens(value);
  const known = tokens.filter((token) => KNOWN_REFERRER_POLICIES.has(token));
  const effective = known.length > 0 ? known[known.length - 1] : null;

  return {
    effective,
    leaksFullUrl: effective !== null && CROSS_ORIGIN_LEAKING_REFERRER_POLICIES.has(effective),
    unrecognized: tokens.length > 0 && known.length === 0
  };
}

/** Frame-embedding stance expressed by `X-Frame-Options`. */
export type FrameOptionsStance = 'deny' | 'sameorigin' | 'allow-from' | 'unrecognized';

export function parseFrameOptions(value: string): FrameOptionsStance {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'deny') return 'deny';
  if (normalized === 'sameorigin') return 'sameorigin';
  if (normalized.startsWith('allow-from')) return 'allow-from';
  return 'unrecognized';
}

/** Cache-Control tokens, lowercased, with parameters preserved. */
export function parseCacheControl(value: string): Set<string> {
  return new Set(headerTokens(value));
}

/**
 * True when a response is cacheable by a shared cache in a way that would
 * retain a personalized page.
 */
export function allowsSharedCaching(cacheControl: string | null): boolean {
  if (!cacheControl) return true;
  const tokens = parseCacheControl(cacheControl);
  if (tokens.has('no-store')) return false;
  if (tokens.has('private')) return false;
  return true;
}

/**
 * Permissions-Policy allowlist per feature.
 *
 * Values keep their original source expressions because `self`, `*`, and an
 * origin list mean materially different things.
 */
export function parsePermissionsPolicy(value: string): Map<string, string[]> {
  const features = new Map<string, string[]>();

  for (const segment of value.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const open = trimmed.indexOf('(');
    const name = (open === -1 ? trimmed : trimmed.slice(0, open)).trim().toLowerCase();
    if (!name) continue;

    const inner =
      open === -1 ? '' : trimmed.slice(open + 1, trimmed.endsWith(')') ? -1 : undefined);

    const allowlist = inner
      .split(/\s+/)
      .map((entry) => entry.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    if (!features.has(name)) features.set(name, allowlist);
  }

  return features;
}

/** True when a header value reveals a product version, e.g. `nginx/1.24.0`. */
export function revealsVersion(value: string): boolean {
  return /\d+\.\d+/.test(value);
}
