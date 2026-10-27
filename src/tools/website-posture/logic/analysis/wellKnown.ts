/**
 * Parsers for the three well-known text files this engine understands:
 * `security.txt`, `robots.txt`, and a sitemap.
 *
 * Each parser turns a body into a small, bounded *structural summary* and the
 * body is then discarded by the caller. Nothing here retains free text:
 *
 * - A `security.txt` names real people, so contact values are validated in
 *   place and never kept.
 * - Paths taken from `robots.txt` or a sitemap keep their path component only;
 *   any query string is dropped, because a published URL can carry a token.
 * - Every collection is capped, so a hostile or enormous file cannot grow the
 *   report or the memory it occupies.
 *
 * These files are fetched with a plain, read-only GET at a fixed path. Nothing
 * referenced inside them is ever followed.
 */

import { RobotsTxtSummary, SecurityTxtSummary, SitemapSummary } from '../../types';
import { looksAdministrativePath } from './indicators';

/** Caps applied to every parser in this module. */
export const MAX_PARSED_LINES = 4_000;
export const MAX_COLLECTED_PATHS = 25;
export const MAX_COLLECTED_SITEMAPS = 10;

/** Largest body the runner will read for a well-known file. */
export const MAX_WELL_KNOWN_BYTES = 256 * 1024;

function lines(body: string): string[] {
  return body.split(/\r?\n/, MAX_PARSED_LINES);
}

/** Keeps only the path of a URL-ish string; a query may carry a token. */
function pathOnly(value: string, base?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, base);
    return parsed.pathname.slice(0, 200);
  } catch {
    // A robots.txt rule is a path pattern, not a URL, so this is the normal
    // path for `Disallow: /admin/*`.
    const withoutQuery = trimmed.split(/[?#]/)[0];
    return withoutQuery.slice(0, 200) || null;
  }
}

/* -------------------------------------------------------------------------- */
/* security.txt (RFC 9116)                                                    */
/* -------------------------------------------------------------------------- */

const PGP_SIGNED_MARKER = '-----BEGIN PGP SIGNED MESSAGE-----';
const PGP_SIGNATURE_MARKER = '-----BEGIN PGP SIGNATURE-----';

/** URI schemes RFC 9116 accepts for a `Contact` value. */
const USABLE_CONTACT_SCHEME = /^(?:mailto:|tel:|https:\/\/)\S+/i;

/**
 * Parses a `security.txt` into field-level facts.
 *
 * `now` is injected so expiry evaluation is deterministic in tests.
 */
export function parseSecurityTxt(
  body: string,
  options: { origin?: string; now?: Date } = {}
): SecurityTxtSummary {
  const counts = new Map<string, number>();
  const now = options.now ?? new Date();

  let signed = false;
  let malformedLines = 0;
  let contactUsable = false;
  let expiresValid = false;
  let expired = false;
  let canonicalMatchesOrigin: boolean | null = null;

  for (const rawLine of lines(body)) {
    const line = rawLine.trim();

    if (!line) continue;
    if (line.startsWith('#')) continue;

    if (line.startsWith(PGP_SIGNED_MARKER) || line.startsWith(PGP_SIGNATURE_MARKER)) {
      signed = true;
      continue;
    }
    // Armour headers and the base64 signature body are not field lines.
    if (signed && !line.includes(':')) continue;
    if (line.startsWith('-----')) continue;
    if (/^Hash:\s/i.test(line)) continue;

    const separator = line.indexOf(':');
    if (separator <= 0) {
      malformedLines += 1;
      continue;
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (!/^[a-z][a-z0-9-]*$/.test(name) || !value) {
      malformedLines += 1;
      continue;
    }

    counts.set(name, (counts.get(name) ?? 0) + 1);

    if (name === 'contact' && USABLE_CONTACT_SCHEME.test(value)) {
      contactUsable = true;
    }

    if (name === 'expires' && !expiresValid) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        expiresValid = true;
        expired = parsed < now.getTime();
      }
    }

    if (name === 'canonical' && options.origin && canonicalMatchesOrigin !== true) {
      try {
        canonicalMatchesOrigin = new URL(value).origin === options.origin;
      } catch {
        canonicalMatchesOrigin = false;
      }
    }
  }

  return {
    kind: 'security-txt',
    fields: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    signed,
    malformedLines,
    contactUsable,
    expiresValid,
    expired,
    canonicalMatchesOrigin
  };
}

/** Fields RFC 9116 requires. Their absence makes a file malformed, not unsafe. */
export const REQUIRED_SECURITY_TXT_FIELDS: readonly string[] = ['contact', 'expires'];

/** Fields that are optional but useful when present. */
export const OPTIONAL_SECURITY_TXT_FIELDS: readonly string[] = [
  'policy',
  'encryption',
  'canonical',
  'acknowledgments',
  'preferred-languages',
  'hiring',
  'csaf'
];

export function hasSecurityTxtField(summary: SecurityTxtSummary, name: string): boolean {
  return summary.fields.some((field) => field.name === name);
}

/* -------------------------------------------------------------------------- */
/* robots.txt                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Parses a `robots.txt` into rule counts and the paths it mentions.
 *
 * robots.txt is a crawler *preference* file. It grants no access and denies
 * none, so nothing in this summary may be presented as an access control or
 * as a vulnerability.
 */
export function parseRobotsTxt(body: string, options: { baseUrl?: string } = {}): RobotsTxtSummary {
  const sitemaps: string[] = [];
  const disallowedPaths: string[] = [];
  const administrativeLookingPaths: string[] = [];

  let userAgentGroups = 0;
  let allowRules = 0;
  let disallowRules = 0;
  let malformedLines = 0;
  let previousWasUserAgent = false;

  /** Tracks whether the wildcard group disallows the whole site. */
  let inWildcardGroup = false;
  let wildcardBlocksAll = false;

  for (const rawLine of lines(body)) {
    const withoutComment = rawLine.split('#')[0].trim();
    if (!withoutComment) continue;

    const separator = withoutComment.indexOf(':');
    if (separator <= 0) {
      malformedLines += 1;
      continue;
    }

    const field = withoutComment.slice(0, separator).trim().toLowerCase();
    const value = withoutComment.slice(separator + 1).trim();

    switch (field) {
      case 'user-agent': {
        // Consecutive User-agent lines share one group of rules.
        if (!previousWasUserAgent) userAgentGroups += 1;
        previousWasUserAgent = true;
        inWildcardGroup = value === '*';
        continue;
      }

      case 'disallow': {
        disallowRules += 1;
        if (inWildcardGroup && value === '/') wildcardBlocksAll = true;

        const path = pathOnly(value, options.baseUrl);
        if (path && path !== '/' && disallowedPaths.length < MAX_COLLECTED_PATHS) {
          if (!disallowedPaths.includes(path)) disallowedPaths.push(path);
          if (
            looksAdministrativePath(path) &&
            !administrativeLookingPaths.includes(path) &&
            administrativeLookingPaths.length < MAX_COLLECTED_PATHS
          ) {
            administrativeLookingPaths.push(path);
          }
        }
        break;
      }

      case 'allow': {
        allowRules += 1;
        break;
      }

      case 'sitemap': {
        if (sitemaps.length < MAX_COLLECTED_SITEMAPS) {
          try {
            const parsed = new URL(value, options.baseUrl);
            const normalized = `${parsed.origin}${parsed.pathname}`;
            if (!sitemaps.includes(normalized)) sitemaps.push(normalized);
          } catch {
            malformedLines += 1;
          }
        }
        break;
      }

      case 'crawl-delay':
      case 'host':
      case 'noindex':
      case 'clean-param':
      case 'request-rate':
      case 'visit-time':
        break;

      default:
        malformedLines += 1;
        break;
    }

    previousWasUserAgent = false;
  }

  return {
    kind: 'robots-txt',
    userAgentGroups,
    allowRules,
    disallowRules,
    sitemaps,
    disallowedPaths,
    administrativeLookingPaths,
    malformedLines,
    blocksEverything: wildcardBlocksAll && allowRules === 0
  };
}

/* -------------------------------------------------------------------------- */
/* Sitemap                                                                    */
/* -------------------------------------------------------------------------- */

const LOC_PATTERN = /<loc>\s*([^<\s]{1,2048})\s*<\/loc>/gi;

/**
 * Summarizes a sitemap without following a single URL inside it.
 *
 * Handles the XML `urlset` and `sitemapindex` forms and the plain-text form.
 * Only counts and a capped list of administrative-looking paths are kept.
 */
export function parseSitemap(
  body: string,
  options: { origin?: string; truncated?: boolean } = {}
): SitemapSummary {
  const administrativeLookingPaths: string[] = [];
  let urlCount = 0;
  let crossOriginUrlCount = 0;

  const isXml = /<\s*(?:urlset|sitemapindex)\b/i.test(body);
  const format: SitemapSummary['format'] = isXml
    ? /<\s*sitemapindex\b/i.test(body)
      ? 'sitemapindex'
      : 'urlset'
    : looksLikeUrlList(body)
      ? 'text'
      : 'unknown';

  const record = (raw: string) => {
    urlCount += 1;

    try {
      const parsed = new URL(raw.trim());
      if (options.origin && parsed.origin !== options.origin) crossOriginUrlCount += 1;

      const path = parsed.pathname.slice(0, 200);
      if (
        looksAdministrativePath(path) &&
        !administrativeLookingPaths.includes(path) &&
        administrativeLookingPaths.length < MAX_COLLECTED_PATHS
      ) {
        administrativeLookingPaths.push(path);
      }
    } catch {
      // A malformed entry still counts as a listed URL.
    }
  };

  if (format === 'urlset' || format === 'sitemapindex') {
    for (const match of body.match(LOC_PATTERN) ?? []) {
      const inner = match.replace(/<\/?loc>/gi, '');
      record(inner);
    }
  } else if (format === 'text') {
    for (const line of lines(body)) {
      const trimmed = line.trim();
      if (trimmed && /^https?:\/\//i.test(trimmed)) record(trimmed);
    }
  }

  return {
    kind: 'sitemap',
    format,
    urlCount,
    crossOriginUrlCount,
    wellFormed: format !== 'unknown' && urlCount > 0,
    truncated: options.truncated === true,
    administrativeLookingPaths
  };
}

function looksLikeUrlList(body: string): boolean {
  const sample = lines(body.slice(0, 8_192)).filter((line) => line.trim());
  if (sample.length === 0) return false;
  return sample.slice(0, 20).every((line) => /^https?:\/\/\S+$/i.test(line.trim()));
}
