import { CategoryInfo, FaqItem, ToolCategory, ToolDefinition } from '../types';
import { REGISTERED_TOOLS, TOOL_CATEGORIES, getToolBySlug } from '../tools/registry';
import {
  SITE_DESCRIPTION,
  SITE_HOME_TITLE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  normalizePath
} from './config';

export type PageKind = 'home' | 'tool' | 'category' | 'notfound';

export interface SeoBreadcrumb {
  name: string;
  path: string;
}

export interface SeoListItem {
  name: string;
  path: string;
  description?: string;
}

export interface PageSeo {
  kind: PageKind;
  /** Page title without the site-name suffix. */
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
  breadcrumbs?: SeoBreadcrumb[];
  faqs?: FaqItem[];
  items?: SeoListItem[];
}

export function getCategory(category: ToolCategory): CategoryInfo | undefined {
  return TOOL_CATEGORIES.find((item) => item.id === category);
}

export function getCategoryPath(category: ToolCategory): string {
  return `/${category}`;
}

export function getToolPageSeo(tool: ToolDefinition): PageSeo {
  const path = normalizePath(tool.seo.canonicalPath || `/${tool.slug}`);
  const category = getCategory(tool.category);
  const breadcrumbs: SeoBreadcrumb[] = [
    { name: 'Home', path: '/' },
    { name: category?.name || tool.category, path: getCategoryPath(tool.category) },
    { name: tool.name, path }
  ];

  return {
    kind: 'tool',
    title: tool.seo.title,
    description: tool.seo.description,
    path,
    breadcrumbs,
    faqs: tool.educationalContent?.faqs,
    items: undefined
  };
}

export function getHomePageSeo(): PageSeo {
  return {
    kind: 'home',
    title: SITE_HOME_TITLE,
    description: SITE_DESCRIPTION,
    path: '/'
  };
}

export function getCategoryPageSeo(category: CategoryInfo): PageSeo {
  const path = getCategoryPath(category.id);
  const tools = REGISTERED_TOOLS.filter((tool) => tool.category === category.id);

  return {
    kind: 'category',
    title: category.seoTitle,
    description: category.seoDescription,
    path,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: category.name, path }
    ],
    faqs: category.educationalContent.faqs,
    items: tools.map((tool) => ({
      name: tool.name,
      path: `/${tool.slug}`,
      description: tool.shortDescription
    }))
  };
}

export const NOT_FOUND_SEO: PageSeo = {
  kind: 'notfound',
  title: 'Page Not Found',
  description: 'The requested tool or page could not be found in the Developer Security Toolkit.',
  path: '/404',
  indexable: false
};

/**
 * Single source of truth for every indexable URL.
 * Used by the sitemap generator, build-time prerendering, and tests.
 */
export function getAllIndexablePaths(): string[] {
  return [
    '/',
    ...TOOL_CATEGORIES.map((category) => getCategoryPath(category.id)),
    ...REGISTERED_TOOLS.map((tool) => normalizePath(tool.seo.canonicalPath || `/${tool.slug}`))
  ];
}

export function getPrerenderPages(): PageSeo[] {
  return [
    getHomePageSeo(),
    ...TOOL_CATEGORIES.map((category) => getCategoryPageSeo(category)),
    ...REGISTERED_TOOLS.map((tool) => getToolPageSeo(tool))
  ];
}

export function getSeoForPath(path: string): PageSeo {
  const normalized = normalizePath(path);

  if (normalized === '/') return getHomePageSeo();

  const category = TOOL_CATEGORIES.find((item) => getCategoryPath(item.id) === normalized);
  if (category) return getCategoryPageSeo(category);

  const tool = getToolBySlug(normalized);
  if (tool) return getToolPageSeo(tool);

  return NOT_FOUND_SEO;
}

export const SITEMAP_PATHS = getAllIndexablePaths();
export const SITEMAP_ORIGIN = SITE_URL;
export const SITEMAP_SITE_NAME = SITE_NAME;
export const SITEMAP_HOME_URL = absoluteUrl('/');
