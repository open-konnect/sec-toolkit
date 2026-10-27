/**
 * Static transport over markup the user already has.
 *
 * CORS blocks a browser from reading most cross-origin pages, so the live
 * transport legitimately fails for the majority of third-party targets. This
 * transport lets the user supply the page source themselves — from View
 * Source, a saved page, or their own build output — and runs the identical
 * check engine over it with zero network traffic of any kind.
 *
 * It is also the transport the unit tests use, which keeps the engine's test
 * suite entirely free of live websites.
 */

import {
  FetcherCapabilities,
  ObservedHeaders,
  PageFetchRequest,
  PageFetchResult,
  PageFetcher
} from '../../types';
import { normalizeUrl, urlDedupeKey } from '../url';

export interface StaticPageSource {
  url: string;
  html: string;
  status?: number;
  contentType?: string;
  /**
   * Response headers the user pasted in, if any.
   *
   * Only set `headersAreComplete` when the full response header set is known;
   * otherwise a missing header stays `unable-to-verify` rather than becoming a
   * finding.
   */
  headers?: Record<string, string>;
  headersAreComplete?: boolean;
}

export interface StaticFetcherOptions {
  /** True only if the supplied markup includes every linked page. */
  canDiscoverLinkedPages?: boolean;
  /**
   * Supplies well-known files (security.txt, robots.txt, sitemap.xml) by
   * absolute URL. Used by tests; omitted for pasted-source assessments, which
   * make no request and so cannot probe.
   */
  wellKnown?: Record<string, { status?: number; body?: string; contentType?: string }>;
}

/**
 * Builds a transport that serves a fixed set of pages.
 *
 * Capabilities are honest about what pasted markup cannot tell us: there are
 * no response headers to read unless the user supplied them, and well-known
 * paths cannot be probed without a network request.
 */
export function createStaticFetcher(
  sources: readonly StaticPageSource[],
  options: StaticFetcherOptions = {}
): PageFetcher {
  const byKey = new Map<string, StaticPageSource>();
  for (const source of sources) {
    const key = urlDedupeKey(source.url);
    if (key) byKey.set(key, source);
  }

  const capabilities: FetcherCapabilities = {
    canReadHtmlBody: true,
    canReadResponseHeaders: sources.some((source) => source.headersAreComplete === true),
    canFollowRedirects: false,
    canDiscoverLinkedPages: options.canDiscoverLinkedPages === true,
    // Probing requires issuing a request, which this transport never does —
    // unless the caller supplied fixtures for it.
    canProbeWellKnownPaths: options.wellKnown !== undefined
  };

  return {
    id: 'static-source',
    capabilities,

    async fetchPage(request: PageFetchRequest): Promise<PageFetchResult> {
      const key = urlDedupeKey(request.url);
      const source = key ? byKey.get(key) : undefined;

      const fixture = options.wellKnown?.[request.url];
      if (!source && fixture) {
        const status = fixture.status ?? 200;
        const body = fixture.body ?? '';
        const ok = status >= 200 && status < 300;
        return {
          ok,
          url: request.url,
          finalUrl: request.url,
          status,
          contentType: fixture.contentType ?? 'text/plain',
          body: ok && !request.discardBody ? body.slice(0, request.maxBytes ?? body.length) : null,
          isHtml: /html/i.test(fixture.contentType ?? ''),
          bytes: body.length,
          truncated: request.maxBytes !== undefined && body.length > request.maxBytes,
          redirected: false,
          headers: { visibility: 'unsupported', values: {} },
          ...(ok ? {} : { error: { kind: 'http-error' as const, message: `The server responded with HTTP ${status}.` } })
        };
      }

      if (!source) {
        return {
          ok: false,
          url: request.url,
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
            reason: 'No page source was supplied for this URL, and nothing is fetched over the network.'
          },
          error: {
            kind: 'unsupported',
            message: 'Page source was not supplied for this URL.'
          }
        };
      }

      return {
        ok: true,
        url: request.url,
        finalUrl: normalizeUrl(source.url) ?? source.url,
        status: source.status ?? 200,
        contentType: source.contentType ?? 'text/html',
        body: request.discardBody ? null : source.html,
        isHtml: true,
        bytes: source.html.length,
        truncated: false,
        redirected: false,
        headers: buildHeaders(source)
      };
    }
  };
}

function buildHeaders(source: StaticPageSource): ObservedHeaders {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(source.headers ?? {})) {
    values[name.toLowerCase()] = String(value).slice(0, 2048);
  }

  if (source.headersAreComplete) {
    return { visibility: 'readable', values };
  }

  return {
    visibility: 'unsupported',
    values,
    reason:
      'Pasted page source carries no response headers. Header-based checks stay unverified unless you supply the full response header set.'
  };
}
