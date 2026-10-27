import { describe, expect, it } from 'vitest';
import {
  hostOf,
  isLoopbackHost,
  isNavigableProtocol,
  isSameOrigin,
  looksLikeBinaryResource,
  normalizeUrl,
  parseUrl,
  parseUserSuppliedUrl,
  pathExtension,
  urlDedupeKey,
  MAX_URL_LENGTH
} from '../src/tools/website-posture/logic/url';
import { createTarget, parseTarget } from '../src/tools/website-posture/logic/target';

describe('website posture: url normalization', () => {
  it('lowercases scheme and host, drops the default port, fragment, and trailing slash', () => {
    expect(normalizeUrl('HTTPS://Example.COM:443/Path/')).toBe('https://example.com/Path');
    expect(normalizeUrl('http://example.com:80/')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com/a#section')).toBe('https://example.com/a');
  });

  it('keeps a non-default port and the query string', () => {
    expect(normalizeUrl('https://example.com:8443/a?b=1')).toBe('https://example.com:8443/a?b=1');
  });

  it('preserves path case because servers may be case-sensitive', () => {
    expect(normalizeUrl('https://example.com/CaseSensitive')).toBe(
      'https://example.com/CaseSensitive'
    );
  });

  it('returns null rather than throwing on unusable input', () => {
    expect(normalizeUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
    expect(parseUrl(`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`)).toBeNull();
    // Non-string input can reach here from malformed markup.
    expect(parseUrl(undefined as unknown as string)).toBeNull();
  });

  it('resolves a relative reference against a base', () => {
    expect(normalizeUrl('/b', 'https://example.com/a/c')).toBe('https://example.com/b');
    expect(normalizeUrl('../x', 'https://example.com/a/b/c')).toBe('https://example.com/a/x');
  });
});

describe('website posture: user-supplied URLs', () => {
  it('defaults a bare hostname to https', () => {
    expect(parseUserSuppliedUrl('example.com')?.href).toBe('https://example.com/');
    expect(parseUserSuppliedUrl('example.com/login')?.protocol).toBe('https:');
  });

  it('respects an explicit http scheme', () => {
    expect(parseUserSuppliedUrl('http://example.com')?.protocol).toBe('http:');
  });

  it('does not prepend https to something that already names a scheme', () => {
    // `parseTarget` is what rejects a non-http scheme; this layer must not
    // silently rewrite `custom:foo` into `https://custom:foo`.
    expect(parseUserSuppliedUrl('customscheme:thing')?.protocol).toBe('customscheme:');
    expect(parseUserSuppliedUrl('mailto')?.protocol).toBe('https:');
  });

  it('returns null for blank input', () => {
    expect(parseUserSuppliedUrl('   ')).toBeNull();
    expect(parseUserSuppliedUrl('')).toBeNull();
  });
});

describe('website posture: origin comparison', () => {
  it('requires scheme, host, and port to match', () => {
    expect(isSameOrigin('https://example.com/a', 'https://example.com/b')).toBe(true);
    expect(isSameOrigin('https://example.com', 'http://example.com')).toBe(false);
    expect(isSameOrigin('https://example.com', 'https://www.example.com')).toBe(false);
    expect(isSameOrigin('https://example.com', 'https://example.com:8443')).toBe(false);
  });

  it('treats the default port as equal to no port', () => {
    expect(isSameOrigin('https://example.com:443/a', 'https://example.com/b')).toBe(true);
  });

  it('never reports a non-navigable scheme as same-origin', () => {
    expect(isSameOrigin('mailto:a@example.com', 'https://example.com')).toBe(false);
    expect(isSameOrigin('javascript:void(0)', 'https://example.com')).toBe(false);
  });

  it('recognizes loopback hosts as secure contexts', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('app.localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('127.5.5.5')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('127.0.0.1.example.com')).toBe(false);
  });

  it('classifies navigable protocols', () => {
    expect(isNavigableProtocol('https:')).toBe(true);
    expect(isNavigableProtocol('HTTP:')).toBe(true);
    expect(isNavigableProtocol('mailto:')).toBe(false);
  });

  it('extracts a host for third-party grouping', () => {
    expect(hostOf('https://CDN.Example.com/a.js')).toBe('cdn.example.com');
    expect(hostOf('garbage')).toBeNull();
  });
});

describe('website posture: deduplication keys', () => {
  it('collapses reordered query parameters onto one key', () => {
    expect(urlDedupeKey('https://example.com/a?b=2&a=1')).toBe(
      urlDedupeKey('https://example.com/a?a=1&b=2')
    );
  });

  it('strips utm and other tracking parameters', () => {
    expect(urlDedupeKey('https://example.com/a?utm_source=x&id=7')).toBe(
      urlDedupeKey('https://example.com/a?id=7')
    );
    expect(urlDedupeKey('https://example.com/a?fbclid=x')).toBe(
      urlDedupeKey('https://example.com/a')
    );
  });

  it('keeps genuinely different pages distinct', () => {
    expect(urlDedupeKey('https://example.com/a?id=1')).not.toBe(
      urlDedupeKey('https://example.com/a?id=2')
    );
    expect(urlDedupeKey('https://example.com/a')).not.toBe(urlDedupeKey('https://example.com/b'));
  });

  it('ignores the fragment, so one page is never fetched twice', () => {
    expect(urlDedupeKey('https://example.com/a#one')).toBe(urlDedupeKey('https://example.com/a#two'));
  });

  it('returns null for input it cannot parse', () => {
    expect(urlDedupeKey('::::')).toBeNull();
  });
});

describe('website posture: binary resource detection', () => {
  it('skips downloads, media, and code bundles', () => {
    for (const path of ['/a.pdf', '/a.zip', '/a.png', '/a.woff2', '/bundle.js', '/s.css', '/d.json']) {
      expect(looksLikeBinaryResource(new URL(`https://example.com${path}`)), path).toBe(true);
    }
  });

  it('treats extensionless and page-like paths as navigable', () => {
    for (const path of ['/', '/about', '/blog/post-1', '/index.html', '/a.php', '/x.aspx']) {
      expect(looksLikeBinaryResource(new URL(`https://example.com${path}`)), path).toBe(false);
    }
  });

  it('reads the extension from the last path segment only', () => {
    expect(pathExtension(new URL('https://example.com/a.pdf/view'))).toBeNull();
    expect(pathExtension(new URL('https://example.com/a.tar.gz'))).toBe('gz');
    expect(pathExtension(new URL('https://example.com/.hidden'))).toBeNull();
    expect(pathExtension(new URL('https://example.com/trailing.'))).toBeNull();
  });
});

describe('website posture: target parsing', () => {
  it('normalizes a valid target', () => {
    const result = parseTarget('  HTTPS://Example.com:443/Login/  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.target.url).toBe('https://example.com/Login');
    expect(result.target.origin).toBe('https://example.com');
    expect(result.target.hostname).toBe('example.com');
    expect(result.target.protocol).toBe('https:');
    expect(result.target.port).toBe('');
    expect(result.target.pathname).toBe('/Login');
    expect(result.target.isSecureContext).toBe(true);
    expect(result.target.isLoopback).toBe(false);
  });

  it('accepts a bare hostname as https', () => {
    const result = parseTarget('example.com');
    expect(result.ok && result.target.url).toBe('https://example.com/');
  });

  it('treats http on loopback as a secure context', () => {
    const result = parseTarget('http://localhost:5173');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.target.isLoopback).toBe(true);
    expect(result.target.isSecureContext).toBe(true);
    expect(result.target.port).toBe('5173');
  });

  it('rejects empty input and non-http schemes with a readable message', () => {
    const empty = parseTarget('   ');
    expect(empty.ok).toBe(false);
    expect(empty.ok === false && empty.error).toMatch(/Enter a website URL/i);

    const ftp = parseTarget('ftp://example.com');
    expect(ftp.ok).toBe(false);
    expect(ftp.ok === false && ftp.error).toMatch(/only http/i);

    const mailto = parseTarget('mailto:a@example.com');
    expect(mailto.ok).toBe(false);
  });

  it('builds the same target from a pre-parsed URL', () => {
    const target = createTarget(new URL('http://127.0.0.1:8080/x/'));
    expect(target.isLoopback).toBe(true);
    expect(target.url).toBe('http://127.0.0.1:8080/x');
    expect(target.pathname).toBe('/x');
  });
});
