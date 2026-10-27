import { describe, expect, it } from 'vitest';
import { RELAY_LIMITS, blockedReason, handleRelay } from '../worker/proxy';
import { createRelayFetcher } from '../src/tools/website-posture/logic/fetchers/relayFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';

const ORIGIN = 'https://tool.example';

function relayRequest(body: unknown, init: { origin?: string | null; method?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  return new Request(`${ORIGIN}/api/fetch`, {
    method: init.method ?? 'POST',
    headers,
    ...(init.method === 'GET' ? {} : { body: init.raw ?? JSON.stringify(body) })
  });
}

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

describe('blockedReason', () => {
  it.each([
    'http://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://10.0.0.1/', 'https://2130706433/',
    'https://0x7f.1/', 'https://intranet/', 'https://printer.local/', 'https://svc.internal/', 'https://169.254.169.254/latest',
    'ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pw@example.com/',
    'https://example.com:8080/', 'https://example.com:22/', 'not a url', `https://example.com/${'a'.repeat(3000)}`
  ])('rejects %s', (url) => {
    expect(blockedReason(url)).not.toBeNull();
  });

  it.each(['https://example.com/', 'http://example.com/a?b=1', 'https://sub.example.co.uk/x', 'https://example.com./'])(
    'accepts %s',
    (url) => expect(blockedReason(url)).toBeNull()
  );
});

describe('handleRelay', () => {
  it('returns the page, allowlisted headers only, and never Set-Cookie', async () => {
    const fetchImpl = (async () =>
      html('<html>hi</html>', {
        'strict-transport-security': 'max-age=1',
        'set-cookie': 'sid=SECRET',
        'x-internal': 'nope'
      })) as typeof fetch;
    const res = await handleRelay(relayRequest({ url: 'https://example.com/' }), fetchImpl);
    const out = await res.json();
    expect(out.ok).toBe(true);
    expect(out.body).toBe('<html>hi</html>');
    expect(out.headers).toEqual({ 'strict-transport-security': 'max-age=1', 'content-type': 'text/html; charset=utf-8' });
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('sends no cookies or caller headers upstream', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = (async (_u: string, init?: RequestInit) => {
      seen = init;
      return html('x');
    }) as typeof fetch;
    await handleRelay(relayRequest({ url: 'https://example.com/' }), fetchImpl);
    expect(seen?.method).toBe('GET');
    expect(seen?.redirect).toBe('manual');
    expect(Object.keys(seen?.headers as object).sort()).toEqual(['accept', 'user-agent']);
  });

  it('follows redirects by hand and re-validates every hop', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (u: string) => {
      calls.push(u);
      if (u === 'https://example.com/') return new Response(null, { status: 302, headers: { location: 'https://www.example.com/home' } });
      return html('landed');
    }) as typeof fetch;
    const out = await (await handleRelay(relayRequest({ url: 'https://example.com/' }), fetchImpl)).json();
    expect(calls).toEqual(['https://example.com/', 'https://www.example.com/home']);
    expect(out).toMatchObject({ ok: true, redirected: true, finalUrl: 'https://www.example.com/home' });

    for (const location of ['http://169.254.169.254/latest/meta-data', 'http://localhost:8080/', 'https://10.0.0.5/']) {
      const evil = (async () => new Response(null, { status: 301, headers: { location } })) as typeof fetch;
      const res = await handleRelay(relayRequest({ url: 'https://example.com/' }), evil);
      expect((await res.json()).error.kind).toBe('blocked-target');
    }
  });

  it('stops redirect loops', async () => {
    const fetchImpl = (async () => new Response(null, { status: 302, headers: { location: 'https://example.com/' } })) as typeof fetch;
    const out = await (await handleRelay(relayRequest({ url: 'https://example.com/' }), fetchImpl)).json();
    expect(out.error.kind).toBe('too-many-redirects');
  });

  it('caps the body and flags truncation', async () => {
    const big = 'a'.repeat(RELAY_LIMITS.maxBodyBytes + 5000);
    const out = await (await handleRelay(relayRequest({ url: 'https://example.com/' }), (async () => html(big)) as typeof fetch)).json();
    expect(out.truncated).toBe(true);
    expect(out.body.length).toBe(RELAY_LIMITS.maxBodyBytes);
  });

  it('honours maxBytes and discardBody, and never returns binary content', async () => {
    const small = await (await handleRelay(relayRequest({ url: 'https://example.com/', maxBytes: 10 }), (async () => html('0123456789ABCDEF')) as typeof fetch)).json();
    expect(small.body).toBe('0123456789');
    const discarded = await (await handleRelay(relayRequest({ url: 'https://example.com/', discardBody: true }), (async () => html('x')) as typeof fetch)).json();
    expect(discarded.body).toBeNull();
    const binary = (async () => new Response('PNG', { status: 200, headers: { 'content-type': 'image/png' } })) as typeof fetch;
    expect((await (await handleRelay(relayRequest({ url: 'https://example.com/a.png' }), binary)).json()).body).toBeNull();
  });

  it('rejects other origins, GET, malformed and oversized requests without fetching', async () => {
    let fetched = 0;
    const fetchImpl = (async () => { fetched += 1; return html('x'); }) as typeof fetch;
    expect((await handleRelay(relayRequest({ url: 'https://example.com/' }, { origin: 'https://evil.example' }), fetchImpl)).status).toBe(403);
    expect((await handleRelay(relayRequest({ url: 'https://example.com/' }, { origin: null }), fetchImpl)).status).toBe(403);
    expect((await handleRelay(relayRequest({}, { method: 'GET' }), fetchImpl)).status).toBe(405);
    expect((await handleRelay(relayRequest(null, { raw: 'not json' }), fetchImpl)).status).toBe(400);
    expect((await handleRelay(relayRequest({ url: 5 }), fetchImpl)).status).toBe(400);
    expect((await handleRelay(relayRequest(null, { raw: JSON.stringify({ url: 'https://e.com/' + 'a'.repeat(5000) }) }), fetchImpl)).status).toBe(413);
    expect((await handleRelay(relayRequest({ url: 'http://127.0.0.1/' }), fetchImpl)).status).toBe(400);
    expect(fetched).toBe(0);
  });

  it('reports network failures without leaking detail', async () => {
    const fetchImpl = (async () => { throw new Error('connect ECONNREFUSED 10.1.2.3:443'); }) as typeof fetch;
    const res = await handleRelay(relayRequest({ url: 'https://example.com/' }), fetchImpl);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('network');
    expect(text).not.toContain('10.1.2.3');
  });
});

describe('relay fetcher end to end', () => {
  it('gives header checks real verdicts for a cross-origin site', async () => {
    const upstream = (async () =>
      html('<html><head><title>t</title></head><body>hello</body></html>', {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff'
      })) as typeof fetch;
    const relayFetch = (async (_e: string, init?: RequestInit) =>
      handleRelay(new Request(`${ORIGIN}/api/fetch`, { method: 'POST', headers: { origin: ORIGIN }, body: init?.body as string }), upstream)) as typeof fetch;

    const parsed = parseTarget('https://example.com/');
    if (!parsed.ok) throw new Error(parsed.error);
    const direct = await createBrowserPassiveRunner({ fetcher: createRelayFetcher({ fetchImpl: relayFetch }) }).run({
      target: parsed.target,
      discovery: { maxPages: 1, maxDepth: 0 }
    });
    const byCheck = new Map(direct.findings.map((f) => [f.checkId, f.status]));
    expect(direct.checksUnableToVerify.length).toBeLessThanOrEqual(2);
    expect(byCheck.get('hsts')).toBe('pass');
    expect(byCheck.get('x-content-type-options')).toBe('pass');
    expect(direct.errors).toHaveLength(0);
  });

  it('maps relay failures to unverified results, not site findings', async () => {
    const fetchImpl = (async () => new Response('<html>not json', { status: 404 })) as typeof fetch;
    const result = await createRelayFetcher({ fetchImpl }).fetchPage({ url: 'https://example.com/', timeoutMs: 1000 });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/Paste page source/);
  });
});
