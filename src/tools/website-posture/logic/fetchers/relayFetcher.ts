/**
 * Transport that asks this site's own fetch relay to read the target.
 *
 * A browser cannot read another site's markup or response headers, so the
 * relay makes one plain GET and returns the text and a short allowlist of
 * security headers. Everything after that — parsing, checks, scoring — runs
 * here in the browser. Because the relay sees the real response, header
 * absence is trustworthy and header checks can reach a verdict.
 *
 * The request body (not the URL) carries the target, and no cookies or
 * credentials are sent in either direction.
 */

import {
  FetcherCapabilities,
  PageFetchError,
  PageFetchRequest,
  PageFetchResult,
  PageFetcher
} from '../../types';
import { parseUrl } from '../url';

export const DEFAULT_RELAY_ENDPOINT = '/api/fetch';

export interface RelayFetcherOptions {
  endpoint?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const CAPABILITIES: FetcherCapabilities = {
  canReadHtmlBody: true,
  canReadResponseHeaders: true,
  canFollowRedirects: true,
  canDiscoverLinkedPages: true,
  canProbeWellKnownPaths: true
};

interface RelayPayload {
  ok: boolean;
  finalUrl?: string;
  status?: number;
  redirected?: boolean;
  contentType?: string | null;
  headers?: Record<string, string>;
  body?: string | null;
  bytes?: number;
  truncated?: boolean;
  error?: { kind: string; message: string };
}

export function createRelayFetcher(options: RelayFetcherOptions = {}): PageFetcher {
  const endpoint = options.endpoint ?? DEFAULT_RELAY_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);

  return {
    id: 'site-relay',
    capabilities: CAPABILITIES,

    async fetchPage(request: PageFetchRequest): Promise<PageFetchResult> {
      if (!fetchImpl) return failed(request.url, { kind: 'unsupported', message: 'This environment does not provide the fetch API.' });
      if (!parseUrl(request.url)) return failed(request.url, { kind: 'invalid-url', message: 'The URL could not be parsed.' });

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, Math.max(1, request.timeoutMs));
      const onAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onAbort, { once: true });

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url: request.url,
            ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
            ...(request.discardBody ? { discardBody: true } : {})
          }),
          signal: controller.signal
        });

        let payload: RelayPayload;
        try {
          payload = (await response.json()) as RelayPayload;
        } catch {
          return failed(request.url, {
            kind: 'unsupported',
            message: 'The fetch relay is not available here, so the page could not be read. Use "Paste page source" instead.'
          });
        }

        if (!payload.ok || typeof payload.status !== 'number') {
          return failed(request.url, mapError(payload.error));
        }

        const contentType = payload.contentType ?? null;
        const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType ?? '');
        const base = {
          url: request.url,
          finalUrl: payload.finalUrl ?? request.url,
          status: payload.status,
          contentType,
          isHtml,
          bytes: payload.bytes ?? 0,
          truncated: payload.truncated === true,
          redirected: payload.redirected === true,
          headers: {
            visibility: 'readable' as const,
            values: payload.headers ?? {}
          }
        };

        if (payload.status < 200 || payload.status >= 300) {
          return {
            ...base,
            ok: false,
            body: null,
            error: { kind: 'http-error', message: `The server responded with HTTP ${payload.status}.` }
          };
        }
        return { ...base, ok: true, body: typeof payload.body === 'string' ? payload.body : null };
      } catch {
        if (request.signal?.aborted) return failed(request.url, { kind: 'aborted', message: 'The assessment was cancelled.' });
        if (timedOut) return failed(request.url, { kind: 'timeout', message: `The request did not complete within ${request.timeoutMs} ms.` });
        return failed(request.url, { kind: 'network', message: 'The fetch relay could not be reached.' });
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }
    }
  };
}

function mapError(error: RelayPayload['error']): PageFetchError {
  const message = (error?.message ?? 'The page could not be fetched.').slice(0, 300);
  switch (error?.kind) {
    case 'invalid-url':
    case 'blocked-target':
      return { kind: 'invalid-url', message };
    case 'timeout':
      return { kind: 'timeout', message };
    default:
      return { kind: 'network', message };
  }
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
