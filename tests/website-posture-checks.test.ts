import { describe, expect, it } from 'vitest';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';
import {
  parseRobotsTxt,
  parseSecurityTxt,
  parseSitemap
} from '../src/tools/website-posture/logic/analysis/wellKnown';
import { CHECK_REGISTRY } from '../src/tools/website-posture/logic/checkRegistry';
import { SecurityAssessment } from '../src/tools/website-posture/types';

const NOW = new Date('2026-01-01T00:00:00Z');

async function assess(
  url: string,
  html: string,
  extra: {
    headers?: Record<string, string>;
    wellKnown?: Record<string, { status?: number; body?: string }>;
  } = {}
): Promise<SecurityAssessment> {
  const parsed = parseTarget(url);
  if (!parsed.ok) throw new Error(parsed.error);
  const fetcher = createStaticFetcher(
    [
      {
        url,
        html,
        headers: extra.headers,
        headersAreComplete: extra.headers !== undefined
      }
    ],
    { wellKnown: extra.wellKnown }
  );
  const runner = createBrowserPassiveRunner({ fetcher, now: () => NOW });
  return runner.run({ target: parsed.target, discovery: { maxPages: 1 } });
}

const byCheck = (a: SecurityAssessment, id: string) => a.findings.filter((f) => f.checkId === id);
const keys = (a: SecurityAssessment, id: string) =>
  byCheck(a, id).map((f) => `${f.status}:${f.aggregationKey}`);

describe('check registry', () => {
  it('has unique ids', () => {
    const ids = CHECK_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('website posture checks: unable-to-verify', () => {
  it('never reports a missing header when headers are not readable', async () => {
    const a = await assess('https://example.com/', '<html><body>hi</body></html>');
    expect(a.checksUnableToVerify).toContain('hsts');
    expect(keys(a, 'hsts').every((k) => k.startsWith('unable-to-verify'))).toBe(true);
    const text = JSON.stringify(byCheck(a, 'hsts'));
    expect(text).not.toMatch(/header (is )?missing/i);
    expect(a.score.value === null || typeof a.score.value === 'number').toBe(true);
  });

  it('reports http-to-https upgrade as unverifiable for https targets', async () => {
    const a = await assess('https://example.com/', '<html></html>');
    expect(keys(a, 'http-to-https-upgrade')).toEqual(['unable-to-verify:https-target']);
  });
});

describe('website posture checks: headers', () => {
  it('flags a missing HSTS and passes a strong one', async () => {
    const weak = await assess('https://example.com/', '<html></html>', { headers: {} });
    expect(keys(weak, 'hsts').some((k) => k.startsWith('warning') || k.startsWith('fail'))).toBe(true);

    const strong = await assess('https://example.com/', '<html></html>', {
      headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }
    });
    expect(keys(strong, 'hsts')).toEqual(['pass:pass']);
  });

  it('treats wildcard CORS with credentials as a concern', async () => {
    const a = await assess('https://example.com/', '<html></html>', {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true'
      }
    });
    expect(byCheck(a, 'cors-allow-origin').some((f) => f.status === 'warning')).toBe(true);
  });
});

describe('website posture checks: CSP', () => {
  it('distinguishes wildcard and insecure sources', async () => {
    const a = await assess('https://example.com/', '<html></html>', {
      headers: {
        'content-security-policy': "default-src 'self'; script-src * http://cdn.example.org"
      }
    });
    const k = keys(a, 'csp-broad-sources');
    expect(k).toContain('warning:wildcard');
    expect(k).toContain('warning:insecure-source');
  });

  it('reports report-only policies as not enforcing', async () => {
    const a = await assess('https://example.com/', '<html></html>', {
      headers: { 'content-security-policy-report-only': "default-src 'self'" }
    });
    expect(byCheck(a, 'csp-report-only').some((f) => f.status === 'warning')).toBe(true);
  });
});

describe('website posture checks: transport and forms', () => {
  it('flags mixed content and a password form posting to http', async () => {
    const a = await assess(
      'https://example.com/',
      `<html><body>
        <script src="http://cdn.example.org/a.js"></script>
        <img src="http://cdn.example.org/a.png">
        <form action="http://example.com/login" method="post">
          <input type="text" name="user"><input type="password" name="pw" value="hunter2hunter2">
        </form></body></html>`
    );
    expect(keys(a, 'mixed-content')).toEqual(expect.arrayContaining(['fail:active', 'warning:passive']));
    expect(keys(a, 'password-form-http')).toContain('fail:http-action');
    expect(JSON.stringify(a.findings)).not.toContain('hunter2');
  });

  it('flags sensitive GET forms and cross-origin actions', async () => {
    const a = await assess(
      'https://example.com/',
      `<form method="get" action="https://pay.example.net/checkout">
         <input name="cardnumber" autocomplete="off"><input name="cvv"></form>`
    );
    expect(keys(a, 'form-observations')).toEqual(
      expect.arrayContaining(['warning:get-method', 'info:autocomplete-off'])
    );
    expect(keys(a, 'sensitive-form-cross-origin-action').some((k) => k.includes('cross-origin'))).toBe(true);
  });
});

describe('website posture checks: scripts and DOM', () => {
  const html = `<html><body>
    <button onclick="go()">x</button>
    <a href="javascript:void(0)">j</a>
    <script>
      el.innerHTML = x; eval(y);
      window.addEventListener('message', function(e){ run(e.data) });
      parent.postMessage(d, '*');
      localStorage.setItem('k', v);
      navigator.serviceWorker.register('/sw.js');
      navigator.geolocation.getCurrentPosition(f);
      debugger;
    //# ${'source'}MappingURL=app.js.map
    </script></body></html>`;

  it('reports indicators as review items, never as confirmed XSS', async () => {
    const a = await assess('https://example.com/', html);
    expect(keys(a, 'dangerous-dom-api-usage')).toEqual(
      expect.arrayContaining(['warning:code-evaluation', 'info:markup-sinks'])
    );
    expect(keys(a, 'postmessage-origin-handling')).toEqual(
      expect.arrayContaining(['warning:wildcard-target', 'warning:listener-without-origin-check'])
    );
    expect(keys(a, 'inline-event-handlers')).toEqual(['info:present']);
    expect(keys(a, 'dangerous-url-schemes')).toContain('warning:javascript-url');
    expect(JSON.stringify(a.findings)).not.toMatch(/xss vulnerability found/i);
  });

  it('uses the mandated storage wording and no insecurity claim', async () => {
    const a = await assess('https://example.com/', html);
    const f = byCheck(a, 'browser-storage-usage')[0];
    expect(f.summary).toBe(
      'Browser storage is used. Avoid storing credentials, long-lived secrets, session tokens, or other sensitive information in client-accessible storage.'
    );
    expect(JSON.stringify(f)).not.toMatch(/localStorage is insecure/i);
    expect(keys(a, 'service-worker-indicators')).toContain('info:registered');
    expect(byCheck(a, 'sensitive-api-indicators')).toHaveLength(1);
    expect(keys(a, 'source-map-indicators').some((k) => k.startsWith('warning'))).toBe(true);
    expect(keys(a, 'debug-indicators').some((k) => k.startsWith('warning'))).toBe(true);
  });

  it('does not expose script source in findings', async () => {
    const a = await assess('https://example.com/', html);
    const text = JSON.stringify(a.findings);
    expect(text).not.toContain('getCurrentPosition');
    expect(text).not.toContain('app.js.map');
  });
});

describe('website posture checks: frames, links, SRI, third parties', () => {
  const html = `<html><body>
    <iframe src="http://a.example.org/x"></iframe>
    <iframe src="https://b.example.org/y" sandbox="allow-scripts allow-same-origin"></iframe>
    <iframe src="https://c.example.org/z"></iframe>
    <a href="https://ext.example.org/" target="_blank">e</a>
    <a href="https://ok.example.org/" target="_blank" rel="noopener">ok</a>
    <script src="https://cdn.jsdelivr.net/npm/x.js"></script>
    <script src="https://www.googletagmanager.com/gtm.js?id=G-1"></script>
  </body></html>`;

  it('reports iframe concerns by kind', async () => {
    const a = await assess('https://example.com/', html);
    expect(keys(a, 'iframe-security')).toEqual(
      expect.arrayContaining([
        'warning:http-source',
        'warning:sandbox-self-defeating',
        'warning:cross-origin-no-sandbox'
      ])
    );
  });

  it('flags missing noopener once and ignores the compliant link', async () => {
    const a = await assess('https://example.com/', html);
    const f = byCheck(a, 'external-link-hygiene').find((x) => x.aggregationKey === 'missing-noopener');
    expect(f?.occurrences).toBe(1);
  });

  it('does not recommend SRI for tag managers', async () => {
    const a = await assess('https://example.com/', html);
    const sri = byCheck(a, 'missing-sri').find((f) => f.status !== 'pass' && f.status !== 'not-applicable');
    expect(sri?.occurrences).toBe(1);
    expect(JSON.stringify(sri)).not.toContain('googletagmanager');
  });

  it('inventories third parties without scoring them', async () => {
    const a = await assess('https://example.com/', html);
    const f = byCheck(a, 'third-party-surface')[0];
    expect(f.status).toBe('info');
    expect(f.severity).toBe('informational');
  });
});

describe('website posture checks: authentication surface', () => {
  it('inventories login and reset forms without submitting anything', async () => {
    const a = await assess(
      'https://example.com/',
      `<form action="/session" method="post"><input name="email"><input type="password" name="password"></form>
       <a href="/oauth/authorize?client=1">sso</a>`
    );
    const f = byCheck(a, 'authentication-surface')[0];
    expect(f.status).toBe('info');
    expect(f.evidence.map((e) => e.label).join(' ')).toMatch(/sign-in/);
  });
});

describe('website posture checks: well-known files', () => {
  const origin = 'https://example.com';

  it('validates a good security.txt', async () => {
    const a = await assess(origin + '/', '<html></html>', {
      wellKnown: {
        [`${origin}/.well-known/security.txt`]: {
          body: 'Contact: mailto:sec@example.com\nExpires: 2027-01-01T00:00:00Z\n'
        },
        [`${origin}/robots.txt`]: { status: 404 },
        [`${origin}/sitemap.xml`]: { status: 404 }
      }
    });
    expect(keys(a, 'security-txt-missing')).toEqual(['pass:pass']);
  });

  it('flags an expired or malformed security.txt as incomplete, not missing', async () => {
    const a = await assess(origin + '/', '<html></html>', {
      wellKnown: {
        [`${origin}/.well-known/security.txt`]: { body: 'Contact: mailto:sec@example.com\nExpires: 2020-01-01T00:00:00Z\n' },
        [`${origin}/robots.txt`]: { status: 404 },
        [`${origin}/sitemap.xml`]: { status: 404 }
      }
    });
    expect(keys(a, 'security-txt-missing')).toEqual(['warning:expired']);
  });

  it('reports a missing security.txt only on a definitive 404', async () => {
    const a = await assess(origin + '/', '<html></html>', {
      wellKnown: { [`${origin}/.well-known/security.txt`]: { status: 404 } }
    });
    expect(keys(a, 'security-txt-missing')).toEqual(['warning:missing']);
    // robots.txt / sitemap fixtures were not supplied: that is not a 404.
    expect(keys(a, 'robots-txt').every((k) => k.startsWith('unable-to-verify'))).toBe(true);
  });

  it('describes robots.txt without calling its paths vulnerabilities', async () => {
    const a = await assess(origin + '/', '<html></html>', {
      wellKnown: {
        [`${origin}/.well-known/security.txt`]: { status: 404 },
        [`${origin}/robots.txt`]: {
          body: 'User-agent: *\nDisallow: /admin/\nDisallow: /private\nSitemap: https://example.com/sitemap.xml\n'
        },
        [`${origin}/sitemap.xml`]: {
          body: '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/admin/users</loc></url></urlset>'
        }
      }
    });
    const robots = byCheck(a, 'robots-txt');
    expect(robots.every((f) => f.status === 'info')).toBe(true);
    expect(robots.every((f) => f.severity === 'informational')).toBe(true);
    expect(JSON.stringify(robots)).toContain('not an access-control mechanism');
    expect(keys(a, 'sitemap-availability')).toEqual(
      expect.arrayContaining(['info:present', 'info:administrative-paths'])
    );
  });
});

describe('well-known parsers', () => {
  it('parses security.txt fields without retaining values', () => {
    const s = parseSecurityTxt('# c\nContact: mailto:a@b.co\nExpires: 2999-01-01T00:00:00Z\nbogus line', {
      origin: 'https://b.co',
      now: NOW
    });
    expect(s.contactUsable).toBe(true);
    expect(s.expiresValid).toBe(true);
    expect(s.expired).toBe(false);
    expect(s.malformedLines).toBe(1);
    expect(JSON.stringify(s)).not.toContain('a@b.co');
  });

  it('parses robots.txt groups and sitemaps', () => {
    const r = parseRobotsTxt('User-agent: a\nUser-agent: b\nDisallow: /x\nSitemap: /s.xml', {
      baseUrl: 'https://e.com'
    });
    expect(r.userAgentGroups).toBe(1);
    expect(r.sitemaps).toEqual(['https://e.com/s.xml']);
  });

  it('recognises non-sitemaps', () => {
    expect(parseSitemap('<html>not found</html>').wellFormed).toBe(false);
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://e.com/a.xml</loc></sitemap></sitemapindex>').format).toBe('sitemapindex');
  });
});
