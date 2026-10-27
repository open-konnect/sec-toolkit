/**
 * Per-page inventory.
 *
 * A flat, value-free summary of every analyzed page: structure counts,
 * external domains, protocols, detected technologies and neutral observations.
 * It is built from the already-sanitized page model, so it cannot contain form
 * values, script text, or any other body content.
 */

import { AnalyzedPage, PageInventoryEntry } from '../types';

export function buildPageInventory(pages: readonly AnalyzedPage[]): PageInventoryEntry[] {
  return pages.map((page) => ({
    url: page.url,
    depth: page.depth,
    title: page.title,
    canonicalUrl: page.canonicalUrl,
    metaDescription: page.metaDescription,
    statusCode: page.statusCode,
    counts: {
      links: page.links.length,
      sameOriginLinks: page.links.filter((link) => link.sameOrigin).length,
      forms: page.forms.length,
      passwordForms: page.forms.filter((form) => form.hasPasswordField).length,
      scripts: page.resourceCounts.script,
      inlineScripts: page.inlineScriptCount,
      styles: page.resourceCounts.stylesheet + page.inlineStyleCount,
      images: page.resourceCounts.image,
      fonts: page.resourceCounts.font,
      iframes: page.resourceCounts.iframe,
      media: page.resourceCounts.media,
      objects: page.resourceCounts.object,
      embeds: page.resourceCounts.embed
    },
    externalDomains: page.externalDomains,
    protocols: page.protocols,
    technologies: page.detectedTechnologies.map((technology) => technology.id),
    observations: page.observations.map((observation) => observation.id)
  }));
}
