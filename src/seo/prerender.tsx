import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppRoutes } from '../app/routes';
import { getPrerenderPages, NOT_FOUND_SEO, PageSeo } from './pages';
import { buildSeoHead, serializeSeoHead } from './head';
import { SITE_INDEXABLE, SITE_URL } from './config';

export interface PrerenderedPage {
  path: string;
  outputFile: string;
  headHtml: string;
  bodyHtml: string;
}

function outputFileForPath(path: string): string {
  if (path === '/') return 'index.html';
  return `${path.replace(/^\/+/, '')}.html`;
}

function renderPage(seo: PageSeo, indexable: boolean): PrerenderedPage {
  const bodyHtml = renderToString(
    <StaticRouter location={seo.path}>
      <AppRoutes />
    </StaticRouter>
  );

  return {
    path: seo.path,
    outputFile: outputFileForPath(seo.path),
    headHtml: serializeSeoHead(buildSeoHead(seo, { indexable })),
    bodyHtml
  };
}

/**
 * Renders every indexable route to static HTML plus a noindex 404 page.
 * Called from scripts/generate-seo.mjs after the client and SSR builds.
 */
export function renderAllPages(indexable = true): PrerenderedPage[] {
  const pages = getPrerenderPages().map((seo) => renderPage(seo, indexable));
  pages.push(renderPage(NOT_FOUND_SEO, false));
  return pages;
}

export function getSitemapPaths(): string[] {
  return getPrerenderPages().map((seo) => seo.path);
}

export function getSiteUrlForSitemap(): string {
  return SITE_URL;
}

/**
 * Exposes the build-time indexability flag that Vite baked into the SSR bundle.
 * The generator uses this instead of reading process.env so values from `.env`
 * files and shell environment variables behave identically.
 */
export function isIndexableBuild(): boolean {
  return SITE_INDEXABLE;
}
