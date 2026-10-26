import { describe, expect, it } from 'vitest';
import { REGISTERED_TOOLS, TOOL_CATEGORIES, getToolBySlug } from '../src/tools/registry';
import {
  getAllIndexablePaths,
  getCategoryPageSeo,
  getHomePageSeo,
  getSeoForPath,
  getToolPageSeo,
  NOT_FOUND_SEO
} from '../src/seo/pages';
import { buildSeoHead } from '../src/seo/head';
import { absoluteUrl, normalizePath, SITE_URL } from '../src/seo/config';

const EXPECTED_SLUGS = [
  'jwt-decoder',
  'hash-generator',
  'jwt-generator',
  'csp-generator',
  'security-headers',
  'password-strength',
  'base64',
  'url-encoder',
  'json-formatter',
  'json-to-typescript',
  'uuid-generator',
  'timestamp-converter',
  'regex-tester',
  'cron-generator',
  'llm-token-calculator'
];

describe('tool registry SEO metadata', () => {
  it('registers exactly the 15 expected tools with unique slugs', () => {
    expect(REGISTERED_TOOLS).toHaveLength(15);
    expect(REGISTERED_TOOLS.map((tool) => tool.slug).sort()).toEqual([...EXPECTED_SLUGS].sort());
    expect(new Set(REGISTERED_TOOLS.map((tool) => tool.slug)).size).toBe(15);
  });

  it('has a unique title and description per tool', () => {
    const titles = REGISTERED_TOOLS.map((tool) => tool.seo.title.trim().toLowerCase());
    const descriptions = REGISTERED_TOOLS.map((tool) => tool.seo.description.trim().toLowerCase());

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('uses a self-referencing canonical path that matches the slug', () => {
    for (const tool of REGISTERED_TOOLS) {
      expect(tool.seo.canonicalPath).toBe(`/${tool.slug}`);
      expect(normalizePath(tool.seo.canonicalPath)).toBe(tool.seo.canonicalPath);
    }
  });

  it('has descriptive titles and useful meta description lengths', () => {
    for (const tool of REGISTERED_TOOLS) {
      expect(tool.seo.title.length).toBeGreaterThan(15);
      expect(tool.seo.title.length).toBeLessThanOrEqual(80);
      expect(tool.seo.description.length).toBeGreaterThanOrEqual(80);
      expect(tool.seo.description.length).toBeLessThanOrEqual(180);
      expect(tool.seo.description).toMatch(/browser|local|without|private/i);
    }
  });

  it('only links to real related tools and never to itself', () => {
    for (const tool of REGISTERED_TOOLS) {
      const related = tool.relatedTools || [];
      expect(related.length).toBeGreaterThanOrEqual(2);
      expect(related.length).toBeLessThanOrEqual(4);
      expect(related).not.toContain(tool.id);

      for (const id of related) {
        expect(getToolBySlug(id), `${tool.slug} links to missing tool ${id}`).toBeDefined();
      }
    }
  });

  it('provides substantive educational content and FAQ answers', () => {
    for (const tool of REGISTERED_TOOLS) {
      const content = tool.educationalContent;
      expect(content, `${tool.slug} is missing educational content`).toBeDefined();
      expect(content!.content.length).toBeGreaterThanOrEqual(4);
      expect(content!.faqs?.length || 0).toBeGreaterThanOrEqual(3);

      for (const section of content!.content) {
        expect(section.heading.length).toBeGreaterThan(8);
        expect(section.body.length).toBeGreaterThan(80);
      }

      for (const faq of content!.faqs || []) {
        expect(faq.question.endsWith('?')).toBe(true);
        expect(faq.answer.length).toBeGreaterThan(50);
      }
    }
  });
});

describe('page SEO definitions', () => {
  it('includes the home page, five categories, and all 15 tools exactly once', () => {
    const paths = getAllIndexablePaths();
    expect(paths).toHaveLength(21);
    expect(new Set(paths).size).toBe(21);
    expect(paths).toContain('/');
    expect(paths).toContain('/security');
    expect(paths).toContain('/encoding');
    expect(paths).toContain('/data');
    expect(paths).toContain('/developer');
    expect(paths).toContain('/ai');

    for (const tool of REGISTERED_TOOLS) {
      expect(paths).toContain(`/${tool.slug}`);
    }
  });

  it('builds useful breadcrumbs for tool pages', () => {
    for (const tool of REGISTERED_TOOLS) {
      const seo = getToolPageSeo(tool);
      expect(seo.breadcrumbs?.length).toBe(3);
      expect(seo.breadcrumbs?.[0].path).toBe('/');
      expect(seo.breadcrumbs?.[1].path).toBe(`/${tool.category}`);
      expect(seo.breadcrumbs?.[2].path).toBe(`/${tool.slug}`);
      expect(seo.breadcrumbs?.[2].name).toBe(tool.name);
    }
  });

  it('builds meaningful category pages with item lists and FAQs', () => {
    for (const category of TOOL_CATEGORIES) {
      const seo = getCategoryPageSeo(category);
      expect(seo.kind).toBe('category');
      expect(seo.items?.length).toBe(category.id === 'ai' ? 1 : seo.items?.length);
      expect(seo.items?.length).toBeGreaterThan(0);
      expect(seo.faqs?.length).toBeGreaterThanOrEqual(2);
      expect(seo.description.length).toBeGreaterThan(80);
    }
  });

  it('resolves known paths and returns a noindex 404 definition otherwise', () => {
    expect(getSeoForPath('/').kind).toBe('home');
    expect(getSeoForPath('/security').kind).toBe('category');
    expect(getSeoForPath('/jwt-decoder').kind).toBe('tool');
    expect(getSeoForPath('/not-a-real-tool')).toEqual(NOT_FOUND_SEO);
    expect(getSeoForPath('/not-a-real-tool').indexable).toBe(false);
  });
});

describe('head tag generation', () => {
  it('emits an absolute self-canonical and indexable robots directive', () => {
    const seo = getHomePageSeo();
    const head = buildSeoHead(seo);

    expect(head.canonical).toBe(`${SITE_URL}/`);
    expect(head.robots).toBe('index, follow');
    expect(head.ogUrl).toBe(head.canonical);
    expect(head.ogImage.startsWith('https://')).toBe(true);
  });

  it('keeps canonical URLs clean even when given query strings or trailing slashes', () => {
    expect(normalizePath('/jwt-decoder/?utm_source=test#x')).toBe('/jwt-decoder');
    expect(normalizePath('jwt-decoder')).toBe('/jwt-decoder');
    expect(absoluteUrl('/jwt-decoder?x=1')).toBe(`${SITE_URL}/jwt-decoder`);
  });

  it('produces truthful structured data without ratings or reviews', () => {
    for (const tool of REGISTERED_TOOLS) {
      const head = buildSeoHead(getToolPageSeo(tool));
      const serialized = JSON.stringify(head.structuredData);

      expect(serialized).toContain('WebApplication');
      expect(serialized).toContain('BreadcrumbList');
      expect(serialized).toContain('FAQPage');
      expect(serialized).not.toContain('aggregateRating');
      expect(serialized).not.toContain('"@type":"Review"');
      expect(serialized).not.toContain('ratingValue');
    }
  });

  it('uses noindex for the 404 page and when a preview build requests it', () => {
    expect(buildSeoHead(NOT_FOUND_SEO).robots).toBe('noindex, nofollow');
    expect(buildSeoHead(getHomePageSeo(), { indexable: false }).robots).toBe('noindex, nofollow');
  });

  it('emits WebSite, CollectionPage, breadcrumb, and FAQ schema for the right page kinds', () => {
    const home = JSON.stringify(buildSeoHead(getHomePageSeo()).structuredData);
    expect(home).toContain('WebSite');

    const category = JSON.stringify(buildSeoHead(getCategoryPageSeo(TOOL_CATEGORIES[0])).structuredData);
    expect(category).toContain('CollectionPage');
    expect(category).toContain('ItemList');
    expect(category).toContain('BreadcrumbList');
  });
});
