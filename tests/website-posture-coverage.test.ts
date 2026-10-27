import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { relationshipOf, summarizeThirdPartySurface } from '../src/tools/website-posture/logic/analysis/thirdParty';
import { buildAnalyzedPage } from '../src/tools/website-posture/logic/page';
import { createHtmlScannerExtractor } from '../src/tools/website-posture/logic/htmlScanner';
import { SecurityAssessment } from '../src/tools/website-posture/types';

const NOW = new Date('2026-01-01T00:00:00Z');
const extractor = createHtmlScannerExtractor();

async function crawl(pages: Record<string, string>, maxPages = 10): Promise<SecurityAssessment> {
  const parsed = parseTarget('https://example.com/');
  if (!parsed.ok) throw new Error(parsed.error);
  const fetcher = createStaticFetcher(
    Object.entries(pages).map(([path, html]) => ({ url: `https://example.com${path}`, html })),
    { canDiscoverLinkedPages: true }
  );
  const runner = createBrowserPassiveRunner({ fetcher, now: () => NOW });
  return runner.run({ target: parsed.target, discovery: { maxPages, maxDepth: 1 } });
}

function pageOf(html: string, url = 'https://example.com/') {
  return buildAnalyzedPage({
    snapshot: extractor.extract(html, url),
    url,
    depth: 0,
    statusCode: 200,
    contentType: 'text/html',
    headers: { visibility: 'cors-restricted', values: {} },
    fetchedAt: NOW
  });
}

describe('coverage', () => {
  it('counts discovered, analyzed, inaccessible and skipped pages', async () => {
    const a = await crawl({
      '/': '<html><body><a href="/a">a</a><a href="/gone">g</a><a href="/logout">l</a><a href="/f.pdf">f</a></body></html>',
      '/a': '<html><body>a</body></html>'
    });

    expect(a.coverage.pagesAnalyzed).toBe(2);
    expect(a.coverage.pagesInaccessible).toBe(1);
    expect(a.coverage.pagesSkipped).toBeGreaterThanOrEqual(2);
    expect(a.coverage.pagesDiscovered).toBeGreaterThanOrEqual(a.coverage.pagesAnalyzed);
  });

  it('separates "no issue observed" from "could not verify" in the explanation', async () => {
    const a = await crawl({ '/': '<html><body>hi</body></html>' });

    expect(a.coverage.explanation).toMatch(/no issue/i);
    expect(a.coverage.explanation).toMatch(/could not verify|unable to verify/i);
    expect(a.coverage.explanation).not.toMatch(/\bsecure\b/i);
  });

  it('adds up checks into performed, unable to verify and not applicable', async () => {
    const a = await crawl({ '/': '<html><body>hi</body></html>' });
    const { performed, unableToVerify, notApplicable, errored, totalChecks } = a.coverage;

    expect(performed + unableToVerify + notApplicable + errored).toBe(totalChecks);
    expect(a.checksUnableToVerify.length).toBe(unableToVerify);
  });

  it('does not lower the score for checks that could not be verified', async () => {
    const a = await crawl({ '/': '<html><body>hi</body></html>' });
    const unverified = new Set(a.checksUnableToVerify);

    expect(a.score.scoredChecks.some((id) => unverified.has(id))).toBe(false);
  });
});

describe('maturity dimensions', () => {
  it('splits scored checks between technical and hygiene without overlap', async () => {
    const a = await crawl({
      '/': '<html><body><form action="http://example.com/l"><input type="password"></form></body></html>'
    });
    const { technical, hygiene } = a.score.dimensions;
    const overlap = technical.scoredChecks.filter((id) => hygiene.scoredChecks.includes(id));

    expect(overlap).toEqual([]);
    expect(technical.value === null || technical.value < 100).toBe(true);
  });

  it('reports null, not a perfect score, for a dimension with nothing scored', async () => {
    const a = await crawl({ '/': '<html></html>' });
    for (const dimension of [a.score.dimensions.technical, a.score.dimensions.hygiene]) {
      if (dimension.scoredChecks.length === 0) expect(dimension.value).toBeNull();
    }
  });
});

describe('page inventory', () => {
  it('describes each analyzed page with counts and no body content', async () => {
    const a = await crawl({
      '/': `<html><head><title>Home</title><meta name="description" content="Welcome"></head><body>
        <a href="/a">a</a><script src="https://cdn.other.net/x.js"></script>
        <img src="/i.png"><form><input type="password" value="s3cret-value"></form></body></html>`,
      '/a': '<html><head><title>A</title></head><body></body></html>'
    });
    const home = a.pageInventory.find((entry) => entry.url === 'https://example.com/');

    expect(a.pageInventory).toHaveLength(2);
    expect(home?.title).toBe('Home');
    expect(home?.metaDescription).toBe('Welcome');
    expect(home?.counts.scripts).toBe(1);
    expect(home?.counts.images).toBe(1);
    expect(home?.counts.forms).toBe(1);
    expect(home?.counts.passwordForms).toBe(1);
    expect(home?.externalDomains).toEqual(['cdn.other.net']);
    expect(JSON.stringify(a.pageInventory)).not.toContain('s3cret-value');
  });
});

describe('third-party surface', () => {
  it('classifies relationships by registrable domain, not by host', () => {
    const html = `<html><body>
      <script src="/own.js"></script>
      <script src="https://static.example.com/a.js"></script>
      <script src="https://cdn.other.net/b.js"></script>
      <script src="https://www.googletagmanager.com/gtm.js"></script>
    </body></html>`;
    const page = pageOf(html);
    const summary = summarizeThirdPartySurface([page]);

    expect(summary.firstPartyResources).toBe(1);
    expect(summary.sameSiteResources).toBe(1);
    expect(summary.thirdPartyResources).toBe(2);
    expect(summary.externalResources).toBe(3);
    expect(summary.sameSiteDomains).toEqual(['static.example.com']);
    expect(summary.thirdPartyDomains).toEqual(['cdn.other.net', 'www.googletagmanager.com']);
    expect(summary.byKind['tag-manager']).toContain('www.googletagmanager.com');
    expect(summary.externalScripts).toBe(3);
  });

  it('counts a host once per type and across pages', () => {
    const one = pageOf('<html><body><script src="https://cdn.other.net/a.js"></script><img src="https://cdn.other.net/i.png"></body></html>', 'https://example.com/');
    const two = pageOf('<html><body><script src="https://cdn.other.net/a.js"></script></body></html>', 'https://example.com/b');
    const summary = summarizeThirdPartySurface([one, two]);
    const detail = summary.details.find((entry) => entry.host === 'cdn.other.net');

    expect(summary.domains).toEqual(['cdn.other.net']);
    expect(detail?.pageCount).toBe(2);
    expect(detail?.resourceCount).toBe(3);
    expect(detail?.byType.script).toBe(2);
    expect(detail?.byType.image).toBe(1);
    expect(detail?.relationship).toBe('third-party');
  });

  it('never labels a domain as malicious', () => {
    const page = pageOf('<html><body><script src="https://cdn.other.net/a.js"></script></body></html>');
    expect(JSON.stringify(summarizeThirdPartySurface([page]))).not.toMatch(/malicious|untrusted|bad/i);
  });

  it('does not treat two unknown registrable domains as the same site', () => {
    const resource = { host: 'localhost', crossOrigin: true } as Parameters<typeof relationshipOf>[0];
    expect(relationshipOf(resource, 'https://other.local', 'other.local')).not.toBe('same-site');
  });
});
