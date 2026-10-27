/**
 * Indicator catalogues shared by the script, storage, permission, and
 * disclosure checks.
 *
 * Every catalogue here is a set of *text patterns matched against untrusted
 * strings*. The strings are never evaluated, executed, or resolved. Only the
 * catalogue entry's own id, label, and a match count survive — the matched
 * text itself is discarded, so an indicator can never carry a credential or a
 * fragment of the target's source.
 *
 * The semantics matter as much as the mechanics: an indicator means "a
 * recognized pattern appeared, a human should look". It is never proof of a
 * vulnerability, and no check in this engine is allowed to present one as
 * though it were.
 */

import { IndicatorSource, PageIndicator } from '../../types';

export interface IndicatorPattern {
  /** Stable id; appears in finding evidence, so it must not be renamed. */
  id: string;
  label: string;
  /** Matched against the candidate text. Must carry the `g` flag. */
  pattern: RegExp;
}

/** Keeps one page's indicator list bounded regardless of page size. */
export const MAX_INDICATOR_OCCURRENCES = 999;

/**
 * Dangerous DOM and dynamic-code APIs.
 *
 * Presence means the page *can* build markup or code from a string. Whether
 * the input to that call is attacker-controlled cannot be determined from
 * static text, which is exactly why these are reported as review items.
 */
export const DANGEROUS_DOM_PATTERNS: readonly IndicatorPattern[] = [
  { id: 'eval', label: 'eval()', pattern: /(?:^|[^.\w$])eval\s*\(/g },
  { id: 'new-function', label: 'new Function()', pattern: /\bnew\s+Function\s*\(/g },
  { id: 'document-write', label: 'document.write()', pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\(/g },
  { id: 'inner-html', label: 'innerHTML assignment', pattern: /\.\s*innerHTML\s*\+?=/g },
  { id: 'outer-html', label: 'outerHTML assignment', pattern: /\.\s*outerHTML\s*\+?=/g },
  {
    id: 'insert-adjacent-html',
    label: 'insertAdjacentHTML()',
    pattern: /\.\s*insertAdjacentHTML\s*\(/g
  },
  {
    id: 'timer-string-argument',
    label: 'setTimeout/setInterval with a string body',
    pattern: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/g
  },
  {
    id: 'range-create-contextual-fragment',
    label: 'createContextualFragment()',
    pattern: /\.\s*createContextualFragment\s*\(/g
  }
];

/** Dynamic script and module loading, which widens the executable surface. */
export const DYNAMIC_SCRIPT_PATTERNS: readonly IndicatorPattern[] = [
  {
    id: 'create-script-element',
    label: "createElement('script')",
    pattern: /createElement\s*\(\s*["'`]script["'`]/g
  },
  { id: 'dynamic-import', label: 'dynamic import()', pattern: /(?:^|[^.\w$])import\s*\(/g },
  {
    id: 'document-write-script',
    label: 'document.write of a script tag',
    pattern: /document\s*\.\s*write(?:ln)?\s*\([^)]{0,200}<script/gi
  },
  { id: 'import-scripts', label: 'importScripts()', pattern: /\bimportScripts\s*\(/g }
];

/**
 * Cross-document messaging.
 *
 * `message-origin-check` is catalogued deliberately: its *presence* is the
 * reassuring signal, and the postMessage check uses it to avoid reporting a
 * concern about a listener that does validate its sender.
 */
export const POST_MESSAGE_PATTERNS: readonly IndicatorPattern[] = [
  { id: 'post-message', label: 'postMessage()', pattern: /\.\s*postMessage\s*\(/g },
  {
    id: 'post-message-wildcard-origin',
    label: "postMessage() with a '*' target origin",
    pattern: /\.\s*postMessage\s*\([^)]{0,400}?["']\*["']\s*\)/g
  },
  {
    id: 'message-listener',
    label: "addEventListener('message')",
    pattern: /addEventListener\s*\(\s*["'`]message["'`]/g
  },
  {
    id: 'message-origin-check',
    label: 'sender origin comparison',
    pattern: /\.\s*origin\s*(?:===|!==|==|!=)/g
  }
];

/**
 * Permission-gated and privacy-sensitive browser APIs.
 *
 * Detection is textual only. The engine never calls any of these and never
 * triggers a permission prompt.
 */
export const SENSITIVE_API_PATTERNS: readonly IndicatorPattern[] = [
  { id: 'geolocation', label: 'Geolocation', pattern: /navigator\s*\.\s*geolocation/g },
  {
    id: 'camera-microphone',
    label: 'Camera or microphone (getUserMedia)',
    pattern: /\bgetUserMedia\s*\(|navigator\s*\.\s*mediaDevices/g
  },
  { id: 'screen-capture', label: 'Screen capture', pattern: /\bgetDisplayMedia\s*\(/g },
  {
    id: 'notifications',
    label: 'Notifications',
    pattern: /Notification\s*\.\s*requestPermission|new\s+Notification\s*\(/g
  },
  { id: 'clipboard', label: 'Clipboard', pattern: /navigator\s*\.\s*clipboard/g },
  {
    id: 'sensors',
    label: 'Motion or environment sensors',
    pattern: /DeviceOrientationEvent|DeviceMotionEvent|\bnew\s+(?:Accelerometer|Gyroscope|Magnetometer|AmbientLightSensor)\s*\(/g
  },
  {
    id: 'device-access',
    label: 'Bluetooth, USB, serial, or HID access',
    pattern: /navigator\s*\.\s*(?:bluetooth|usb|serial|hid)\b/g
  },
  {
    id: 'permissions-query',
    label: 'Permissions API query',
    pattern: /navigator\s*\.\s*permissions\s*\.\s*query/g
  },
  { id: 'midi', label: 'Web MIDI', pattern: /\brequestMIDIAccess\s*\(/g }
];

/** Browser storage surfaces. Usage alone is normal and is not a weakness. */
export const STORAGE_API_PATTERNS: readonly IndicatorPattern[] = [
  { id: 'local-storage', label: 'localStorage', pattern: /\blocalStorage\b/g },
  { id: 'session-storage', label: 'sessionStorage', pattern: /\bsessionStorage\b/g },
  { id: 'document-cookie', label: 'document.cookie', pattern: /document\s*\.\s*cookie/g },
  { id: 'indexed-db', label: 'IndexedDB', pattern: /\bindexedDB\b|\bIDBDatabase\b/g },
  { id: 'cache-storage', label: 'Cache Storage', pattern: /\bcaches\s*\.\s*(?:open|match|keys)\b/g }
];

/** Service worker registration and caching. */
export const SERVICE_WORKER_PATTERNS: readonly IndicatorPattern[] = [
  {
    id: 'service-worker-register',
    label: 'serviceWorker.register()',
    pattern: /serviceWorker\s*\.\s*register\s*\(/g
  },
  {
    id: 'service-worker-reference',
    label: 'navigator.serviceWorker',
    pattern: /navigator\s*\.\s*serviceWorker/g
  },
  { id: 'workbox', label: 'Workbox runtime', pattern: /\bworkbox\b/gi },
  {
    id: 'service-worker-cache',
    label: 'service worker cache usage',
    pattern: /\bcaches\s*\.\s*open\s*\(/g
  }
];

/**
 * Source map and build metadata references.
 *
 * The engine records that a reference exists. It never requests a source map,
 * so no original source is ever downloaded, parsed, or reported.
 */
export const SOURCE_MAP_PATTERNS: readonly IndicatorPattern[] = [
  {
    id: 'source-mapping-url',
    label: 'sourceMappingURL comment',
    pattern: /sourceMappingURL\s*=/g
  },
  { id: 'source-url', label: 'sourceURL comment', pattern: /\bsourceURL\s*=/g },
  {
    id: 'bundler-internal-path',
    label: 'bundler internal path',
    pattern: /webpack(?:-internal)?:\/\/|\bvite\/modulepreload|rollup:\/\//g
  },
  {
    id: 'build-machine-path',
    label: 'build-machine filesystem path',
    pattern: /(?:\/(?:Users|home)\/[A-Za-z0-9._-]{1,32}\/|[A-Z]:\\\\?Users\\\\?)/g
  }
];

/**
 * Indicator ids recorded from markup structure rather than from text patterns.
 *
 * They live here so the extraction layer and the checks that read them cannot
 * drift apart on the spelling of an id.
 */
export const MARKUP_INDICATORS = {
  /** A resource URL that points at a source map. */
  sourceMapResource: { id: 'source-map-resource', label: 'source map referenced as a resource' },
  /** A referenced hostname that looks private or internal. */
  internalHostname: { id: 'internal-hostname', label: 'internal-looking hostname referenced' }
} as const;

/** Development, debug, and non-production environment markers. */
export const DEBUG_PATTERNS: readonly IndicatorPattern[] = [
  { id: 'debugger-statement', label: 'debugger statement', pattern: /\bdebugger\s*;/g },
  {
    id: 'debug-flag-enabled',
    label: 'debug flag set to true',
    pattern: /\b(?:debug|isDebug|DEBUG|__DEBUG__|debugMode)\s*[:=]\s*(?:true|1)\b/g
  },
  {
    id: 'development-environment',
    label: 'development environment value',
    pattern: /(?:NODE_ENV|APP_ENV|ENVIRONMENT|environment)\s*[:=]\s*["'`](?:dev|development|local|staging|test)["'`]/gi
  },
  {
    id: 'verbose-logging',
    label: 'verbose or trace logging enabled',
    pattern: /\b(?:logLevel|log_level)\s*[:=]\s*["'`](?:debug|trace|verbose)["'`]/gi
  }
];

/**
 * Counts catalogue matches in one untrusted string.
 *
 * The text is bounded by the scanner before it arrives here, and nothing but
 * the count leaves this function.
 */
export function countIndicators(
  text: string,
  catalogue: readonly IndicatorPattern[],
  where: IndicatorSource
): PageIndicator[] {
  if (!text) return [];

  const found: PageIndicator[] = [];

  for (const entry of catalogue) {
    // `String.match` with a global pattern starts from index 0 every time, so
    // a shared RegExp cannot leak `lastIndex` state between pages.
    const matches = text.match(entry.pattern);
    if (!matches || matches.length === 0) continue;

    found.push({
      id: entry.id,
      label: entry.label,
      occurrences: Math.min(matches.length, MAX_INDICATOR_OCCURRENCES),
      where
    });
  }

  return found;
}

/** Merges indicator lists, summing the occurrence counts of equal ids. */
export function mergeIndicators(
  into: Map<string, PageIndicator>,
  incoming: readonly PageIndicator[]
): void {
  for (const indicator of incoming) {
    const existing = into.get(indicator.id);
    if (existing) {
      existing.occurrences = Math.min(
        existing.occurrences + indicator.occurrences,
        MAX_INDICATOR_OCCURRENCES
      );
    } else {
      into.set(indicator.id, { ...indicator });
    }
  }
}

/** Sorted, stable output order so findings are deterministic across runs. */
export function sortedIndicators(map: Map<string, PageIndicator>): PageIndicator[] {
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function hasIndicator(indicators: readonly PageIndicator[], id: string): boolean {
  return indicators.some((indicator) => indicator.id === id);
}

export function findIndicator(
  indicators: readonly PageIndicator[],
  id: string
): PageIndicator | undefined {
  return indicators.find((indicator) => indicator.id === id);
}

/** Private, loopback, and reserved address ranges plus internal-only suffixes. */
const INTERNAL_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.(?:local|localhost|internal|intranet|corp|lan|home|test|invalid|example)$/i
];

/**
 * True when a hostname looks like it belongs to a private or internal network.
 *
 * This is a naming heuristic, not a resolution: the engine never performs DNS
 * lookups. A match is reported as an observation worth reviewing, because an
 * internal hostname in public markup usually points at a build or
 * configuration mistake rather than at an exploitable flaw.
 */
export function looksInternalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const value = host.trim().toLowerCase();
  if (!value) return false;

  if (INTERNAL_HOST_PATTERNS.some((pattern) => pattern.test(value))) return true;

  // A single-label host with no dot can only resolve inside a local search
  // domain, so it should not appear in a public page's markup.
  return !value.includes('.') && !value.startsWith('[');
}

/** Path segments that conventionally name an administrative area. */
const ADMINISTRATIVE_PATH_PATTERN =
  /(?:^|\/)(?:admin|administrator|wp-admin|backend|manage|management|console|dashboard|internal|private|staff|cpanel|phpmyadmin|adminer|debug|test|staging|backup|backups|\.git|\.env|config|secrets?)(?:\/|$|\.)/i;

/**
 * True when a path reads like an administrative or internal area.
 *
 * Used only to group observations. A path appearing in robots.txt or a sitemap
 * is a published hint about site structure, never evidence that the path is
 * reachable, unprotected, or vulnerable.
 */
export function looksAdministrativePath(path: string | null | undefined): boolean {
  if (!path) return false;
  return ADMINISTRATIVE_PATH_PATTERN.test(path);
}
