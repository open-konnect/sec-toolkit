import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverPages } from '../src/tools/website-posture/logic/discovery';
import { createHtmlScannerExtractor } from '../src/tools/website-posture/logic/htmlScanner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { looksStateChanging, registrableDomain } from '../src/tools/website-posture/logic/url';
import { PageFetchRequest, PageFetchResult, PageFetcher } from '../src/tools/website-posture/types';

const NOW = () => new Date('2026-01-01T00:00:00.000Z');
const extractor = createHtmlScannerExtractor();

function target(url: string) {
  const parsed = parseTarget(url);
  if (!parsed.ok) throw new Error(`fixture URL rejected: ${url}`);
  return parsed.target;
}

function links(...urls: string[]): string {
  return `<html><body>${urls.map((url) => `<a href="${url}">l</a>`).join('')}</body></html>`;
}

interface SiteOptions {
  /** Request URL to the URL the transport reports after redirects. */
  redirects?: Record<string, string>;
  /** Request URLs that never answer until aborted. */
  hang?: string[];
}

function site(pages: Record<string, string>, options: SiteOptions = {}) {
  const requested: string[] = [];

  const fetcher: PageFetcher = {
    id: 'site',
    capabilities: {
      canReadHtmlBody: true,
      canReadResponseHeaders: false,
      canFollowRedirects: true,
      canDiscoverLinkedPages: true,
      canProbeWellKnownPaths: false
    },
    async fetchPage(request: PageFetchRequest): Promise<PageFetchResult> {
      requested.push(request.url);

      if (options.hang?.includes(request.url)) {
        await new Promise<void>((resolve) => {
          request.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        return failure(request.url, 'aborted', null);
      }

      const finalUrl = options.redirects?.[request.url] ?? request.url;
      const html = pages[finalUrl];
      if (html === undefined) return failure(request.url, 'http-error', 404);

      return {
        ok: true,
        url: request.url,
        finalUrl,
        status: 200,
        contentType: 'text/html',
        body: html,
        isHtml: true,
        bytes: html.length,
        truncated: false,
        redirected: finalUrl !== request.url,
        headers: { visibility: 'cors-restricted', values: {} }
      };
    }
  };

  return { fetcher, requested };
}

function failure(url: string, kind: 'aborted' | 'http-error', status: number | null): PageFetchResult {
  return {
    ok: false,
    url,
    finalUrl: null,
    status,
    contentType: null,
    body: null,
    isHtml: false,
    bytes: 0,
    truncated: false,
    redirected: false,
    headers: { visibility: 'not-fetched', values: {} },
    error: { kind, message: kind === 'aborted' ? 'Request aborted.' : 'Not found in fixture.' }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('website posture: crawl URL handling', () => {
  it('treats sign-out and delete-style paths as state-changing', () => {
    expect(looksStateChanging(new URL('https://example.com/logout'))).toBe(true);
    expect(looksStateChanging(new URL('https://example.com/account/delete/5'))).toBe(true);
    expect(looksStateChanging(new URL('https://example.com/blog?action=delete'))).toBe(true);
    expect(looksStateChanging(new URL('https://example.com/about'))).toBe(false);
    expect(looksStateChanging(new URL('https://example.com/blog/deleting-your-cache'))).toBe(false);
  });

  it('derives a registrable domain without treating a public suffix as a site', () => {
    expect(registrableDomain('cdn.example.com')).toBe('example.com');
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('127.0.0.1')).toBe('127.0.0.1');
  });
});

describe('website posture: bounded crawling', () => {
  it('never requests links that look like state-changing actions', async () => {
    const { fetcher, requested } = site({
      'https://example.com/': links('/logout', '/account/delete/5', '/about'),
      'https://example.com/about': links()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 2, concurrency: 1 },
      now: NOW
    });

    expect(requested).toEqual(['https://example.com/', 'https://example.com/about']);
    const reasons = result.report.skipped.map((skip) => skip.reason);
    expect(reasons.filter((reason) => reason === 'state-changing')).toHaveLength(2);
  });

  it('collapses fragments, tracking parameters and query order into one fetch', async () => {
    const { fetcher, requested } = site({
      'https://example.com/': links(
        '/a',
        '/a#section',
        '/a?utm_source=newsletter',
        '/a?utm_source=social&utm_medium=x',
        '/list?b=2&a=1',
        '/list?a=1&b=2'
      ),
      'https://example.com/a': links(),
      'https://example.com/list?b=2&a=1': links(),
      'https://example.com/list?a=1&b=2': links()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 1, concurrency: 1 },
      now: NOW
    });

    expect(requested.filter((url) => url.includes('/a'))).toHaveLength(1);
    expect(requested.filter((url) => url.includes('/list'))).toHaveLength(1);
    expect(result.pages).toHaveLength(3);
  });

  it('follows the entry redirect and crawls on the origin it landed on', async () => {
    const { fetcher, requested } = site(
      {
        'https://www.example.com/': links('/x'),
        'https://www.example.com/x': links()
      },
      { redirects: { 'http://example.com/': 'https://www.example.com/' } }
    );

    const result = await discoverPages({
      target: target('http://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1, concurrency: 1 },
      now: NOW
    });

    expect(requested).toContain('https://www.example.com/x');
    expect(result.report.scopeOrigin).toBe('https://www.example.com');
    expect(result.pages.map((page) => page.url)).toEqual([
      'https://www.example.com/',
      'https://www.example.com/x'
    ]);
  });

  it('rejects a linked page that redirects to another origin', async () => {
    const { fetcher } = site(
      {
        'https://example.com/': links('/jump'),
        'https://other.example/landing': links()
      },
      { redirects: { 'https://example.com/jump': 'https://other.example/landing' } }
    );

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1, concurrency: 1 },
      now: NOW
    });

    expect(result.pages.map((page) => page.url)).toEqual(['https://example.com/']);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0].url).toBe('https://example.com/jump');
  });

  it('records inaccessible pages without failing the crawl', async () => {
    const { fetcher } = site({
      'https://example.com/': links('/ok', '/missing'),
      'https://example.com/ok': links()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1, concurrency: 1 },
      now: NOW
    });

    expect(result.report.analyzed).toBe(2);
    expect(result.report.failures.map((entry) => entry.url)).toEqual(['https://example.com/missing']);
    expect(result.report.timedOut).toBe(false);
  });

  it('stops when the total time budget runs out and says so', async () => {
    vi.useFakeTimers();
    const { fetcher } = site(
      {
        'https://example.com/': links('/slow'),
        'https://example.com/slow': links()
      },
      { hang: ['https://example.com/slow'] }
    );

    const pending = discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1, concurrency: 1, totalTimeoutMs: 5_000 },
      now: NOW
    });

    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result.report.timedOut).toBe(true);
    expect(result.report.cancelled).toBe(false);
    expect(result.pages.map((page) => page.url)).toEqual(['https://example.com/']);
  });

  it('reports a caller abort as cancellation, not a timeout', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetcher } = site({ 'https://example.com/': links() });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      signal: controller.signal,
      now: NOW
    });

    expect(result.report.cancelled).toBe(true);
    expect(result.report.timedOut).toBe(false);
  });
});
