import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import { dimensionOf } from '../src/tools/website-posture/logic/maturity';
import { SecurityAssessment } from '../src/tools/website-posture/types';

const NOW = new Date('2026-01-01T00:00:00Z');

interface Page {
  path: string;
  html: string;
}

async function assessSite(
  pages: Page[],
  options: { origin?: string; headers?: Record<string, string> } = {}
): Promise<SecurityAssessment> {
  const origin = options.origin ?? 'https://example.com';
  const parsed = parseTarget(`${origin}/`);
  if (!parsed.ok) throw new Error(parsed.error);
  const fetcher = createStaticFetcher(
    pages.map((page) => ({
      url: `${origin}${page.path}`,
      html: page.html,
      headers: options.headers,
      headersAreComplete: options.headers !== undefined
    })),
    { canDiscoverLinkedPages: true }
  );
  const runner = createBrowserPassiveRunner({ fetcher, now: () => NOW });
  return runner.run({ target: parsed.target, discovery: { maxPages: 10, maxDepth: 1 } });
}

const one = (html: string, opts?: Parameters<typeof assessSite>[1]) =>
  assessSite([{ path: '/', html }], opts);

const forCheck = (a: SecurityAssessment, id: string) => a.findings.filter((f) => f.checkId === id);
const statuses = (a: SecurityAssessment, id: string) => forCheck(a, id).map((f) => f.status);

const CSP_META = (policy: string) =>
  `<meta http-equiv="Content-Security-Policy" content="${policy}">`;

describe('correlation A: password form posting to HTTP', () => {
  it('fails when an HTTPS page posts a password to an HTTP action', async () => {
    const a = await one(
      '<html><body><form action="http://example.com/login" method="post"><input type="password" name="p"></form></body></html>'
    );
    const finding = forCheck(a, 'correlation-password-form-http-action').find((f) => f.status === 'fail');

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
  });

  it('does not fire for an HTTPS action', async () => {
    const a = await one(
      '<html><body><form action="https://example.com/login" method="post"><input type="password"></form></body></html>'
    );
    expect(statuses(a, 'correlation-password-form-http-action')).not.toContain('fail');
  });

  it('does not store the typed or default value of the field', async () => {
    const a = await one(
      '<html><body><form action="http://example.com/x"><input type="password" value="hunter2-secret"></form></body></html>'
    );
    expect(JSON.stringify(a)).not.toContain('hunter2-secret');
  });
});

describe('correlation B: HTTP script on an HTTPS page', () => {
  it('fails for an http:// script', async () => {
    const a = await one('<html><body><script src="http://cdn.example.net/a.js"></script></body></html>');
    expect(statuses(a, 'correlation-http-script')).toContain('fail');
  });

  it('is not applicable when every script is HTTPS', async () => {
    const a = await one('<html><body><script src="https://cdn.example.net/a.js"></script></body></html>');
    expect(statuses(a, 'correlation-http-script')).not.toContain('fail');
  });
});

describe('correlation C: CSP unsafe-inline with inline scripts', () => {
  const inline = '<script>var a = 1;</script>';

  it('warns, without raising the score weight, when unsafe-inline meets inline script', async () => {
    const a = await one(
      `<html><head>${CSP_META("script-src 'self' 'unsafe-inline'")}</head><body>${inline}</body></html>`
    );
    const finding = forCheck(a, 'correlation-csp-unsafe-inline-usage').find((f) => f.status === 'warning');

    expect(finding).toBeDefined();
    expect(finding?.confidence).not.toBe('high');
  });

  it('passes when a nonce neutralises unsafe-inline', async () => {
    const a = await one(
      `<html><head>${CSP_META("script-src 'nonce-abc' 'unsafe-inline'")}</head><body>${inline}</body></html>`
    );
    expect(statuses(a, 'correlation-csp-unsafe-inline-usage')).not.toContain('warning');
  });

  it('does not warn when there are no inline scripts', async () => {
    const a = await one(
      `<html><head>${CSP_META("script-src 'self' 'unsafe-inline'")}</head><body></body></html>`
    );
    expect(statuses(a, 'correlation-csp-unsafe-inline-usage')).not.toContain('warning');
  });

  it('cannot be verified when no CSP is visible and headers are unreadable', async () => {
    const a = await one(`<html><body>${inline}</body></html>`);
    expect(statuses(a, 'correlation-csp-unsafe-inline-usage')).toContain('unable-to-verify');
  });
});

describe('correlation D: CSP unsafe-eval with eval indicators', () => {
  it('warns when unsafe-eval is allowed and eval is used inline', async () => {
    const a = await one(
      `<html><head>${CSP_META("script-src 'self' 'unsafe-eval'")}</head><body><script>eval(x)</script></body></html>`
    );
    expect(statuses(a, 'correlation-csp-unsafe-eval-usage')).toContain('warning');
  });

  it('does not warn when the policy has no unsafe-eval', async () => {
    const a = await one(
      `<html><head>${CSP_META("script-src 'self'")}</head><body><script>eval(x)</script></body></html>`
    );
    expect(statuses(a, 'correlation-csp-unsafe-eval-usage')).not.toContain('warning');
  });
});

describe('correlation E: external script without SRI', () => {
  it('flags a third-party script with no integrity attribute', async () => {
    const a = await one(
      '<html><body><script src="https://cdn.lib-host.net/lib.js"></script></body></html>'
    );
    expect(statuses(a, 'correlation-external-script-sri')).toContain('warning');
  });

  it('does not flag a script that has integrity', async () => {
    const a = await one(
      '<html><body><script src="https://cdn.lib-host.net/lib.js" integrity="sha384-abc" crossorigin="anonymous"></script></body></html>'
    );
    expect(statuses(a, 'correlation-external-script-sri')).not.toContain('warning');
  });

  it('does not flag a same-site subdomain as third-party', async () => {
    const a = await one('<html><body><script src="https://static.example.com/a.js"></script></body></html>');
    expect(statuses(a, 'correlation-external-script-sri')).not.toContain('warning');
  });
});

describe('correlation F: iframe sandbox', () => {
  it('reports a cross-origin iframe without sandbox as a hardening recommendation', async () => {
    const a = await one('<html><body><iframe src="https://widgets.other.net/x"></iframe></body></html>');
    const finding = forCheck(a, 'correlation-iframe-sandbox').find((f) => f.status !== 'pass' && f.status !== 'na');

    expect(finding).toBeDefined();
    expect(['informational', 'low', 'medium']).toContain(finding?.severity);
  });

  it('is clean when the iframe is sandboxed', async () => {
    const a = await one(
      '<html><body><iframe src="https://widgets.other.net/x" sandbox="allow-scripts"></iframe></body></html>'
    );
    const open = forCheck(a, 'correlation-iframe-sandbox').filter(
      (f) => f.status === 'warning' || f.status === 'potential-concern'
    );
    expect(open).toHaveLength(0);
  });
});

describe('correlation G: target=_blank without noopener', () => {
  it('flags an external target=_blank link with no rel', async () => {
    const a = await one(
      '<html><body><a href="https://other.net/" target="_blank">x</a></body></html>'
    );
    expect(statuses(a, 'correlation-target-blank-noopener').some((s) => s !== 'pass' && s !== 'na')).toBe(
      true
    );
  });

  it('accepts rel=noopener', async () => {
    const a = await one(
      '<html><body><a href="https://other.net/" target="_blank" rel="noopener noreferrer">x</a></body></html>'
    );
    expect(statuses(a, 'correlation-target-blank-noopener')).not.toContain('warning');
  });
});

describe('correlation H: auth indicators with browser storage', () => {
  const login = '<form action="/login" method="post"><input type="password" name="p"></form>';

  it('warns, as a contextual concern, when a sign-in page uses localStorage', async () => {
    const a = await one(
      `<html><body>${login}<script>localStorage.setItem("k", v)</script></body></html>`
    );
    const finding = forCheck(a, 'correlation-auth-browser-storage').find((f) => f.status === 'warning');

    expect(finding).toBeDefined();
    expect(finding?.confidence).not.toBe('high');
  });

  it('does not fire without an auth form', async () => {
    const a = await one('<html><body><script>localStorage.setItem("k", v)</script></body></html>');
    expect(statuses(a, 'correlation-auth-browser-storage')).not.toContain('warning');
  });

  it('does not store the stored key or value', async () => {
    const a = await one(
      `<html><body>${login}<script>localStorage.setItem("session_token_xyz", "valueABC")</script></body></html>`
    );
    const text = JSON.stringify(a);
    expect(text).not.toContain('session_token_xyz');
    expect(text).not.toContain('valueABC');
  });
});

describe('correlations: scoring and dimensions', () => {
  it('keeps informational correlations out of the score', async () => {
    const a = await one('<html><body><iframe src="https://widgets.other.net/x"></iframe></body></html>');
    const finding = forCheck(a, 'correlation-iframe-sandbox')[0];

    expect(finding).toBeDefined();
    expect(a.score.scoredChecks).not.toContain('correlation-iframe-sandbox');
  });

  it('assigns correlations to technical security by default', () => {
    expect(dimensionOf('correlation-http-script')).toBe('technical-security');
    expect(dimensionOf('hsts')).toBe('security-hygiene');
  });
});

describe('aggregation across pages', () => {
  const blank = '<a href="https://other.net/" target="_blank">x</a>';

  it('collapses the same finding on many pages into one card with page counts', async () => {
    const a = await assessSite([
      { path: '/', html: `<html><body><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>${blank}</body></html>` },
      { path: '/a', html: `<html><body>${blank}</body></html>` },
      { path: '/b', html: `<html><body>${blank}</body></html>` },
      { path: '/c', html: '<html><body>clean</body></html>' }
    ]);
    const cards = forCheck(a, 'correlation-target-blank-noopener').filter(
      (f) => f.status !== 'pass' && f.status !== 'na'
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].affectedPageCount).toBe(3);
    expect(cards[0].analyzedPageCount).toBe(4);
    expect(cards[0].affectedPages).toHaveLength(3);
    expect(cards[0].confidenceRationale).toBeTruthy();
  });

  it('produces stable finding ids across runs', async () => {
    const html = `<html><body>${blank}</body></html>`;
    const first = await one(html);
    const second = await one(html);

    expect(first.findings.map((f) => f.id)).toEqual(second.findings.map((f) => f.id));
  });
});
