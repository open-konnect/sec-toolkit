import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCOVERY_OPTIONS,
  DISCOVERY_LIMITS,
  discoverPages,
  resolveDiscoveryOptions
} from '../src/tools/website-posture/logic/discovery';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createHtmlScannerExtractor } from '../src/tools/website-posture/logic/htmlScanner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import {
  PageExtractor,
  PageFetchRequest,
  PageFetchResult,
  PageFetcher,
  RawPageSnapshot
} from '../src/tools/website-posture/types';

const NOW = () => new Date('2026-01-01T00:00:00.000Z');

function target(url: string) {
  const parsed = parseTarget(url);
  if (!parsed.ok) throw new Error(`fixture URL rejected: ${url}`);
  return parsed.target;
}

/** Links `urls` from a page, so discovery has something to enqueue. */
function linkingHtml(...urls: string[]): string {
  return `<html><body>${urls.map((url) => `<a href="${url}">l</a>`).join('')}</body></html>`;
}

/** A transport that records every URL it was asked for. */
function recordingFetcher(
  pages: Record<string, string>,
  overrides: Partial<PageFetcher['capabilities']> = {}
): PageFetcher & { requested: string[] } {
  const requested: string[] = [];

  return {
    id: 'recording',
    requested,
    capabilities: {
      canReadHtmlBody: true,
      canReadResponseHeaders: false,
      canFollowRedirects: true,
      canDiscoverLinkedPages: true,
      canProbeWellKnownPaths: false,
      ...overrides
    },
    async fetchPage(request: PageFetchRequest): Promise<PageFetchResult> {
      requested.push(request.url);
      const html = pages[request.url];

      if (html === undefined) {
        return {
          ok: false,
          url: request.url,
          finalUrl: null,
          status: 404,
          contentType: null,
          body: null,
          isHtml: false,
          bytes: 0,
          truncated: false,
          redirected: false,
          headers: { visibility: 'not-fetched', values: {} },
          error: { kind: 'http-error', message: 'Not found in fixture.' }
        };
      }

      return {
        ok: true,
        url: request.url,
        finalUrl: request.url,
        status: 200,
        contentType: 'text/html',
        body: html,
        isHtml: true,
        bytes: html.length,
        truncated: false,
        redirected: false,
        headers: { visibility: 'cors-restricted', values: {} }
      };
    }
  };
}

const extractor = createHtmlScannerExtractor();

describe('website posture: discovery options', () => {
  it('defaults to the entry page only', () => {
    expect(DEFAULT_DISCOVERY_OPTIONS.maxPages).toBe(1);
    expect(DEFAULT_DISCOVERY_OPTIONS.maxDepth).toBe(0);
  });

  it('clamps caller values into the range that guarantees termination', () => {
    const resolved = resolveDiscoveryOptions(
      { maxPages: 10_000, maxDepth: 99, concurrency: 500, perPageTimeoutMs: 10_000_000 },
      true
    );

    expect(resolved.maxPages).toBe(DISCOVERY_LIMITS.maxPages);
    expect(resolved.maxDepth).toBe(DISCOVERY_LIMITS.maxDepth);
    expect(resolved.concurrency).toBe(DISCOVERY_LIMITS.maxConcurrency);
    expect(resolved.perPageTimeoutMs).toBe(DISCOVERY_LIMITS.maxTimeoutMs);
  });

  it('raises values below the floor instead of accepting zero or NaN', () => {
    const resolved = resolveDiscoveryOptions(
      { maxPages: 0, maxDepth: -5, concurrency: 0, perPageTimeoutMs: Number.NaN },
      true
    );

    expect(resolved.maxPages).toBe(1);
    expect(resolved.maxDepth).toBe(0);
    expect(resolved.concurrency).toBe(1);
    expect(resolved.perPageTimeoutMs).toBe(DISCOVERY_LIMITS.minTimeoutMs);
  });

  it('pins to the entry page when the transport cannot reach linked pages', () => {
    const resolved = resolveDiscoveryOptions({ maxPages: 20, maxDepth: 3 }, false);
    expect(resolved.maxPages).toBe(1);
    expect(resolved.maxDepth).toBe(0);
  });
});

describe('website posture: page discovery', () => {
  it('analyzes only the entry page by default', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml('/a', '/b')
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      now: NOW
    });

    expect(result.pages).toHaveLength(1);
    expect(fetcher.requested).toEqual(['https://example.com/']);
    expect(result.report.analyzed).toBe(1);
    expect(result.report.attempted).toBe(1);
  });

  it('follows same-origin links breadth-first up to the page cap', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml('/a', '/b', '/c'),
      'https://example.com/a': linkingHtml('/d'),
      'https://example.com/b': linkingHtml(),
      'https://example.com/c': linkingHtml(),
      'https://example.com/d': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 3, maxDepth: 2, concurrency: 1 },
      now: NOW
    });

    expect(result.pages).toHaveLength(3);
    expect(fetcher.requested).toEqual([
      'https://example.com/',
      'https://example.com/a',
      'https://example.com/b'
    ]);
    expect(result.report.limitReached).toBe(true);
    expect(result.report.skipped.some((skip) => skip.reason === 'page-limit')).toBe(true);
  });

  it('stops at the depth limit even when the page budget is unspent', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml('/a'),
      'https://example.com/a': linkingHtml('/b'),
      'https://example.com/b': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 1 },
      now: NOW
    });

    expect(result.pages.map((page) => page.url)).toEqual([
      'https://example.com/',
      'https://example.com/a'
    ]);
    expect(result.pages[1].depth).toBe(1);
    expect(fetcher.requested).not.toContain('https://example.com/b');
  });

  it('never leaves the target origin', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml(
        'https://other.example/x',
        'http://example.com/insecure',
        'https://example.com:8443/alt',
        '/same'
      ),
      'https://example.com/same': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 2 },
      now: NOW
    });

    expect(fetcher.requested).toEqual(['https://example.com/', 'https://example.com/same']);
    expect(result.report.skipped.filter((skip) => skip.reason === 'cross-origin')).toHaveLength(3);
  });

  it('skips non-navigable schemes and binary downloads', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml(
        'mailto:a@example.com',
        'javascript:void(0)',
        'tel:+100',
        '/report.pdf',
        '/bundle.js',
        '/page'
      ),
      'https://example.com/page': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 2 },
      now: NOW
    });

    expect(fetcher.requested).toEqual(['https://example.com/', 'https://example.com/page']);
    expect(
      result.report.skipped.filter((skip) => skip.reason === 'non-navigable-scheme')
    ).toHaveLength(3);
    expect(
      result.report.skipped.filter((skip) => skip.reason === 'binary-or-download')
    ).toHaveLength(2);
  });

  it('fetches a deduplicated URL only once', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml(
        '/a',
        '/a',
        '/a/',
        '/a#section',
        '/a?utm_source=news',
        '/a?b=1&c=2',
        '/a?c=2&b=1'
      ),
      'https://example.com/a': linkingHtml(),
      'https://example.com/a?b=1&c=2': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 10, maxDepth: 1, concurrency: 1 },
      now: NOW
    });

    expect(fetcher.requested).toEqual([
      'https://example.com/',
      'https://example.com/a',
      'https://example.com/a?b=1&c=2'
    ]);
    expect(result.pages).toHaveLength(3);
  });

  it('isolates a failed page without aborting the run', async () => {
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml('/missing', '/ok'),
      'https://example.com/ok': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1 },
      now: NOW
    });

    expect(result.pages.map((page) => page.url)).toEqual([
      'https://example.com/',
      'https://example.com/ok'
    ]);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0].url).toBe('https://example.com/missing');
    expect(result.report.attempted).toBe(3);
    expect(result.report.analyzed).toBe(2);
  });

  it('records a non-HTML response as a failure rather than analyzing it', async () => {
    const fetcher: PageFetcher = {
      id: 'json-only',
      capabilities: recordingFetcher({}).capabilities,
      async fetchPage(request) {
        return {
          ok: true,
          url: request.url,
          finalUrl: request.url,
          status: 200,
          contentType: 'application/json',
          body: '{"a":1}',
          isHtml: false,
          bytes: 7,
          truncated: false,
          redirected: false,
          headers: { visibility: 'cors-restricted', values: {} }
        };
      }
    };

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      now: NOW
    });

    expect(result.pages).toHaveLength(0);
    expect(result.report.failures[0].kind).toBe('unsupported');
  });

  it('isolates an extractor that throws and keeps the message free of page content', async () => {
    const hostileExtractor: PageExtractor = {
      id: 'throwing',
      extract(): RawPageSnapshot {
        throw new Error('secret-page-content-leaked');
      }
    };

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher: recordingFetcher({ 'https://example.com/': '<html></html>' }),
      extractor: hostileExtractor,
      now: NOW
    });

    expect(result.pages).toHaveLength(0);
    expect(result.report.failures).toHaveLength(1);
    expect(result.report.failures[0].message).not.toContain('secret-page-content-leaked');
    expect(result.report.failures[0].message).toContain('Error');
  });

  it('reports cancellation when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher: recordingFetcher({ 'https://example.com/': linkingHtml() }),
      extractor,
      signal: controller.signal,
      now: NOW
    });

    expect(result.pages).toHaveLength(0);
    expect(result.report.cancelled).toBe(true);
  });

  it('stops mid-run when the signal aborts between batches', async () => {
    const controller = new AbortController();
    const fetcher = recordingFetcher({
      'https://example.com/': linkingHtml('/a', '/b'),
      'https://example.com/a': linkingHtml(),
      'https://example.com/b': linkingHtml()
    });

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 1, concurrency: 1 },
      signal: controller.signal,
      now: NOW,
      onPage: () => controller.abort()
    });

    expect(result.report.cancelled).toBe(true);
    expect(result.pages).toHaveLength(1);
  });

  it('works with the static transport over pasted source and issues no requests', async () => {
    const fetcher = createStaticFetcher([
      { url: 'https://example.com/', html: linkingHtml('/a') }
    ]);

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      // Asking for more pages must not widen a transport that cannot discover.
      options: { maxPages: 10, maxDepth: 2 },
      now: NOW
    });

    expect(result.pages).toHaveLength(1);
    expect(result.report.maxPages).toBe(1);
    expect(result.pages[0].headers.visibility).toBe('unsupported');
  });

  it('marks the post-redirect URL as seen so a chain is not walked twice', async () => {
    const requested: string[] = [];
    const fetcher: PageFetcher = {
      id: 'redirecting',
      capabilities: recordingFetcher({}).capabilities,
      async fetchPage(request) {
        requested.push(request.url);
        // Every request lands on /final, which links back to itself.
        const html = linkingHtml('/final', '/other');
        return {
          ok: true,
          url: request.url,
          finalUrl: 'https://example.com/final',
          status: 200,
          contentType: 'text/html',
          body: html,
          isHtml: true,
          bytes: html.length,
          truncated: false,
          redirected: true,
          headers: { visibility: 'cors-restricted', values: {} }
        };
      }
    };

    const result = await discoverPages({
      target: target('https://example.com/'),
      fetcher,
      extractor,
      options: { maxPages: 5, maxDepth: 2, concurrency: 1 },
      now: NOW
    });

    expect(requested).toEqual(['https://example.com/', 'https://example.com/other']);
    expect(result.pages[0].url).toBe('https://example.com/final');
  });
});
