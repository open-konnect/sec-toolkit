import { PageSeo } from './pages';
import {
  GOOGLE_SITE_VERIFICATION,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE_PATH,
  SITE_TWITTER_HANDLE,
  SITE_URL,
  absoluteAssetUrl,
  absoluteUrl
} from './config';

export interface SeoHeadData {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  ogImage: string;
  ogImageAlt: string;
  ogImageType: string;
  ogImageWidth: number;
  ogImageHeight: number;
  twitterCard: 'summary' | 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterSite?: string;
  googleSiteVerification?: string;
  structuredData: Array<Record<string, unknown>>;
}

export interface BuildSeoHeadOptions {
  /**
   * Production builds are indexable by default. Preview builds pass false so
   * Cloudflare Pages previews never compete with the production domain.
   */
  indexable?: boolean;
}

function buildFullTitle(title: string): string {
  const base = title.trim() || SITE_NAME;
  return base.includes(SITE_NAME) ? base : `${base} | ${SITE_NAME}`;
}

function buildBreadcrumbSchema(seo: PageSeo): Record<string, unknown> | null {
  if (!seo.breadcrumbs || seo.breadcrumbs.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: seo.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path)
    }))
  };
}

function buildFaqSchema(seo: PageSeo): Record<string, unknown> | null {
  if (!seo.faqs || seo.faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

function buildStructuredData(seo: PageSeo): Array<Record<string, unknown>> {
  const schemas: Array<Record<string, unknown>> = [];
  const pageUrl = absoluteUrl(seo.path);

  if (seo.kind === 'home') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: seo.title,
      url: pageUrl,
      description: seo.description,
      inLanguage: 'en'
    });
  }

  if (seo.kind === 'tool') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: seo.title,
      url: pageUrl,
      description: seo.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript. All processing happens locally in the browser.',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      }
    });
  }

  if (seo.kind === 'category') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.title,
      url: pageUrl,
      description: seo.description,
      inLanguage: 'en',
      mainEntity: seo.items && seo.items.length > 0
        ? {
            '@type': 'ItemList',
            numberOfItems: seo.items.length,
            itemListElement: seo.items.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.path),
              ...(item.description ? { description: item.description } : {})
            }))
          }
        : undefined
    });
  }

  const breadcrumbs = buildBreadcrumbSchema(seo);
  if (breadcrumbs) schemas.push(breadcrumbs);

  const faqs = buildFaqSchema(seo);
  if (faqs) schemas.push(faqs);

  return schemas;
}

export function buildSeoHead(seo: PageSeo, options: BuildSeoHeadOptions = {}): SeoHeadData {
  const indexable = seo.indexable !== false && options.indexable !== false;
  const canonical = absoluteUrl(seo.path);
  const title = buildFullTitle(seo.title);
  const ogImage = absoluteAssetUrl(SITE_OG_IMAGE_PATH);

  return {
    title,
    description: seo.description || SITE_DESCRIPTION,
    canonical,
    robots: indexable ? 'index, follow' : 'noindex, nofollow',
    ogTitle: title,
    ogDescription: seo.description || SITE_DESCRIPTION,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogImage,
    ogImageAlt: `${SITE_NAME} — private, browser-based developer and security tools`,
    ogImageType: 'image/png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: seo.description || SITE_DESCRIPTION,
    twitterImage: ogImage,
    ...(SITE_TWITTER_HANDLE ? { twitterSite: SITE_TWITTER_HANDLE } : {}),
    ...(GOOGLE_SITE_VERIFICATION ? { googleSiteVerification: GOOGLE_SITE_VERIFICATION } : {}),
    structuredData: buildStructuredData(seo)
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeJsonLd(data: Array<Record<string, unknown>>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function serializeSeoHead(head: SeoHeadData): string {
  const tag = (name: string, content: string, attribute: 'name' | 'property' = 'name') =>
    `<meta ${attribute}="${escapeHtml(name)}" content="${escapeHtml(content)}">`;

  const tags = [
    `<title>${escapeHtml(head.title)}</title>`,
    tag('description', head.description),
    tag('robots', head.robots),
    `<link rel="canonical" href="${escapeHtml(head.canonical)}">`,
    tag('og:type', head.ogType, 'property'),
    tag('og:site_name', head.ogSiteName, 'property'),
    tag('og:title', head.ogTitle, 'property'),
    tag('og:description', head.ogDescription, 'property'),
    tag('og:url', head.ogUrl, 'property'),
    tag('og:image', head.ogImage, 'property'),
    tag('og:image:alt', head.ogImageAlt, 'property'),
    tag('og:image:type', head.ogImageType, 'property'),
    tag('og:image:width', String(head.ogImageWidth), 'property'),
    tag('og:image:height', String(head.ogImageHeight), 'property'),
    tag('twitter:card', head.twitterCard),
    tag('twitter:title', head.twitterTitle),
    tag('twitter:description', head.twitterDescription),
    tag('twitter:image', head.twitterImage)
  ];

  if (head.twitterSite) tags.push(tag('twitter:site', head.twitterSite));
  if (head.googleSiteVerification) tags.push(tag('google-site-verification', head.googleSiteVerification));

  tags.push(
    `<script type="application/ld+json" id="seo-structured-data">${serializeJsonLd(head.structuredData)}</script>`
  );

  return tags.join('\n    ');
}

function setMeta(
  attribute: 'name' | 'property',
  value: string,
  content: string | undefined
): void {
  if (!content) return;

  const selector = `meta[${attribute}="${value}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
  const canonical = links.shift() || document.createElement('link');

  links.forEach((duplicate) => duplicate.remove());

  canonical.setAttribute('rel', 'canonical');
  canonical.setAttribute('href', href);

  if (!canonical.parentNode) {
    document.head.appendChild(canonical);
  }
}

/**
 * Applies metadata after client-side navigation. Static HTML is generated at
 * build time; this keeps titles, canonicals, and social tags in sync without a
 * full page reload.
 */
export function applySeoHead(head: SeoHeadData): void {
  document.title = head.title;

  // Obsolete keyword meta tags are intentionally not written.
  document.head.querySelectorAll('meta[name="keywords"]').forEach((element) => element.remove());

  setMeta('name', 'description', head.description);
  setMeta('name', 'robots', head.robots);
  setMeta('property', 'og:type', head.ogType);
  setMeta('property', 'og:site_name', head.ogSiteName);
  setMeta('property', 'og:title', head.ogTitle);
  setMeta('property', 'og:description', head.ogDescription);
  setMeta('property', 'og:url', head.ogUrl);
  setMeta('property', 'og:image', head.ogImage);
  setMeta('property', 'og:image:alt', head.ogImageAlt);
  setMeta('property', 'og:image:type', head.ogImageType);
  setMeta('property', 'og:image:width', String(head.ogImageWidth));
  setMeta('property', 'og:image:height', String(head.ogImageHeight));
  setMeta('name', 'twitter:card', head.twitterCard);
  setMeta('name', 'twitter:title', head.twitterTitle);
  setMeta('name', 'twitter:description', head.twitterDescription);
  setMeta('name', 'twitter:image', head.twitterImage);
  setMeta('name', 'twitter:site', head.twitterSite);
  setMeta('name', 'google-site-verification', head.googleSiteVerification);

  if (!head.googleSiteVerification) {
    document.head.querySelectorAll('meta[name="google-site-verification"]').forEach((element) => element.remove());
  }

  setCanonical(head.canonical);

  const scriptId = 'seo-structured-data';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(head.structuredData);
}

export const SITE_CANONICAL_ORIGIN = SITE_URL;
