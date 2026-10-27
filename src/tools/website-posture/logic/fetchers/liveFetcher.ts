/**
 * Live browser transport.
 *
 * Issues plain, read-only GET requests with the browser's normal CORS rules
 * fully in force. It never attempts to work around a same-origin or CORS
 * boundary: when the browser blocks a read, the result is reported as
 * unreadable so the engine can record `unable-to-verify`.
 *
 * Deliberate choices:
 *
 * - `credentials: 'omit'` — no cookies, so the assessment is never
 *   authenticated and can never act as a logged-in user.
 * - `method: 'GET'` only — nothing is submitted, mutated, or probed for
 *   behaviour.
 * - `referrerPolicy: 'no-referrer'` — the target learns nothing about where
 *   the request came from.
 * - `cache: 'no-store'` — target content is never written to the HTTP cache.
 * - The response body is read through a size-capped reader and is only ever
 *   held in memory for the duration of the run.
 */

import {
  FetcherCapabilities,
  ObservedHeaders,
  PageFetchError,
  PageFetchRequest,
  PageFetchResult,
  PageFetcher
} from '../../types';
import { RECORDED_HEADERS } from '../recordedHeaders';
import { isSameOrigin, parseUrl } from '../url';

/** Largest body the engine will read from a single response. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface LiveFetcherOptions {
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * The origin the tool itself is served from. Response headers are only
   * fully readable when the target shares this origin.
   */
  selfOrigin?: string;
  maxBodyBytes?: number;
}

const LIVE_CAPABILITIES: FetcherCapabilities = {
  canReadHtmlBody: true,
  // True in principle; narrowed per-target because a cross-origin response
  // only exposes CORS-safelisted headers.
  canReadResponseHeaders: true,
  canFollowRedirects: true,
  canDiscoverLinkedPages: true,
  canProbeWellKnownPaths: true
};

export function createLiveFetcher(options: LiveFetcherOptions = {}): PageFetcher {
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);

  return {
    id: 'live-browser-fetch',
    capabilities: LIVE_CAPABILITIES,

    async fetchPage(request: PageFetchRequest): Promise<PageFetchResult> {
      if (!fetchImpl) {
        return failed(request.url, {
          kind: 'unsupported',
          message: 'This environment does not provide the fetch API.'
        });
      }

      const parsed = parseUrl(request.url);
      if (!parsed) {
        return failed(request.url, { kind: 'invalid-url', message: 'The URL could not be parsed.' });
      }

      const timeoutController = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, Math.max(1, request.timeoutMs));

      const onExternalAbort = () => timeoutController.abort();
      request.signal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const response = await fetchImpl(request.url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          redirect: 'follow',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: timeoutController.signal
        });

        const headers = readHeaders(response, request.url, options.selfOrigin);
        const contentType = response.headers.get('content-type');
        const finalUrl = response.url || request.url;
        const isHtml = looksLikeHtml(contentType);

        if (!response.ok) {
          return {
            ok: false,
            url: request.url,
            finalUrl,
            status: response.status,
            contentType,
            body: null,
            isHtml,
            bytes: 0,
            truncated: false,
            redirected: Boolean(response.redirected),
            headers,
            error: {
              kind: 'http-error',
              message: `The server responded with HTTP ${response.status}.`
            }
          };
        }

        if (request.discardBody) {
          return {
            ok: true,
            url: request.url,
            finalUrl,
            status: response.status,
            contentType,
            body: null,
            isHtml,
            bytes: await measureBody(response, maxBodyBytes),
            truncated: false,
            redirected: Boolean(response.redirected),
            headers
          };
        }

        // A request-level cap can only lower the transport ceiling. Capped
        // requests (well-known text files) read a prefix and report it as
        // truncated, rather than failing because the file is large.
        const bodyLimit = Math.min(maxBodyBytes, request.maxBytes ?? maxBodyBytes);
        const capped = request.maxBytes !== undefined && request.maxBytes < maxBodyBytes;

        const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
        if (!capped && Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
          return {
            ok: false,
            url: request.url,
            finalUrl,
            status: response.status,
            contentType,
            body: null,
            isHtml,
            bytes: declaredLength,
            truncated: true,
            redirected: Boolean(response.redirected),
            headers,
            error: {
              kind: 'too-large',
              message: `The response is larger than the ${Math.round(maxBodyBytes / 1024)} KB client-side limit.`
            }
          };
        }

        const body = await readBody(response, bodyLimit);

        return {
          ok: true,
          url: request.url,
          finalUrl,
          status: response.status,
          contentType,
          body: body.text,
          isHtml,
          bytes: body.bytes,
          truncated: body.truncated,
          redirected: Boolean(response.redirected),
          headers
        };
      } catch (error) {
        return failed(request.url, describeFetchError(error, request, timedOut));
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onExternalAbort);
      }
    }
  };
}

function looksLikeHtml(contentType: string | null): boolean {
  if (!contentType) return false;
  const value = contentType.toLowerCase();
  return value.includes('text/html') || value.includes('application/xhtml+xml');
}

/**
 * Records the readable security headers and, crucially, whether their absence
 * can be trusted.
 *
 * A cross-origin response only exposes CORS-safelisted headers unless the
 * server opts in with `Access-Control-Expose-Headers`, so "no CSP header seen"
 * must not be read as "no CSP header sent".
 */
function readHeaders(
  response: Response,
  requestUrl: string,
  selfOrigin: string | undefined
): ObservedHeaders {
  const values: Record<string, string> = {};

  try {
    for (const name of RECORDED_HEADERS) {
      const value = response.headers.get(name);
      if (value !== null) values[name] = value.slice(0, 2048);
    }
  } catch {
    // Some runtimes restrict header enumeration; fall through to the
    // visibility reason below rather than failing the fetch.
  }

  const sameOrigin = Boolean(selfOrigin) && isSameOrigin(requestUrl, selfOrigin as string);

  if (sameOrigin) {
    return { visibility: 'readable', values };
  }

  return {
    visibility: 'cors-restricted',
    values,
    reason:
      'The target is a different origin, so the browser hides response headers unless the server exposes them with Access-Control-Expose-Headers. A header missing here may still be present on the response.'
  };
}

async function readBody(
  response: Response,
  maxBytes: number
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const body = response.body;

  // Streaming lets the cap be enforced before the whole body is in memory.
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
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
        if (bytes > maxBytes) {
          const keep = value.subarray(0, Math.max(0, value.byteLength - (bytes - maxBytes)));
          text += decoder.decode(keep, { stream: false });
          truncated = true;
          break;
        }

        text += decoder.decode(value, { stream: true });
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // The stream may already be closed; nothing further to release.
      }
    }

    if (!truncated) text += decoder.decode();
    return { text, bytes, truncated };
  }

  const text = await response.text();
  if (text.length > maxBytes) {
    return { text: text.slice(0, maxBytes), bytes: text.length, truncated: true };
  }
  return { text, bytes: text.length, truncated: false };
}

/** Reads and discards a body, returning only its byte length. */
async function measureBody(response: Response, maxBytes: number): Promise<number> {
  try {
    const body = await readBody(response, maxBytes);
    return body.bytes;
  } catch {
    return 0;
  }
}

function describeFetchError(
  error: unknown,
  request: PageFetchRequest,
  timedOut: boolean
): PageFetchError {
  const name = error instanceof Error ? error.name : '';

  if (name === 'AbortError' || name === 'TimeoutError') {
    if (request.signal?.aborted) {
      return { kind: 'aborted', message: 'The assessment was cancelled.' };
    }
    if (timedOut) {
      return {
        kind: 'timeout',
        message: `The request did not complete within ${request.timeoutMs} ms.`
      };
    }
    return { kind: 'aborted', message: 'The request was aborted.' };
  }

  // `fetch` reports a CORS rejection and a DNS or connection failure the same
  // way, by design: distinguishing them would itself be an information leak.
  return {
    kind: 'cors',
    message:
      'The browser blocked this request. Either the target did not return an Access-Control-Allow-Origin header for this origin, or the host could not be reached. This is a browser restriction, not a finding about the site.'
  };
}

function failed(url: string, error: PageFetchError): PageFetchResult {
  return {
    ok: false,
    url,
    finalUrl: null,
    status: null,
    contentType: null,
    body: null,
    isHtml: false,
    bytes: 0,
    truncated: false,
    redirected: false,
    headers: {
      visibility: 'not-fetched',
      values: {},
      reason: 'The response was never received, so no header could be observed.'
    },
    error
  };
}
