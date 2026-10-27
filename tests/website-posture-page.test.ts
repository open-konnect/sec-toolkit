import { describe, expect, it } from 'vitest';
import {
  createHtmlScannerExtractor,
  decodeHtmlEntities,
  scanHtml
} from '../src/tools/website-posture/logic/htmlScanner';
import {
  buildAnalyzedPage,
  countResourcesByType,
  navigableSameOriginLinks,
  resourcesOfType
} from '../src/tools/website-posture/logic/page';
import { isActiveResource, normalizeResource } from '../src/tools/website-posture/logic/resource';
import { ObservedHeaders } from '../src/tools/website-posture/types';

const NO_HEADERS: ObservedHeaders = {
  visibility: 'unsupported',
  values: {},
  reason: 'test fixture'
};

const FETCHED_AT = new Date('2026-01-01T00:00:00.000Z');

/** Builds a page from markup exactly the way discovery does. */
function analyze(html: string, url = 'https://example.com/', headers = NO_HEADERS) {
  const extractor = createHtmlScannerExtractor();
  return buildAnalyzedPage({
    snapshot: extractor.extract(html, url),
    url,
    depth: 0,
    statusCode: 200,
    contentType: 'text/html',
    headers,
    fetchedAt: FETCHED_AT
  });
}

describe('website posture: html scanner', () => {
  it('captures tags, attributes, and the title', () => {
    const result = scanHtml(
      '<!DOCTYPE html><html><head><title>  Hello </title></head><body><a href="/x" rel="nofollow">x</a></body></html>'
    );

    expect(result.title).toBe('Hello');
    const anchor = result.elements.find((element) => element.tag === 'a');
    expect(anchor?.attributes).toEqual({ href: '/x', rel: 'nofollow' });
  });

  it('lowercases tag and attribute names and decodes entities', () => {
    const result = scanHtml('<A HREF="/a?x=1&amp;y=2">link</A>');
    const anchor = result.elements.find((element) => element.tag === 'a');
    expect(anchor?.attributes.href).toBe('/a?x=1&y=2');
  });

  it('handles unquoted, single-quoted, and valueless attributes', () => {
    const result = scanHtml("<script src=/a.js defer async='async'></script>");
    const script = result.elements.find((element) => element.tag === 'script');
    expect(script?.attributes.src).toBe('/a.js');
    expect(script?.attributes.defer).toBe('');
    expect(script?.attributes.async).toBe('async');
  });

  it('never captures an input value, so field contents cannot leak', () => {
    const result = scanHtml('<input type="password" name="pw" value="hunter2">');
    const input = result.elements.find((element) => element.tag === 'input');

    expect(input?.attributes.type).toBe('password');
    expect(input?.attributes.value).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });

  it('treats script and style as raw text and is not fooled by a lookalike close tag', () => {
    const result = scanHtml(
      '<script>var a = "</scriptfoo>"; var b = 1;</script><img src="/after.png">'
    );
    const script = result.elements.find((element) => element.tag === 'script');

    expect(script?.text).toContain('var b = 1');
    // Scanning resumed after the real close tag rather than at the lookalike.
    expect(result.elements.some((element) => element.tag === 'img')).toBe(true);
  });

  it('ignores comments, doctypes, CDATA, and processing instructions', () => {
    const result = scanHtml(
      '<!-- <script src="/evil.js"></script> --><?php ?><!DOCTYPE html><img src="/ok.png">'
    );
    expect(result.elements.some((element) => element.tag === 'script')).toBe(false);
    expect(result.elements.some((element) => element.tag === 'img')).toBe(true);
  });

  it('associates fields with their own form and not an outer one', () => {
    const result = scanHtml(
      '<form action="/a"><input type="text"></form><form action="/b"><input type="password"></form>'
    );

    expect(result.formCount).toBe(2);
    const forms = result.elements.filter((element) => element.tag === 'form');
    expect(forms[0].formIndex).toBe(0);
    expect(forms[1].formIndex).toBe(1);

    const inputs = result.elements.filter((element) => element.tag === 'input');
    expect(inputs[0].formIndex).toBe(0);
    expect(inputs[1].formIndex).toBe(1);
  });

  it('terminates and reports truncation when the element cap is hit', () => {
    const result = scanHtml('<img src="/a.png">'.repeat(50), { maxElements: 10 });
    expect(result.truncated).toBe(true);
    expect(result.elements.length).toBeLessThanOrEqual(10);
  });

  it('survives malformed markup without throwing', () => {
    for (const html of ['<', '<<<>>>', '<a href=', '<div class="x', '</>', '<script>']) {
      expect(() => scanHtml(html), html).not.toThrow();
    }
  });

  it('decodes the named and numeric entities it supports', () => {
    expect(decodeHtmlEntities('a&amp;b&lt;c&gt;d&quot;e&#39;f&#x41;')).toBe('a&b<c>d"e\'fA');
    expect(decodeHtmlEntities('no entities here')).toBe('no entities here');
  });
});

describe('website posture: resource normalization', () => {
  it('resolves a relative URL and marks it same-origin', () => {
    const resource = normalizeResource(
      { element: 'script', attribute: 'src', rawUrl: '/app.js', type: 'script', attributes: {} },
      'https://example.com/page',
      'https://example.com'
    );

    expect(resource.url).toBe('https://example.com/app.js');
    expect(resource.sameOrigin).toBe(true);
    expect(resource.crossOrigin).toBe(false);
    expect(resource.resolvable).toBe(true);
  });

  it('marks a third-party URL cross-origin and records its host', () => {
    const resource = normalizeResource(
      {
        element: 'script',
        attribute: 'src',
        rawUrl: 'https://CDN.Example.net/a.js',
        type: 'script',
        attributes: { integrity: 'sha384-abc', crossorigin: 'anonymous' }
      },
      'https://example.com/',
      'https://example.com'
    );

    expect(resource.crossOrigin).toBe(true);
    expect(resource.host).toBe('cdn.example.net');
    expect(resource.integrity).toBe('sha384-abc');
    expect(resource.crossOriginAttr).toBe('anonymous');
  });

  it('never throws on an unparseable reference', () => {
    const resource = normalizeResource(
      { element: 'img', attribute: 'src', rawUrl: 'http://a b', type: 'image', attributes: {} },
      'https://example.com/',
      'https://example.com'
    );

    expect(resource.resolvable).toBe(false);
    expect(resource.url).toBeNull();
    expect(resource.sameOrigin).toBe(false);
    expect(resource.crossOrigin).toBe(false);
  });

  it('treats a data URI as neither same-origin nor cross-origin', () => {
    const resource = normalizeResource(
      {
        element: 'img',
        attribute: 'src',
        rawUrl: 'data:image/png;base64,AAAA',
        type: 'image',
        attributes: {}
      },
      'https://example.com/',
      'https://example.com'
    );

    expect(resource.isDataUri).toBe(true);
    expect(resource.sameOrigin).toBe(false);
    expect(resource.crossOrigin).toBe(false);
  });

  it('classifies which resource types are active', () => {
    const page = analyze(
      '<script src="/a.js"></script><link rel="stylesheet" href="/a.css"><img src="/a.png"><iframe src="/f"></iframe>'
    );

    const byType = (type: string) => page.resources.find((resource) => resource.type === type)!;

    expect(isActiveResource(byType('script'))).toBe(true);
    expect(isActiveResource(byType('stylesheet'))).toBe(true);
    expect(isActiveResource(byType('iframe'))).toBe(true);
    expect(isActiveResource(byType('image'))).toBe(false);
  });
});

describe('website posture: page model', () => {
  it('collects links, resources, and meta tags with absolute URLs', () => {
    const page = analyze(
      `<html><head>
         <title>Home</title>
         <meta name="generator" content="Hugo 0.1">
         <link rel="stylesheet" href="/s.css">
       </head><body>
         <a href="/about">About</a>
         <a href="https://other.example/x">Out</a>
         <a href="mailto:a@example.com">Mail</a>
         <script src="https://cdn.example.net/a.js"></script>
         <img src="pic.png">
       </body></html>`,
      'https://example.com/index.html'
    );

    expect(page.title).toBe('Home');
    expect(page.url).toBe('https://example.com/index.html');
    expect(page.origin).toBe('https://example.com');
    expect(page.protocol).toBe('https:');

    expect(page.links.map((link) => link.url)).toContain('https://example.com/about');
    expect(page.links.find((link) => link.rawHref.startsWith('mailto:'))?.isNavigable).toBe(false);
    expect(page.links.find((link) => link.url === 'https://other.example/x')?.sameOrigin).toBe(false);

    expect(navigableSameOriginLinks(page).map((link) => link.url)).toEqual([
      'https://example.com/about'
    ]);

    expect(resourcesOfType(page, 'image')[0].url).toBe('https://example.com/pic.png');
    expect(page.externalDomains).toEqual(['cdn.example.net']);
    expect(page.detectedTechnologies.find((tech) => tech.id === 'generator')?.name).toBe('Hugo 0.1');
  });

  it('honours a <base href> when resolving relative URLs', () => {
    const page = analyze(
      '<html><head><base href="https://cdn.example.net/assets/"></head><body><img src="a.png"></body></html>',
      'https://example.com/page'
    );

    expect(page.resources[0].url).toBe('https://cdn.example.net/assets/a.png');
    expect(page.observations.some((observation) => observation.id === 'base-href')).toBe(true);
  });

  it('models forms structurally and records no field values', () => {
    const page = analyze(
      `<form action="/login" method="POST" autocomplete="on">
         <input type="email" name="user" value="someone@example.com">
         <input type="password" name="pw" value="hunter2">
         <input type="file" name="doc">
         <button type="submit">Go</button>
       </form>`,
      'https://example.com/login'
    );

    expect(page.forms).toHaveLength(1);
    const form = page.forms[0];

    expect(form.action).toBe('https://example.com/login');
    expect(form.method).toBe('post');
    expect(form.actionProtocol).toBe('https:');
    expect(form.actionIsCrossOrigin).toBe(false);
    expect(form.hasPasswordField).toBe(true);
    expect(form.hasFileField).toBe(true);
    expect(form.inputTypes).toEqual(['email', 'file', 'password', 'submit']);
    expect(form.fieldCount).toBe(4);

    // The privacy guarantee: no serialized page can contain a field value.
    expect(JSON.stringify(page)).not.toContain('hunter2');
    expect(JSON.stringify(page)).not.toContain('someone@example.com');
  });

  it('treats an absent action as submitting to the page itself', () => {
    const page = analyze('<form><input type="password"></form>', 'http://example.com/login');
    expect(page.forms[0].actionIsImplicit).toBe(true);
    expect(page.forms[0].action).toBe('http://example.com/login');
    expect(page.forms[0].actionProtocol).toBe('http:');
  });

  it('flags a cross-origin form action', () => {
    const page = analyze('<form action="https://other.example/p"><input type="password"></form>');
    expect(page.forms[0].actionIsCrossOrigin).toBe(true);
  });

  it('derives indicators from inline script without retaining the script text', () => {
    const page = analyze(
      `<script>
         navigator.serviceWorker.register('/sw.js');
         localStorage.setItem('k', 'SUPER_SECRET_VALUE');
       </script>`
    );

    expect(page.inlineScriptCount).toBe(1);
    expect(page.serviceWorkerIndicators).toContain('navigator.serviceWorker');
    expect(page.storageIndicators).toContain('localStorage');
    expect(JSON.stringify(page)).not.toContain('SUPER_SECRET_VALUE');
  });

  it('records a meta-delivered CSP as an observation', () => {
    const page = analyze(
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'
    );
    expect(page.observations.some((observation) => observation.id === 'meta-csp')).toBe(true);
  });

  it('counts resources by type across pages', () => {
    const a = analyze('<script src="/a.js"></script><img src="/a.png">');
    const b = analyze('<script src="/b.js"></script>', 'https://example.com/b');

    const counts = countResourcesByType([a, b]);
    expect(counts.script).toBe(2);
    expect(counts.image).toBe(1);
    expect(counts.font).toBe(0);
  });

  it('builds a usable page even from empty markup', () => {
    const page = analyze('');
    expect(page.links).toEqual([]);
    expect(page.resources).toEqual([]);
    expect(page.forms).toEqual([]);
    expect(page.title).toBeNull();
  });
});
