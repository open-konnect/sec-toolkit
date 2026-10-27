import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { buildAssetModel, indexAssetModel } from '../src/tools/website-posture/logic/report/assetModel';
import { buildAssetGraph } from '../src/tools/website-posture/logic/report/graph';
import { AssessmentReport } from '../src/tools/website-posture/components/AssessmentReport';
import { AssessmentProgress } from '../src/tools/website-posture/components/AssessmentProgress';
import { AssetGraphDetails } from '../src/tools/website-posture/components/AssetGraphDetails';
import { FindingCard } from '../src/tools/website-posture/components/FindingCard';
import { ResourceTable } from '../src/tools/website-posture/components/ResourceTable';
import { SecurityAssessment } from '../src/tools/website-posture/types';

const NOW = new Date('2026-01-01T00:00:00Z');

async function assess(html: string): Promise<SecurityAssessment> {
  const parsed = parseTarget('https://example.com/');
  if (!parsed.ok) throw new Error(parsed.error);
  const runner = createBrowserPassiveRunner({
    fetcher: createStaticFetcher([{ url: 'https://example.com/', html }]),
    now: () => NOW
  });
  return runner.run({ target: parsed.target });
}

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

const SITE = `<html><head><title>Home</title></head><body>
  <script src="https://cdn.other.net/lib.js"></script>
  <script src="http://cdn.other.net/old.js"></script>
  <iframe src="https://widgets.other.net/x"></iframe></body></html>`;

describe('report rendering states', () => {
  it('renders every report section for a normal assessment', async () => {
    const html = render(<AssessmentReport assessment={await assess(SITE)} />);

    for (const heading of [
      'Website security posture report',
      'Findings by category',
      'Asset and resource inventory',
      'External domains',
      'Asset map',
      'What we checked',
      'What we could not verify',
      'Related tools'
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('Browser · passive');
    expect(html).toContain('Posture score');
    expect(html).toContain('Coverage');
    expect(html).toContain('cdn.other.net');
    expect(html).toContain('aria-expanded');
    expect(html).toContain('<caption');
  });

  it('renders an empty inventory without errors or an empty table', async () => {
    const html = render(<AssessmentReport assessment={await assess('<html><body>hi</body></html>')} />);

    expect(html).toContain('No resources were referenced');
    expect(html).toContain('No resources from other hostnames');
    expect(html).not.toContain('id="resource-search"');
  });

  it('renders a report with no findings', async () => {
    const assessment = { ...(await assess(SITE)), findings: [] };
    const html = render(<AssessmentReport assessment={assessment} />);

    expect(html).toContain('No findings were produced');
    expect(html).toContain('No issues detected in the checks performed.');
  });

  it('renders many findings without listing every card while categories are collapsed', async () => {
    const base = await assess(SITE);
    const template = base.findings[0];
    const findings = Array.from({ length: 80 }, (_, i) => ({
      ...template,
      id: `${template.id}-${i}`,
      status: 'pass' as const
    }));
    const html = render(<AssessmentReport assessment={{ ...base, findings }} />);

    // Clean categories start collapsed, so a long clean report stays short.
    expect(html.match(/<article/g)?.length ?? 0).toBeLessThan(80);
    expect(html).toContain('aria-expanded="false"');
  });

  it('never claims the site is secure or free of vulnerabilities', async () => {
    const html = render(<AssessmentReport assessment={await assess('<html><body>hi</body></html>')} />);
    const text = html.replace(/<[^>]+>/g, ' ');

    expect(text).not.toMatch(/no vulnerabilit/i);
    expect(text).not.toMatch(/\b(is|are) secure\b/i);
    expect(text).not.toMatch(/penetration|pentest/i);
  });

  it('shows status with text and a mark, not color alone', async () => {
    const assessment = await assess(SITE);
    const finding = assessment.findings.find((f) => f.status === 'fail' || f.status === 'warning')!;
    const html = render(<FindingCard finding={finding} defaultExpanded />);

    expect(html).toMatch(/Issue detected|Worth reviewing/);
    expect(html).toContain(finding.checkId);
    expect(html).toContain(finding.recommendation.slice(0, 20));
  });

  it('renders progress with eleven steps, a cancel control and a progressbar', () => {
    const html = render(
      <AssessmentProgress
        progress={{ phase: 'checking', message: 'Running checks', pagesAnalyzed: 1, checksCompleted: 3, totalChecks: 10 }}
        onCancel={() => undefined}
      />
    );
    expect(html.match(/<li/g)).toHaveLength(11);
    expect(html).toContain('Cancel');
    expect(html).toContain('role="progressbar"');
  });
});

describe('target-derived strings are rendered as text, never markup', () => {
  const hostile = '<img src=x onerror=alert(1)>';

  it('escapes a hostile page title in graph details', async () => {
    const assessment = await assess(`<html><head><title>${hostile.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title></head><body></body></html>`);
    const model = buildAssetModel(assessment);
    const graph = buildAssetGraph(model);
    const node = graph.nodes.find((n) => n.type === 'page')!;
    const html = render(
      <AssetGraphDetails
        node={node}
        graph={graph}
        model={model}
        index={indexAssetModel(model)}
        findingsById={new Map()}
        onSelectNode={() => undefined}
        onShowResource={() => undefined}
        onShowDomainResources={() => undefined}
        onShowFinding={() => undefined}
      />
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes hostile resource URLs in the table', async () => {
    const assessment = await assess(
      `<html><body><script src="https://cdn.other.net/a&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;.js"></script></body></html>`
    );
    const model = buildAssetModel(assessment);
    const html = render(
      <ResourceTable model={model} findingsById={new Map()} selectedResourceId={null} />
    );

    expect(html).not.toContain('<script>alert');
    expect(html).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
