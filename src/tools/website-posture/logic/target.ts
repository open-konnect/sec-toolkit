/**
 * Builds the normalized `AssessmentTarget` that every later stage keys off.
 */

import { AssessmentTarget } from '../types';
import {
  isLoopbackHost,
  isNavigableProtocol,
  normalizeParsedUrl,
  originOf,
  parseUserSuppliedUrl
} from './url';

export interface TargetParseSuccess {
  ok: true;
  target: AssessmentTarget;
}

export interface TargetParseFailure {
  ok: false;
  error: string;
}

export type TargetParseResult = TargetParseSuccess | TargetParseFailure;

/**
 * Parses user input into a target.
 *
 * Only http and https are accepted: those are the only schemes a passive
 * assessment can meaningfully observe, and refusing the rest early keeps
 * unusable input out of the engine.
 */
export function parseTarget(input: string): TargetParseResult {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) {
    return { ok: false, error: 'Enter a website URL to assess.' };
  }

  const url = parseUserSuppliedUrl(trimmed);
  if (!url) {
    return { ok: false, error: 'That does not look like a valid URL. Try https://example.com.' };
  }

  if (!isNavigableProtocol(url.protocol)) {
    return {
      ok: false,
      error: `Only http:// and https:// URLs can be assessed. Received "${url.protocol}".`
    };
  }

  if (!url.hostname) {
    return { ok: false, error: 'The URL is missing a hostname.' };
  }

  return { ok: true, target: createTarget(url) };
}

export function createTarget(url: URL): AssessmentTarget {
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const isLoopback = isLoopbackHost(hostname);
  const normalized = normalizeParsedUrl(url);

  let pathname = url.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  return {
    url: normalized,
    origin: originOf(url),
    hostname,
    protocol,
    // `URL.port` is already empty for default ports.
    port: url.port,
    pathname,
    // Browsers treat loopback as a secure context even over plain http.
    isSecureContext: protocol === 'https:' || isLoopback,
    isLoopback
  };
}
