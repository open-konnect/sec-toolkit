import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { buildAssetModel, indexAssetModel } from '../src/tools/website-posture/logic/report/assetModel';
import {
  countByFilter,
  filterDomains,
  filterResources,
  paginate
} from '../src/tools/website-posture/logic/report/inventoryFilters';
import {
  GRAPH_LIMITS,
  buildAssetGraph,
  relatedNodeIds,
  searchGraphNodes
} from '../src/tools/website-posture/logic/report/graph';
import { progressView } from '../src/tools/website-posture/logic/report/progressSteps';
import { summarizeCategories } from '../src/tools/website-posture/logic/report/reportCategories';
import { safeText, shortLabel, stableId } from '../src/tools/website-posture/logic/report/text';
import { summarizeUnverified, STANDING_LIMITATIONS } from '../src/tools/website-posture/logic/report/checked';
import { SecurityAssessment } from '../src/tools/website-posture/types';

const NOW = new Date('2026-01-01T00:00:00Z');

export async function assess(pages: Record<string, string>): Promise<SecurityAssessment> {
  const parsed = parseTarget('https://example.com/');
  if (!parsed.ok) throw new Error(parsed.error);
  const fetcher = createStaticFetcher(
    Object.entries(pages).map(([path, html]) => ({ url: `https://example.com${path}`, html })),
    { canDiscoverLinkedPages: true }
  );
  const runner = createBrowserPassiveRunner({ fetcher, now: () => NOW });
  return runner.run({ target: parsed.target, discovery: { maxPages: 10, maxDepth: 1 } });
}

const HOME = `<html><head><title>Home</title></head><body>
  <a href="/a">a</a>
  <script src="/app.js"></script>
  <script src="https://cdn.other.net/lib.js?token=SECRET123"></script>
  <script src="http://cdn.other.net/old.js"></script>
  <link rel="stylesheet" href="https://static.example.com/a.css">
  <img src="/i.png"><img src="data:image/png;base64,AAAA">
  <iframe src="https://widgets.other.net/x"></iframe>
</body></html>`;
const PAGE_A = `<html><head><title>A</title></head><body>
  <a href="/">home</a>
  <script src="/app.js"></script>
  <script src="https://cdn.other.net/lib.js"></script>
</body></html>`;

describe('asset model', () => {
  it('aggregates stats from real data and does not count data URIs as resources', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const { stats } = model;

    expect(stats.pagesCrawled).toBe(2);
    expect(stats.javascript).toBe(4);
    expect(stats.css).toBe(1);
    expect(stats.images).toBe(1);
    expect(stats.iframes).toBe(1);
    expect(stats.unresolvedReferences).toBe(1);
    expect(stats.resourcesDiscovered).toBe(model.resources.length);
    expect(stats.http).toBe(1);
    expect(stats.firstParty + stats.sameSite + stats.thirdParty).toBe(stats.resourcesDiscovered);
  });

  it('classifies first-party, same-site and third-party resources', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const byUrl = (url: string) => model.resources.find((r) => r.url === url);

    expect(byUrl('https://example.com/app.js')?.relationship).toBe('first-party');
    expect(byUrl('https://static.example.com/a.css')?.relationship).toBe('same-site');
    expect(byUrl('https://cdn.other.net/lib.js')?.relationship).toBe('third-party');
  });

  it('deduplicates a resource shared by pages and keeps stable ids', async () => {
    const first = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const second = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const app = first.resources.filter((r) => r.url === 'https://example.com/app.js');

    expect(app).toHaveLength(1);
    expect(app[0].pageIds).toHaveLength(2);
    expect(app[0].referenceCount).toBe(2);
    expect(first.resources.map((r) => r.id)).toEqual(second.resources.map((r) => r.id));
    expect(new Set(first.resources.map((r) => r.id)).size).toBe(first.resources.length);
  });

  it('never keeps query strings, which can carry tokens', async () => {
    const model = buildAssetModel(await assess({ '/': HOME }));
    expect(JSON.stringify(model)).not.toContain('SECRET123');
  });

  it('aggregates external domains with counts, types and protocols', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const cdn = model.domains.find((d) => d.host === 'cdn.other.net');

    // lib.js and lib.js?… (a dropped query) are kept as distinct entries.
    expect(cdn?.resourceCount).toBe(3);
    expect(cdn?.byType.script).toBe(3);
    expect(cdn?.usesHttp).toBe(true);
    expect(cdn?.pageIds).toHaveLength(2);
    expect(model.domains.some((d) => d.host === 'example.com')).toBe(false);
    expect(model.stats.externalDomains).toBe(model.domains.length);
  });

  it('links findings to the resources they name', async () => {
    const assessment = await assess({ '/': HOME });
    const model = buildAssetModel(assessment);
    const index = indexAssetModel(model);
    const http = model.resources.find((r) => r.url === 'http://cdn.other.net/old.js');

    expect(http?.observations).toContain('plaintext-http');
    expect(http?.findingIds.length).toBeGreaterThan(0);
    expect(http?.issueLevel).not.toBe('none');
    for (const id of http?.findingIds ?? []) {
      expect(assessment.findings.some((f) => f.id === id)).toBe(true);
    }
    const domain = index.domainByHost.get('cdn.other.net');
    expect(domain?.findingIds.length).toBeGreaterThan(0);
  });

  it('carries affected resources through aggregation, sanitized', async () => {
    const assessment = await assess({ '/': HOME });
    const withResources = assessment.findings.filter((f) => f.affectedResources.length > 0);

    expect(withResources.length).toBeGreaterThan(0);
    for (const finding of withResources) {
      expect(finding.affectedResourceCount).toBeGreaterThanOrEqual(finding.affectedResources.length);
      expect(finding.affectedResources.join(' ')).not.toContain('SECRET123');
    }
  });

  it('is empty, not broken, when pages reference nothing', async () => {
    const model = buildAssetModel(await assess({ '/': '<html><body>hi</body></html>' }));
    expect(model.resources).toEqual([]);
    expect(model.domains).toEqual([]);
    expect(model.stats.resourcesDiscovered).toBe(0);
    expect(buildAssetGraph(model).nodes.map((n) => n.type)).toEqual(['target', 'page']);
  });
});

describe('resource filtering, search and paging', () => {
  it('filters by type, party, scheme and findings', async () => {
    const { resources } = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));

    expect(filterResources(resources, 'script', '').every((r) => r.type === 'script')).toBe(true);
    expect(filterResources(resources, 'third-party', '').every((r) => r.relationship === 'third-party')).toBe(true);
    expect(filterResources(resources, 'http', '').map((r) => r.url)).toEqual(['http://cdn.other.net/old.js']);
    expect(filterResources(resources, 'has-findings', '').length).toBeGreaterThan(0);
    expect(countByFilter(resources).all).toBe(resources.length);
  });

  it('searches URL, hostname, type and referring page, all terms required', async () => {
    const { resources } = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));

    expect(filterResources(resources, 'all', 'cdn.other.net').length).toBe(3);
    expect(filterResources(resources, 'all', 'CDN.OTHER.NET script').length).toBe(3);
    expect(filterResources(resources, 'all', 'iframe').map((r) => r.type)).toEqual(['iframe']);
    expect(filterResources(resources, 'all', 'example.com/a lib.js').length).toBe(1);
    expect(filterResources(resources, 'all', 'nothing-matches-this')).toEqual([]);
  });

  it('filters domains and clamps pagination', async () => {
    const { domains } = buildAssetModel(await assess({ '/': HOME }));
    expect(filterDomains(domains, 'widgets').map((d) => d.host)).toEqual(['widgets.other.net']);

    const items = Array.from({ length: 53 }, (_, i) => i);
    expect(paginate(items, 1, 25)).toMatchObject({ pageCount: 3, start: 1, end: 25 });
    expect(paginate(items, 99, 25)).toMatchObject({ page: 3, start: 51, end: 53 });
    expect(paginate(items, -4, 25).page).toBe(1);
    expect(paginate([], 1, 25)).toMatchObject({ total: 0, start: 0, end: 0, pageCount: 1 });
  });
});

describe('asset graph', () => {
  it('builds target, page, resource and domain nodes with unique ids and edges', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const graph = buildAssetGraph(model);
    const types = new Set(graph.nodes.map((n) => n.type));

    expect(graph.status).toBe('ok');
    expect([...types].sort()).toEqual(['domain', 'page', 'resource', 'target']);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length);
    expect(new Set(graph.edges.map((e) => e.id)).size).toBe(graph.edges.length);

    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
  });

  it('draws one page-to-page edge for mutual links and one loads edge per page', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const graph = buildAssetGraph(model);
    const links = graph.edges.filter((e) => e.kind === 'links-to');
    const shared = model.resources.find((r) => r.url === 'https://example.com/app.js')!;

    expect(links).toHaveLength(1);
    expect(graph.edges.filter((e) => e.kind === 'loads' && e.target === shared.id)).toHaveLength(2);
  });

  it('applies type, party and attention filters', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));

    const scripts = buildAssetGraph(model, { groups: new Set(['script']), party: 'all', onlyAttention: false });
    expect(scripts.nodes.filter((n) => n.type === 'resource').every((n) => n.group === 'script')).toBe(true);

    const firstParty = buildAssetGraph(model, { groups: null, party: 'first-party', onlyAttention: false });
    expect(firstParty.nodes.some((n) => n.type === 'domain')).toBe(false);

    const attention = buildAssetGraph(model, { groups: null, party: 'all', onlyAttention: true });
    expect(attention.nodes.filter((n) => n.type === 'resource').every((n) => n.issueLevel !== 'none' || n.notable)).toBe(true);
  });

  it('finds nodes by search and reveals related nodes for a domain and a page', async () => {
    const model = buildAssetModel(await assess({ '/': HOME, '/a': PAGE_A }));
    const graph = buildAssetGraph(model);
    const domain = graph.nodes.find((n) => n.type === 'domain' && n.host === 'cdn.other.net')!;

    expect(searchGraphNodes(graph, 'cdn.other.net').length).toBeGreaterThanOrEqual(3);
    expect(searchGraphNodes(graph, '')).toEqual([]);

    const related = relatedNodeIds(graph, domain.id);
    expect(related.filter((id) => graph.nodes.find((n) => n.id === id)?.type === 'resource')).toHaveLength(3);
    expect(related.filter((id) => graph.nodes.find((n) => n.id === id)?.type === 'page')).toHaveLength(2);
    expect(related).not.toContain(domain.id);

    const home = graph.nodes.find((n) => n.type === 'page' && n.url === 'https://example.com/')!;
    expect(relatedNodeIds(graph, home.id).some((id) => graph.nodes.find((n) => n.id === id)?.type === 'resource')).toBe(true);
  });

  it('degrades to external and flagged resources when the full graph is too big', async () => {
    const images = Array.from({ length: GRAPH_LIMITS.maxNodes + 50 }, (_, i) => `<img src="/img/${i}.png">`).join('');
    const model = buildAssetModel(
      await assess({ '/': `<html><body>${images}<script src="https://cdn.other.net/x.js"></script></body></html>` })
    );
    const graph = buildAssetGraph(model);

    expect(graph.status).toBe('degraded');
    expect(graph.nodes.length).toBeLessThanOrEqual(GRAPH_LIMITS.maxNodes);
    expect(graph.omittedResources).toBeGreaterThan(GRAPH_LIMITS.maxNodes);
    expect(graph.nodes.some((n) => n.host === 'cdn.other.net')).toBe(true);
    // The table stays authoritative.
    expect(model.resources.length).toBeGreaterThan(GRAPH_LIMITS.maxNodes);
  });

  it('returns no elements, with a status, when even the reduced graph is too big', async () => {
    const scripts = Array.from(
      { length: GRAPH_LIMITS.maxNodes + 20 },
      (_, i) => `<script src="https://h${i}.other${i}.net/x.js"></script>`
    ).join('');
    const graph = buildAssetGraph(buildAssetModel(await assess({ '/': `<html><body>${scripts}</body></html>` })));

    expect(graph.status).toBe('too-large');
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.totals.nodes).toBeGreaterThan(GRAPH_LIMITS.maxNodes);
  });
});

describe('target-derived string safety', () => {
  it('strips control, bidi and zero-width characters and bounds length', () => {
    expect(safeText('a\u202Eb\u200Bc\u0000d\ne')).toBe('abcd e');
    expect(safeText('x'.repeat(500), 50)).toHaveLength(50);
    expect(safeText(null)).toBe('');
    expect(shortLabel('https://example.com/' + 'p/'.repeat(60), 30).length).toBeLessThanOrEqual(30);
  });

  it('gives ids that contain no target text', () => {
    const id = stableId('rs', '<script>alert(1)</script>');
    expect(id).toMatch(/^rs-[0-9a-z]+$/);
    expect(stableId('rs', 'a')).toBe(stableId('rs', 'a'));
    expect(stableId('rs', 'a')).not.toBe(stableId('dm', 'a'));
  });

  it('keeps HTML-looking titles as inert text in the model', async () => {
    const model = buildAssetModel(
      await assess({ '/': '<html><head><title>&lt;img src=x onerror=alert(1)&gt;</title></head><body></body></html>' })
    );
    const node = buildAssetGraph(model).nodes.find((n) => n.type === 'page')!;

    expect(typeof node.title).toBe('string');
    expect(node.label).not.toMatch(/[\u202A-\u202E\u200B]/);
  });
});

describe('progress, categories and limitations', () => {
  it('shows eleven steps and ends fully done on completion', () => {
    const idle = progressView(null);
    expect(idle.steps).toHaveLength(11);
    expect(idle.steps[0].state).toBe('active');
    expect(idle.percent).toBeLessThan(10);

    const done = progressView({ phase: 'complete', message: '', pagesAnalyzed: 1, checksCompleted: 5, totalChecks: 5 });
    expect(done.steps.every((s) => s.state === 'done')).toBe(true);
    expect(done.percent).toBe(100);

    const mid = progressView({ phase: 'checking', message: '', pagesAnalyzed: 1, checksCompleted: 2, totalChecks: 4 });
    expect(mid.steps.filter((s) => s.state === 'active')).toHaveLength(1);
    expect(mid.percent).toBeGreaterThan(0);
    expect(mid.percent).toBeLessThan(100);
  });

  it('summarizes findings by report category with consistent counts', async () => {
    const assessment = await assess({ '/': HOME });
    const summaries = summarizeCategories(assessment.findings);

    expect(summaries.reduce((sum, s) => sum + s.total, 0)).toBe(assessment.findings.length);
    for (const summary of summaries) {
      expect(summary.attention).toBe(summary.counts.fail + summary.counts.warning);
    }
  });

  it('lists standing browser limits that are never described as failures', async () => {
    const assessment = await assess({ '/': HOME });
    expect(STANDING_LIMITATIONS.join(' ')).toMatch(/TLS/);
    expect(STANDING_LIMITATIONS.join(' ')).toMatch(/Authenticated/i);
    expect(STANDING_LIMITATIONS.join(' ')).not.toMatch(/\bfail/i);
    expect(summarizeUnverified(assessment).length).toBe(assessment.checksUnableToVerify.length);
  });
});

describe('pages that could not be read', () => {
  it('explains an unreachable entry page and suggests the www address', async () => {
    const { summarizeFetchProblems, suggestWwwVariant } = await import('../src/tools/website-posture/logic/report/fetchProblems');
    const parsed = parseTarget('https://example.com/?token=SECRET9');
    if (!parsed.ok) throw new Error(parsed.error);
    const assessment = await createBrowserPassiveRunner({
      fetcher: createStaticFetcher([]),
      now: () => NOW
    }).run({ target: parsed.target });
    const summary = summarizeFetchProblems(assessment);
    expect(summary.nothingRead).toBe(true);
    expect(summary.problems.length).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toContain('SECRET9');
    expect(suggestWwwVariant('https://flipkart.com')).toBe('https://www.flipkart.com/');
    expect(suggestWwwVariant('https://www.flipkart.com')).toBeNull();
    expect(suggestWwwVariant('https://example.co.uk')).toBeNull();
    expect(suggestWwwVariant('http://127.0.0.1')).toBeNull();
  });

  it('shows nothing when every page was read', async () => {
    const { summarizeFetchProblems } = await import('../src/tools/website-posture/logic/report/fetchProblems');
    const summary = summarizeFetchProblems(await assess({ '/': HOME, '/a': '<html></html>' }));
    expect(summary).toMatchObject({ nothingRead: false, problems: [], suggestion: null });
  });
});

describe('script-heavy pages', () => {
  it('counts inline scripts so the report can explain a low resource count', async () => {
    const model = buildAssetModel(await assess({ '/': '<html><body><script>var a=1</script><script>var b=2</script><img src="/x.png"></body></html>' }));
    expect(model.stats.inlineScripts).toBe(2);
    expect(model.stats.resourcesDiscovered).toBe(1);
  });
});
