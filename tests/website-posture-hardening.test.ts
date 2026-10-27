import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { buildAssetModel } from '../src/tools/website-posture/logic/report/assetModel';
import { buildAssetGraph } from '../src/tools/website-posture/logic/report/graph';

const NOW = new Date('2026-01-01T00:00:00Z');

async function run(html: string) {
  const parsed = parseTarget('https://example.com/?apikey=TARGETQ1');
  if (!parsed.ok) throw new Error(parsed.error);
  const fetcher = createStaticFetcher([{ url: 'https://example.com/?apikey=TARGETQ1', html }]);
  return createBrowserPassiveRunner({ fetcher, now: () => NOW }).run({ target: parsed.target });
}

describe('report inventory hygiene', () => {
  it('merges hosts that differ only by a trailing dot', async () => {
    const a = await run(
      `<script src="https://cdn.other.net/a.js"></script><script src="https://cdn.other.net./b.js"></script>`
    );
    const model = buildAssetModel(a);
    expect(model.domains.filter((d) => d.host === 'cdn.other.net')).toHaveLength(1);
    expect(model.domains.some((d) => d.host.endsWith('.'))).toBe(false);
  });

  it('keeps distinct origins of one host visible', async () => {
    const a = await run(
      `<script src="https://cdn.other.net/a.js"></script><script src="https://cdn.other.net:8443/b.js"></script>`
    );
    const domain = buildAssetModel(a).domains.find((d) => d.host === 'cdn.other.net');
    expect(domain?.origins).toEqual(['https://cdn.other.net', 'https://cdn.other.net:8443']);
  });

  it('does not inventory non-web schemes as resources', async () => {
    const a = await run(
      `<script src="javascript:alert(1)"></script><img src="ftp://files.example.net/x.png"><img src="data:image/png;base64,AAAA">`
    );
    const model = buildAssetModel(a);
    expect(model.resources).toHaveLength(0);
    expect(model.stats.unresolvedReferences).toBe(3);
  });
});

describe('sensitive values stay out of report-facing data', () => {
  it('omits query strings, form values and script secrets from findings, model and graph', async () => {
    const a = await run(`<html><head><meta http-equiv="Content-Security-Policy" content="script-src 'self'"></head><body>
      <form action="http://example.com/login?sess=FORMQ7" method="post">
        <input type="password" name="p" value="PWVAL1"><input type="hidden" name="tok" value="HIDDEN55"></form>
      <script>localStorage.setItem("SKEY1","SVAL1"); document.cookie="sid=COOKIE77"; eval(x)</script>
      <a href="https://other.net/p?token=LINKTOK9" target="_blank">x</a>
      <script src="https://cdn.other.net/a.js?auth=SRCTOK3"></script>
      <iframe src="https://w.net/f?s=FRAMETOK4"></iframe></body></html>`);
    const model = buildAssetModel(a);
    const surfaces = JSON.stringify({ findings: a.findings, model, graph: buildAssetGraph(model) });
    for (const secret of ['FORMQ7', 'PWVAL1', 'HIDDEN55', 'SKEY1', 'SVAL1', 'COOKIE77', 'LINKTOK9', 'SRCTOK3', 'FRAMETOK4', 'TARGETQ1']) {
      expect(surfaces, secret).not.toContain(secret);
    }
  });
});

describe('hostile and oversized input', () => {
  const cases: Record<string, string> = {
    'angle brackets': '<'.repeat(500_000),
    'unclosed tags': '<a '.repeat(200_000),
    'attribute flood': '<div ' + 'a="b" '.repeat(100_000) + '>',
    'deep nesting': '<div>'.repeat(100_000),
    'unclosed script': '<script>' + 'x'.repeat(500_000),
    'quote flood': '<a href="' + '"'.repeat(300_000),
    'very long URL': `<script src="https://a.com/${'a'.repeat(50_000)}.js"></script>`
  };
  for (const [name, html] of Object.entries(cases)) {
    it(`completes without error: ${name}`, async () => {
      const a = await run(html);
      expect(a.errors).toHaveLength(0);
      expect(buildAssetGraph(buildAssetModel(a)).nodes.length).toBeLessThan(500);
    });
  }

  it('bounds resources and graph size for thousands of references', async () => {
    const html = Array.from({ length: 5000 }, (_, i) => `<script src="https://h${i}.x${i % 50}.com/a.js"></script>`).join('');
    const model = buildAssetModel(await run(html));
    expect(model.resources.length).toBeLessThanOrEqual(1000);
    expect(buildAssetGraph(model).nodes.length).toBeLessThanOrEqual(400);
  });
});
