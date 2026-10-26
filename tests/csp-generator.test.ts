import { describe, it, expect } from 'vitest';
import { buildCspPolicy } from '../src/tools/csp-generator/logic/cspBuilder';

describe('buildCspPolicy', () => {
  it('generates a correct header string with directives', () => {
    const result = buildCspPolicy({
      'default-src': ["'self'"],
      'script-src': ["'self'"]
    });
    expect(result.headerValue).toContain("default-src 'self'");
    expect(result.headerValue).toContain("script-src 'self'");
    expect(result.rawHeader).toContain('Content-Security-Policy:');
  });

  it("default-src 'self' appears in output", () => {
    const result = buildCspPolicy({ 'default-src': ["'self'"] });
    expect(result.headerValue).toContain("default-src 'self'");
  });

  it("unsafe-inline in script-src triggers a high-severity security warning", () => {
    const result = buildCspPolicy({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'object-src': ["'none'"]
    });
    const unsafeWarning = result.warnings.find(w => w.source === "'unsafe-inline'" && w.severity === 'high');
    expect(unsafeWarning).toBeDefined();
  });

  it('empty values are excluded from the output', () => {
    const result = buildCspPolicy({
      'default-src': ["'self'"],
      'script-src': [],
      'object-src': ["'none'"]
    });
    expect(result.headerValue).not.toContain('script-src');
  });

  it('metaHtml output contains meta http-equiv tag', () => {
    const result = buildCspPolicy({ 'default-src': ["'self'"], 'object-src': ["'none'"] });
    expect(result.metaHtml).toContain('<meta http-equiv="Content-Security-Policy"');
  });

  it('nginxConfig output contains add_header directive', () => {
    const result = buildCspPolicy({ 'default-src': ["'self'"], 'object-src': ["'none'"] });
    expect(result.nginxConfig).toContain('add_header Content-Security-Policy');
  });

  it('missing object-src generates a warning', () => {
    const result = buildCspPolicy({ 'default-src': ["'self'"] });
    const warning = result.warnings.find(w => w.directive === 'object-src');
    expect(warning).toBeDefined();
  });

  it('wildcard * in non-img-src directive triggers medium warning', () => {
    const result = buildCspPolicy({
      'default-src': ['*'],
      'object-src': ["'none'"]
    });
    const wildcardWarning = result.warnings.find(w => w.source === '*');
    expect(wildcardWarning).toBeDefined();
    expect(wildcardWarning!.severity).toBe('medium');
  });

  it('directives are joined by semicolon in header value', () => {
    const result = buildCspPolicy({
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'object-src': ["'none'"]
    });
    expect(result.headerValue).toContain(';');
  });
});
