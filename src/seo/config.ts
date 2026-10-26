/**
 * Central SEO configuration.
 *
 * The production origin is configured with VITE_SITE_URL. Set it to the exact
 * hostname users visit (for example https://sec-toolkit.konnect-open.workers.dev)
 * so canonical URLs and the sitemap stay stable.
 */

const FALLBACK_SITE_URL = 'https://sec-toolkit.konnect-open.workers.dev';

function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const SITE_NAME = 'Developer Security Toolkit';
export const SITE_HOME_TITLE = 'Developer & Security Tools';
export const SITE_TAGLINE = 'Fast, private, browser-based utilities for developers, security engineers, and AI builders.';
export const SITE_DESCRIPTION =
  'Fast, private, browser-based utilities for developers, security engineers, and AI builders. 15 tools that run entirely in your browser.';

export const SITE_URL = (readEnv(import.meta.env.VITE_SITE_URL) || FALLBACK_SITE_URL).replace(/\/+$/, '');
export const SITE_OG_IMAGE_PATH = readEnv(import.meta.env.VITE_OG_IMAGE) || '/og-image.png';
export const SITE_TWITTER_HANDLE = readEnv(import.meta.env.VITE_TWITTER_HANDLE);

/**
 * Google Search Console HTML-tag verification value.
 *
 * The production token is stored here so ownership verification works without
 * requiring an environment variable. VITE_GOOGLE_SITE_VERIFICATION can still
 * override it for a different property.
 */
const DEFAULT_GOOGLE_SITE_VERIFICATION = 'L-4k9wlFruyGLL_hdaVZkiHidnWt1iiQWWchxlSEryY';
export const GOOGLE_SITE_VERIFICATION =
  readEnv(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION) || DEFAULT_GOOGLE_SITE_VERIFICATION;

/**
 * Set VITE_NOINDEX=true for preview/staging builds. Production builds must
 * leave it unset so the static HTML is indexable.
 */
export const SITE_INDEXABLE = readEnv(import.meta.env.VITE_NOINDEX).toLowerCase() !== 'true';

function getSiteHostname(): string {
  try {
    return new URL(SITE_URL).hostname.toLowerCase();
  } catch {
    return new URL(FALLBACK_SITE_URL).hostname.toLowerCase();
  }
}

export const SITE_HOSTNAME = getSiteHostname();

/**
 * Normalize a pathname for canonical URLs.
 * Removes query strings, fragments, duplicate slashes, and trailing slashes.
 */
export function normalizePath(path: string): string {
  let normalized = (path || '/').trim();
  normalized = normalized.split('#')[0].split('?')[0];

  if (!normalized) return '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  return normalized || '/';
}

export function absoluteUrl(path: string): string {
  const normalized = normalizePath(path);
  return normalized === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

export function absoluteAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Only the configured production hostname should be indexed.
 * Preview deployments live on different hostnames (for example other
 * *.workers.dev or *.pages.dev subdomains) and must not compete with the
 * canonical production site. Localhost is never indexable.
 */
export function isIndexableHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')) {
    return false;
  }

  return host === SITE_HOSTNAME;
}

/**
 * Client-side guard: never index a Vite development server.
 */
export function shouldIndexCurrentPage(): boolean {
  if (!SITE_INDEXABLE) return false;
  if (import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return isIndexableHostname(window.location.hostname);
}
