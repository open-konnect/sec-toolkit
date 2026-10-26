/**
 * Central SEO configuration.
 *
 * The production URL is configured with VITE_SITE_URL. Use the custom domain
 * (for example https://securitytoolkit.dev), not a temporary *.pages.dev
 * hostname, so canonical URLs and the sitemap stay stable.
 */

const FALLBACK_SITE_URL = 'https://securitytoolkit.dev';

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
export const GOOGLE_SITE_VERIFICATION = readEnv(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION);

/**
 * Set VITE_NOINDEX=true for preview/staging builds. Production builds must
 * leave it unset so the static HTML is indexable.
 */
export const SITE_INDEXABLE = readEnv(import.meta.env.VITE_NOINDEX).toLowerCase() !== 'true';

function getSiteHostname(): string {
  try {
    return new URL(SITE_URL).hostname.toLowerCase();
  } catch {
    return 'securitytoolkit.dev';
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
 * Cloudflare preview deployments live on *.pages.dev and must not compete with
 * the canonical production site. Localhost is never indexable.
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
