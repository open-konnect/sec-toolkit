import { describe, expect, it } from 'vitest';
import {
  TechnologyInput,
  detectTechnologies,
  mergeTechnologies,
  scriptMarkerIds
} from '../src/tools/website-posture/logic/analysis/technology';
import { createHtmlScannerExtractor } from '../src/tools/website-posture/logic/htmlScanner';
import { buildAnalyzedPage } from '../src/tools/website-posture/logic/page';

function input(overrides: Partial<TechnologyInput> = {}): TechnologyInput {
  return {
    resourceUrls: [],
    resourceHosts: [],
    metaGenerator: null,
    headers: {},
    markers: [],
    scriptMarkers: new Set<string>(),
    ...overrides
  };
}

function find(technologies: ReturnType<typeof detectTechnologies>, id: string) {
  return technologies.find((technology) => technology.id === id);
}

describe('website posture: technology detection', () => {
  it('reports nothing when there is no evidence', () => {
    expect(detectTechnologies(input())).toEqual([]);
  });

  it('does not invent a version from a framework marker', () => {
    const result = detectTechnologies(input({ markers: ['attr:data-reactroot'] }));
    const react = find(result, 'react');

    expect(react).toBeDefined();
    expect(react?.version).toBeUndefined();
    expect(react?.confidence).toBe('medium');
  });

  it('reads an Angular version only from the ng-version marker', () => {
    const versioned = find(detectTechnologies(input({ markers: ['attr:ng-version=17.3.1'] })), 'angular');
    const bare = find(detectTechnologies(input({ markers: ['attr:_nghost'] })), 'angular');

    expect(versioned?.version).toBe('17.3.1');
    expect(versioned?.confidence).toBe('high');
    expect(bare?.version).toBeUndefined();
  });

  it('treats a generator tag as definitive and keeps only a version it states', () => {
    const withVersion = find(
      detectTechnologies(input({ metaGenerator: 'WordPress 6.4.2' })),
      'wordpress'
    );
    const without = find(detectTechnologies(input({ metaGenerator: 'WordPress' })), 'wordpress');

    expect(withVersion?.version).toBe('6.4.2');
    expect(withVersion?.confidence).toBe('high');
    expect(without?.version).toBeUndefined();
  });

  it('detects WordPress, Drupal and Shopify from resource evidence', () => {
    const result = detectTechnologies(
      input({
        resourceUrls: [
          'https://example.com/wp-content/themes/x/style.css',
          'https://example.com/sites/default/files/a.js'
        ],
        resourceHosts: ['example.com', 'cdn.shopify.com']
      })
    );

    expect(find(result, 'wordpress')).toBeDefined();
    expect(find(result, 'drupal')).toBeDefined();
    expect(find(result, 'shopify')).toBeDefined();
  });

  it('raises confidence to high with two independent signals', () => {
    const result = detectTechnologies(
      input({
        resourceUrls: ['https://example.com/wp-content/a.css'],
        scriptMarkers: new Set(['wp-settings'])
      })
    );

    expect(find(result, 'wordpress')?.confidence).toBe('high');
  });

  it('detects Next.js and labels the implied React as implied', () => {
    const result = detectTechnologies(
      input({ resourceUrls: ['https://example.com/_next/static/chunks/main.js'], markers: ['id:__next'] })
    );
    const react = find(result, 'react');

    expect(find(result, 'nextjs')?.confidence).toBe('high');
    expect(react?.signals[0].detail).toMatch(/implied by Next\.js/);
    expect(react?.confidence).toBe('medium');
    expect(react?.version).toBeUndefined();
  });

  it('reads server, platform and CDN indicators from headers', () => {
    const result = detectTechnologies(
      input({
        headers: {
          server: 'nginx/1.25.3',
          'x-powered-by': 'PHP/8.2.1',
          'cf-ray': '8abc-LHR',
          'x-vercel-id': 'iad1::abc'
        }
      })
    );

    expect(find(result, 'nginx')?.version).toBe('1.25.3');
    expect(find(result, 'php')?.version).toBe('8.2.1');
    expect(find(result, 'cloudflare')?.confidence).toBe('high');
    expect(find(result, 'vercel')?.category).toBe('hosting');
  });

  it('does not report a server whose header gives no version as having one', () => {
    const result = detectTechnologies(input({ headers: { server: 'nginx' } }));
    expect(find(result, 'nginx')?.version).toBeUndefined();
  });

  it('detects analytics providers and CDNs from hosts', () => {
    const result = detectTechnologies(
      input({
        resourceUrls: ['https://www.googletagmanager.com/gtag/js?id=G-XXXX'],
        resourceHosts: ['www.googletagmanager.com', 'cdn.jsdelivr.net', 'static.hotjar.com']
      })
    );

    expect(find(result, 'google-analytics')?.category).toBe('analytics');
    expect(find(result, 'jsdelivr')?.category).toBe('cdn');
    expect(find(result, 'hotjar')).toBeDefined();
  });

  it('never puts matched page content into a signal', () => {
    const result = detectTechnologies(
      input({
        metaGenerator: 'WordPress 6.4.2 secret-token-123',
        resourceUrls: ['https://example.com/wp-content/a.css?token=abc123']
      })
    );
    const text = JSON.stringify(result);

    expect(text).not.toContain('secret-token-123');
    expect(text).not.toContain('abc123');
  });

  it('merges pages, keeping a version only when every page agrees', () => {
    const agree = mergeTechnologies([
      detectTechnologies(input({ metaGenerator: 'WordPress 6.4.2' })),
      detectTechnologies(input({ metaGenerator: 'WordPress 6.4.2' }))
    ]);
    const disagree = mergeTechnologies([
      detectTechnologies(input({ metaGenerator: 'WordPress 6.4.2' })),
      detectTechnologies(input({ metaGenerator: 'WordPress 5.9' }))
    ]);

    expect(find(agree, 'wordpress')?.version).toBe('6.4.2');
    expect(find(disagree, 'wordpress')?.version).toBeUndefined();
  });

  it('reduces inline script to catalogue ids', () => {
    expect(scriptMarkerIds('window.__NEXT_DATA__ = {"props":{"secret":"x"}}')).toEqual(['next-data']);
    expect(scriptMarkerIds('')).toEqual([]);
  });
});

describe('website posture: technology detection through the page model', () => {
  const extractor = createHtmlScannerExtractor();

  async function pageFor(html: string, headers: Record<string, string> = {}) {
    const snapshot = await extractor.extract(html, 'https://example.com/');
    return buildAnalyzedPage({
      snapshot,
      url: 'https://example.com/',
      depth: 0,
      statusCode: 200,
      contentType: 'text/html',
      headers: { visibility: 'readable', values: headers },
      fetchedAt: new Date('2026-01-01T00:00:00.000Z')
    });
  }

  it('detects Next.js from the root id and bundle path without a version', async () => {
    const page = await pageFor(
      '<html><body><div id="__next"></div><script src="/_next/static/chunks/main.js"></script></body></html>'
    );
    const next = page.detectedTechnologies.find((technology) => technology.id === 'nextjs');

    expect(next).toBeDefined();
    expect(next?.version).toBeUndefined();
  });

  it('detects Angular and its version from ng-version', async () => {
    const page = await pageFor('<html><body><app-root ng-version="16.2.0"></app-root></body></html>');
    const angular = page.detectedTechnologies.find((technology) => technology.id === 'angular');

    expect(angular?.version).toBe('16.2.0');
  });

  it('ignores a malformed ng-version rather than echoing it', async () => {
    const page = await pageFor(
      '<html><body><app-root ng-version="<script>alert(1)</script>"></app-root></body></html>'
    );
    const angular = page.detectedTechnologies.find((technology) => technology.id === 'angular');

    expect(JSON.stringify(page.detectedTechnologies)).not.toContain('alert');
    expect(angular?.version).toBeUndefined();
  });

  it('records canonical URL without its query and a bounded description', async () => {
    const page = await pageFor(
      '<html><head><link rel="canonical" href="https://example.com/a?token=zzz#frag"><meta name="description" content="  A   page\n about  things "></head><body></body></html>'
    );

    expect(page.canonicalUrl).toBe('https://example.com/a');
    expect(page.metaDescription).toBe('A page about things');
  });

  it('uses readable headers only', async () => {
    const readable = await pageFor('<html></html>', { server: 'nginx/1.25.3' });
    expect(readable.detectedTechnologies.find((t) => t.id === 'nginx')?.version).toBe('1.25.3');
  });
});
