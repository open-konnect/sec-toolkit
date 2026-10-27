import { describe, expect, it } from 'vitest';
import { parseHeaderBlock } from '../src/tools/website-posture/logic/headerInput';
import { createStaticFetcher } from '../src/tools/website-posture/logic/fetchers/staticFetcher';
import { createBrowserPassiveRunner } from '../src/tools/website-posture/logic/runners/browserPassiveRunner';
import { parseTarget } from '../src/tools/website-posture/logic/target';

describe('parseHeaderBlock', () => {
  it('keeps allowlisted headers, lowercases names, drops cookies and auth', () => {
    const out = parseHeaderBlock(
      'HTTP/2 200\r\nContent-Security-Policy: default-src \'self\'\r\nSet-Cookie: sid=SECRET\r\nAuthorization: Bearer X\r\nStrict-Transport-Security: max-age=1\r\nX-Junk: 1'
    );
    expect(out).toEqual({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=1'
    });
  });
  it('combines repeated headers and folded lines', () => {
    const out = parseHeaderBlock('content-security-policy: a\ncontent-security-policy: b\nreferrer-policy: no-referrer,\n  origin');
    expect(out['content-security-policy']).toBe('a, b');
    expect(out['referrer-policy']).toBe('no-referrer, origin');
  });
});

describe('pasted headers enable header checks', () => {
  it('turns header checks from unable-to-verify into verdicts', async () => {
    const parsed = parseTarget('https://example.com/');
    if (!parsed.ok) throw new Error(parsed.error);
    const run = (headers?: Record<string, string>) =>
      createBrowserPassiveRunner({
        fetcher: createStaticFetcher([
          { url: 'https://example.com/', html: '<html><body>x</body></html>', ...(headers ? { headers, headersAreComplete: true } : {}) }
        ])
      }).run({ target: parsed.target });
    const without = await run();
    const withHeaders = await run(parseHeaderBlock('strict-transport-security: max-age=31536000'));
    expect(withHeaders.checksUnableToVerify.length).toBeLessThan(without.checksUnableToVerify.length);
    expect(withHeaders.findings.some((f) => f.checkId.includes('hsts') && f.status === 'pass')).toBe(true);
  });
});
