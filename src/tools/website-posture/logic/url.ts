/**
 * URL normalization, origin comparison, and deduplication.
 *
 * Every URL the engine handles passes through here first so that discovery,
 * resource normalization, and finding aggregation all agree on what counts as
 * "the same URL".
 */

/** Longest URL the engine will attempt to parse. */
export const MAX_URL_LENGTH = 2048;

/** Schemes a passive assessment is willing to request. */
const NAVIGABLE_PROTOCOLS = new Set(['http:', 'https:']);

/** Schemes that appear in markup but are never fetched or followed. */
const NON_NAVIGABLE_PROTOCOLS = new Set([
  'mailto:',
  'tel:',
  'sms:',
  'javascript:',
  'data:',
  'blob:',
  'about:',
  'file:',
  'ftp:',
  'ws:',
  'wss:',
  'chrome:',
  'chrome-extension:',
  'intent:',
  'magnet:'
]);

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443'
};

/**
 * Extensions that indicate a download or binary asset rather than an HTML
 * page. Discovery skips these instead of spending a fetch on them.
 */
const BINARY_EXTENSIONS = new Set([
  // archives
  'zip', '7z', 'gz', 'tgz', 'bz2', 'xz', 'rar', 'tar',
  // documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'csv',
  // images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'svg',
  // audio and video
  'mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'mp4', 'm4v', 'webm', 'mov', 'avi', 'mkv', 'wmv',
  // fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // code and data bundles
  'js', 'mjs', 'cjs', 'css', 'map', 'json', 'xml', 'rss', 'atom', 'wasm',
  // installers and binaries
  'exe', 'dmg', 'pkg', 'deb', 'rpm', 'msi', 'apk', 'bin', 'iso', 'jar', 'so', 'dll'
]);

/** Query parameters dropped when building a deduplication key. */
const TRACKING_PARAMS = [
  'gclid',
  'fbclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  '_ga',
  '_gl'
];

/** Parses a URL without throwing. Returns null for anything unusable. */
export function parseUrl(raw: string, base?: string): URL | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  try {
    return base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Accepts bare hostnames by defaulting to `https:`.
 *
 * Users paste `example.com` far more often than `https://example.com`, and
 * defaulting to the secure scheme avoids nudging them toward an http target.
 */
export function parseUserSuppliedUrl(raw: string): URL | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return null;

  const direct = parseUrl(trimmed);
  if (direct) return direct;

  // No scheme at all: `example.com/path`. A bare `//host` is also accepted.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  return parseUrl(`https://${trimmed.replace(/^\/+/, '')}`);
}

export function isNavigableProtocol(protocol: string): boolean {
  return NAVIGABLE_PROTOCOLS.has(protocol.toLowerCase());
}

export function isKnownNonNavigableProtocol(protocol: string): boolean {
  return NON_NAVIGABLE_PROTOCOLS.has(protocol.toLowerCase());
}

/** True for loopback hosts, which browsers treat as secure contexts. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1') return true;
  return /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Canonical string form of a URL.
 *
 * Lowercases the scheme and host, drops the default port, drops the fragment,
 * and removes a trailing slash from non-root paths. Query strings are kept,
 * because they can select genuinely different pages.
 */
export function normalizeUrl(raw: string, base?: string): string | null {
  const url = parseUrl(raw, base);
  if (!url) return null;
  return normalizeParsedUrl(url);
}

export function normalizeParsedUrl(url: URL): string {
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const port = url.port && url.port === DEFAULT_PORTS[protocol] ? '' : url.port;

  let pathname = url.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Non-special schemes (mailto:, javascript:, …) have no host component, so
  // reassembling them from parts would corrupt them. Return them fragment-free.
  if (!NAVIGABLE_PROTOCOLS.has(protocol)) {
    return `${protocol}${url.pathname}${url.search}`;
  }

  const host = port ? `${hostname}:${port}` : hostname;
  return `${protocol}//${host}${pathname}${url.search}`;
}

/** Scheme + host + port, lowercased, with the default port removed. */
export function originOf(url: URL): string {
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  if (!NAVIGABLE_PROTOCOLS.has(protocol)) return 'null';

  const port = url.port && url.port === DEFAULT_PORTS[protocol] ? '' : url.port;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}

/**
 * Same-origin per the web platform rule: scheme, host, and port must all
 * match. `https://example.com` and `http://example.com` are different
 * origins, and so are `example.com` and `www.example.com`.
 */
export function isSameOrigin(a: string, b: string): boolean {
  const left = parseUrl(a);
  const right = parseUrl(b);
  if (!left || !right) return false;

  const leftOrigin = originOf(left);
  if (leftOrigin === 'null') return false;

  return leftOrigin === originOf(right);
}

/**
 * Key used to decide whether two URLs are the same page for discovery.
 *
 * Stricter than `normalizeUrl`: query parameters are sorted and tracking
 * parameters are stripped, so `?a=1&b=2` and `?b=2&a=1&utm_source=x` collapse
 * to one entry and are fetched once.
 */
export function urlDedupeKey(raw: string, base?: string): string | null {
  const url = parseUrl(raw, base);
  if (!url) return null;

  const protocol = url.protocol.toLowerCase();
  if (!NAVIGABLE_PROTOCOLS.has(protocol)) {
    return normalizeParsedUrl(url);
  }

  const params = new URLSearchParams(url.search);
  for (const name of [...params.keys()]) {
    if (name.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.includes(name.toLowerCase())) {
      params.delete(name);
    }
  }

  const entries = [...params.entries()].sort(([aKey, aVal], [bKey, bVal]) =>
    aKey === bKey ? aVal.localeCompare(bVal) : aKey.localeCompare(bKey)
  );

  const search = entries.length
    ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
    : '';

  let pathname = url.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const port = url.port && url.port === DEFAULT_PORTS[protocol] ? '' : url.port;
  const host = port ? `${url.hostname.toLowerCase()}:${port}` : url.hostname.toLowerCase();

  return `${protocol}//${host}${pathname}${search}`;
}

/** Lowercase extension of the final path segment, without the dot. */
export function pathExtension(url: URL): string | null {
  const segments = url.pathname.split('/');
  const last = segments[segments.length - 1];
  if (!last) return null;

  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return null;

  return last.slice(dot + 1).toLowerCase();
}

/** True when the path clearly points at a binary asset or a download. */
export function looksLikeBinaryResource(url: URL): boolean {
  const extension = pathExtension(url);
  return extension !== null && BINARY_EXTENSIONS.has(extension);
}

/** Registrable-ish host label for grouping third parties in the report. */
export function hostOf(url: string): string | null {
  const parsed = parseUrl(url);
  return parsed ? parsed.hostname.toLowerCase() : null;
}

/**
 * Path segments that name an action rather than a page.
 *
 * Following a plain GET link to `/logout` or `/account/delete` can change
 * server state on a badly built site. Discovery only reads, so it never
 * requests anything that reads like an action.
 */
const STATE_CHANGING_SEGMENT =
  /(?:^|\/)(?:log-?out|sign-?out|sign-?off|log-?off|delete|remove|destroy|unsubscribe|deactivate|revoke|disconnect|close-account|cancel-account)(?:[/._-]|$)/i;

const STATE_CHANGING_ACTIONS = new Set([
  'logout',
  'signout',
  'delete',
  'remove',
  'destroy',
  'unsubscribe',
  'deactivate',
  'revoke'
]);

/** True when a URL reads like an action a crawler must not trigger. */
export function looksStateChanging(url: URL): boolean {
  if (STATE_CHANGING_SEGMENT.test(url.pathname)) return true;

  for (const name of ['action', 'do', 'op', 'cmd']) {
    const value = url.searchParams.get(name);
    if (value && STATE_CHANGING_ACTIONS.has(value.toLowerCase())) return true;
  }
  return false;
}

/** Second-level suffixes that make the registrable domain three labels long. */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'co.in', 'net.in', 'org.in', 'gov.in',
  'co.jp', 'ne.jp', 'or.jp', 'com.br', 'com.cn', 'com.mx', 'co.za',
  'com.sg', 'com.tr', 'com.hk', 'com.tw', 'co.kr', 'co.il', 'com.ar'
]);

/**
 * Approximate registrable domain (eTLD+1) of a hostname.
 *
 * Without the full Public Suffix List this is a heuristic, which is acceptable
 * here because it only decides whether a host is labelled "same-site" or
 * "third-party" in a descriptive inventory — never whether something is
 * reported as a weakness. IP addresses and single-label hosts are returned
 * unchanged.
 */
export function registrableDomain(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;

  const labels = host.split('.');
  if (labels.length <= 2) return host;

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}
