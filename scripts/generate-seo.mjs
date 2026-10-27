#!/usr/bin/env node
/**
 * Generates the production SEO surface after `vite build`:
 *
 * - static HTML for every route (home, categories, all 15 tools, 404)
 * - sitemap.xml
 * - robots.txt
 * - preview noindex headers when VITE_NOINDEX=true
 *
 * Tool and category data comes from src/tools/registry.ts through the SSR
 * bundle, so titles, descriptions, and URLs are never duplicated here.
 */

import { readFile, writeFile, access, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The Cloudflare Vite plugin writes the client build to dist/client (the Worker
// that serves /api/fetch goes next to it); wrangler serves assets from there.
const distDir = path.join(root, 'dist', 'client');
const ssrDir = path.join(root, 'dist-ssr');

// `vite.ssr.config.ts` pins the entry filename to `prerender.js`. Keep the
// other extensions as a fallback so a local/manual SSR build that follows
// Node's ESM naming rules still works instead of failing on a stale path.
const SSR_ENTRY_NAMES = ['prerender.js', 'prerender.mjs', 'prerender.cjs'];

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveSsrEntry() {
  for (const name of SSR_ENTRY_NAMES) {
    const candidate = path.join(ssrDir, name);
    if (await exists(candidate)) {
      return candidate;
    }
  }

  let contents = [];
  try {
    contents = (await readdir(ssrDir)).sort();
  } catch {
    // The directory itself is missing; the message below covers that case.
  }

  throw new Error(
    [
      `SSR bundle not found in ${ssrDir}.`,
      `Expected one of: ${SSR_ENTRY_NAMES.join(', ')}.`,
      `Directory contents: ${contents.length > 0 ? contents.join(', ') : '(missing or empty)'}`,
      'Run "npm run build:ssr" before "node scripts/generate-seo.mjs".',
      'On Cloudflare Pages the build command must be "npm run build" and the output directory "dist".'
    ].join('\n')
  );
}

async function main() {
  if (!(await exists(path.join(distDir, 'index.html')))) {
    throw new Error(
      `Client build not found at ${path.join(distDir, 'index.html')}. Run "vite build" first.`
    );
  }

  const ssrEntry = await resolveSsrEntry();
  console.log(`using SSR bundle ${path.relative(root, ssrEntry)}`);

  const templatePath = path.join(distDir, 'index.html');
  const template = await readFile(templatePath, 'utf8');

  const seoStart = template.indexOf('<!-- SEO_HEAD_START -->');
  const seoEnd = template.indexOf('<!-- SEO_HEAD_END -->');

  if (seoStart === -1 || seoEnd === -1 || seoEnd < seoStart) {
    throw new Error('index.html must contain <!-- SEO_HEAD_START --> and <!-- SEO_HEAD_END --> markers.');
  }

  const seoBlock = template.slice(seoStart, seoEnd + '<!-- SEO_HEAD_END -->'.length);

  // Import the SSR entry built by Vite so React components are rendered with
  // the exact same registry and route definitions as the client application.
  // Vite bakes VITE_SITE_URL and VITE_NOINDEX into this bundle from both `.env`
  // files and the shell environment, so use that as the single source of truth.
  const ssr = await import(pathToFileURL(ssrEntry).href);

  if (typeof ssr.renderAllPages !== 'function' || typeof ssr.isIndexableBuild !== 'function') {
    throw new Error(
      `SSR bundle at ${ssrEntry} does not export the expected prerender API (renderAllPages, isIndexableBuild).`
    );
  }

  const indexable = ssr.isIndexableBuild();
  const noindexRequested = !indexable;
  const pages = ssr.renderAllPages(indexable);
  const sitemapPaths = ssr.getSitemapPaths();
  const renderedSiteUrl = ssr.getSiteUrlForSitemap();

  const rootPattern = /<div id="root"><\/div>/;

  if (!rootPattern.test(template)) {
    throw new Error('index.html must contain an empty <div id="root"></div> for prerendering.');
  }

  for (const page of pages) {
    let html = template;

    // Use replacer functions so "$&", "$'", and similar sequences in generated
    // text (for example a literal `"$"` in documentation) are inserted verbatim
    // instead of being interpreted as String.replace substitution patterns.
    html = html.replace(seoBlock, () => page.headHtml);
    html = html.replace(rootPattern, () => `<div id="root">${page.bodyHtml}</div>`);

    if (noindexRequested) {
      html = html.replace('<html lang="en" class="dark">', '<html lang="en" class="dark" data-preview="true">');
    }

    const outputPath = path.join(distDir, page.outputFile);
    await writeFile(outputPath, html, 'utf8');
    console.log(`prerendered ${page.path} -> dist/client/${page.outputFile}`);
  }

  // sitemap.xml
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPaths.map((routePath) => {
      const url = routePath === '/' ? `${renderedSiteUrl}/` : `${renderedSiteUrl}${routePath}`;
      return `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`;
    }),
    '</urlset>',
    ''
  ].join('\n');

  await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

  // robots.txt
  const robots = noindexRequested
    ? ['# Preview deployment: do not index.', 'User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${renderedSiteUrl}/sitemap.xml`,
        ''
      ].join('\n');

  await writeFile(path.join(distDir, 'robots.txt'), robots, 'utf8');

  // Cloudflare Pages: the custom 404 document is served automatically.
  // The attribute also keeps preview deployments out of search results when a
  // build is explicitly marked non-indexable.
  const headersPath = path.join(distDir, '_headers');
  if (noindexRequested) {
    await writeFile(
      headersPath,
      ['/*', '  X-Robots-Tag: noindex, nofollow, noarchive', ''].join('\n'),
      'utf8'
    );
  } else if (await exists(headersPath)) {
    await rm(headersPath);
  }

  console.log(`generated sitemap.xml with ${sitemapPaths.length} URLs for ${renderedSiteUrl}`);
  console.log(`generated robots.txt (${indexable ? 'indexable production' : 'noindex preview'})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
