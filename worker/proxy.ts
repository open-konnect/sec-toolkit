/**
 * Passive fetch relay.
 *
 * Browsers cannot read another site's HTML or response headers, so the
 * assessment asks this relay to make one ordinary GET on its behalf and hand
 * back the page text and a short allowlist of security headers. All analysis
 * still happens in the browser; the relay does not interpret, store or log
 * what it fetches.
 *
 * It is deliberately narrow so it cannot be turned into a general proxy or a
 * way into private networks:
 *
 * - POST with a JSON body, so the target is never in a logged URL.
 * - Same-origin callers only.
 * - http/https on the default ports, hostnames only (no IP literals, no
 *   credentials, no internal-looking names).
 * - Redirects are followed by hand and every hop is validated again.
 * - No cookies or caller headers are sent; no Set-Cookie is returned.
 * - Time and size are capped; binary bodies are never returned.
 */

import { RECORDED_HEADERS } from '../src/tools/website-posture/logic/recordedHeaders';

export const RELAY_PATH = '/api/fetch';

export const RELAY_LIMITS = {
  maxBodyBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
  timeoutMs: 15_000,
  maxRequestBytes: 4096,
  maxUrlLength: 2048
} as const;

export type RelayErrorKind =
  | 'invalid-url'
  | 'blocked-target'
  | 'timeout'
  | 'network'
  | 'too-many-redirects'
  | 'bad-request'
  | 'forbidden';

export interface RelayRequest {
  url: string;
  /** Lowers the body cap for small text files. */
  maxBytes?: number;
  discardBody?: boolean;
}

export interface RelayResponse {
  ok: true;
  finalUrl: string;
  status: number;
  redirected: boolean;
  contentType: string | null;
  headers: Record<string, string>;
  /** Null for binary content or when discarded. */
  body: string | null;
  bytes: number;
  truncated: boolean;
}

export interface RelayFailure {
  ok: false;
  error: { kind: RelayErrorKind; message: string };
}

const ALLOWED_HEADERS = new Set(RECORDED_HEADERS);
const TEXTUAL = /^(text\/|application\/(xhtml\+xml|xml|json|[\w.+-]*\+(xml|json)))/i;
const SENSITIVE_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.test'];

/** Returns a reason the target must not be fetched, or null when it is acceptable. */
export function blockedReason(raw: string): string | null {
  if (raw.length > RELAY_LIMITS.maxUrlLength) return 'The URL is too long.';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'The URL could not be parsed.';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Only http and https URLs can be assessed.';
  if (url.username || url.password) return 'URLs with embedded credentials are not accepted.';
  if (url.port !== '') return 'Only the default ports (80 and 443) are accepted.';

  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host) return 'The URL has no host.';
  // IPv6 literals keep their brackets; IPv4 literals, including odd forms such
  // as 0x7f.1 or 2130706433, are rejected by requiring a letter-bearing TLD.
  if (host.includes(':') || host.startsWith('[')) return 'IP addresses are not accepted; use a hostname.';
  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  if (labels.length < 2 || !/^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(tld)) {
    return 'Only public hostnames are accepted.';
  }
  if (host === 'localhost' || SENSITIVE_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return 'Only public hostnames are accepted.';
  }
  return null;
}

function failure(kind: RelayErrorKind, message: string, status: number): Response {
  const body: RelayFailure = { ok: false, error: { kind, message } };
  return json(body, status);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function sameOriginCaller(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

async function readCapped(
  response: Response,
  limit: number
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', bytes: 0, truncated: false };
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let bytes = 0;
  let truncated = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const value = chunk.value;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > limit) {
        text += decoder.decode(value.subarray(0, Math.max(0, value.byteLength - (bytes - limit))));
        bytes = limit;
        truncated = true;
        break;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Already closed.
    }
  }
  if (!truncated) text += decoder.decode();
  return { text, bytes, truncated };
}

export async function handleRelay(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (request.method !== 'POST') return failure('bad-request', 'Use POST.', 405);
  if (!sameOriginCaller(request)) return failure('forbidden', 'This relay only serves the assessment tool.', 403);

  const length = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(length) && length > RELAY_LIMITS.maxRequestBytes) {
    return failure('bad-request', 'The request is too large.', 413);
  }

  let payload: RelayRequest;
  try {
    const text = await request.text();
    if (text.length > RELAY_LIMITS.maxRequestBytes) return failure('bad-request', 'The request is too large.', 413);
    payload = JSON.parse(text) as RelayRequest;
  } catch {
    return failure('bad-request', 'The request body must be JSON.', 400);
  }
  if (!payload || typeof payload.url !== 'string') return failure('bad-request', 'A url is required.', 400);

  const bodyLimit = Math.min(
    RELAY_LIMITS.maxBodyBytes,
    typeof payload.maxBytes === 'number' && payload.maxBytes > 0 ? Math.floor(payload.maxBytes) : RELAY_LIMITS.maxBodyBytes
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_LIMITS.timeoutMs);

  try {
    let current = payload.url;
    let redirected = false;

    for (let hop = 0; hop <= RELAY_LIMITS.maxRedirects; hop += 1) {
      const blocked = blockedReason(current);
      if (blocked) {
        return failure(hop === 0 ? 'invalid-url' : 'blocked-target', blocked, 400);
      }

      const response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'user-agent': 'DeveloperSecurityToolkit-PostureAssessment/1.0 (passive, read-only)'
        }
      });

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        try {
          current = new URL(response.headers.get('location') as string, current).toString();
        } catch {
          return failure('invalid-url', 'A redirect pointed at an invalid URL.', 502);
        }
        redirected = true;
        await response.body?.cancel().catch(() => undefined);
        continue;
      }

      const headers: Record<string, string> = {};
      for (const name of ALLOWED_HEADERS) {
        const value = response.headers.get(name);
        if (value !== null) headers[name] = value.slice(0, 2048);
      }
      const contentType = response.headers.get('content-type');
      const textual = contentType !== null && TEXTUAL.test(contentType);
      const wantBody = !payload.discardBody && textual;

      let text: string | null = null;
      let bytes = 0;
      let truncated = false;
      if (wantBody) {
        const read = await readCapped(response, bodyLimit);
        text = read.text;
        bytes = read.bytes;
        truncated = read.truncated;
      } else {
        await response.body?.cancel().catch(() => undefined);
      }

      const out: RelayResponse = {
        ok: true,
        finalUrl: current,
        status: response.status,
        redirected,
        contentType,
        headers,
        body: text,
        bytes,
        truncated
      };
      return json(out);
    }
    return failure('too-many-redirects', 'The site redirected too many times.', 502);
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return aborted
      ? failure('timeout', `The site did not respond within ${RELAY_LIMITS.timeoutMs / 1000} seconds.`, 504)
      : failure('network', 'The site could not be reached.', 502);
  } finally {
    clearTimeout(timer);
  }
}
