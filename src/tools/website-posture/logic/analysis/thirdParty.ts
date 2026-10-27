/**
 * Third-party domain classification.
 *
 * Third-party content is normal and usually deliberate: a CDN, an analytics
 * tag, a payment widget, a font host. Classification exists so the report can
 * describe the *shape* of a site's external attack surface, not so that using
 * a CDN can be reported as a defect. No function here produces a verdict.
 */

import {
  AnalyzedPage,
  NormalizedResource,
  PartyRelationship,
  ResourceType,
  ThirdPartyDomain,
  ThirdPartyKind,
  ThirdPartySurface
} from '../../types';
import { isActiveResource } from '../resource';
import { parseUrl, registrableDomain } from '../url';

export type { ThirdPartyKind, ThirdPartySurface };

interface DomainRule {
  kind: ThirdPartyKind;
  /** Matched as a case-insensitive suffix or substring of the hostname. */
  needles: readonly string[];
}

/**
 * Deliberately conservative. A domain that is not recognized is reported as
 * `other` rather than guessed at, because a wrong label in a security report
 * is worse than no label.
 */
const DOMAIN_RULES: readonly DomainRule[] = [
  {
    kind: 'cdn',
    needles: [
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
      'unpkg.com',
      'ajax.googleapis.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'use.typekit.net',
      'use.fontawesome.com',
      'stackpath.bootstrapcdn.com',
      'maxcdn.bootstrapcdn.com',
      'cdn.shopify.com',
      'akamaihd.net',
      'cloudfront.net',
      'fastly.net',
      'jsdelivr.net'
    ]
  },
  {
    kind: 'tag-manager',
    needles: ['googletagmanager.com', 'tagmanager.google.com', 'cdn.segment.com', 'tags.tiqcdn.com']
  },
  {
    kind: 'analytics',
    needles: [
      'google-analytics.com',
      'analytics.google.com',
      'static.hotjar.com',
      'script.hotjar.com',
      'cdn.mxpnl.com',
      'cdn.amplitude.com',
      'plausible.io',
      'cloudflareinsights.com',
      'matomo.cloud',
      'clarity.ms',
      'fullstory.com',
      'logrocket.io',
      'sentry.io',
      'browser.sentry-cdn.com',
      'newrelic.com',
      'nr-data.net'
    ]
  },
  {
    kind: 'payment',
    needles: [
      'js.stripe.com',
      'checkout.stripe.com',
      'www.paypal.com',
      'www.paypalobjects.com',
      'checkout.razorpay.com',
      'js.braintreegateway.com',
      'checkout.adyen.com',
      'secure.squareup.com',
      'web.squarecdn.com',
      'checkout.flutterwave.com'
    ]
  },
  {
    kind: 'social',
    needles: [
      'connect.facebook.net',
      'platform.twitter.com',
      'platform.linkedin.com',
      'apis.google.com',
      'www.youtube.com',
      'player.vimeo.com',
      'disqus.com'
    ]
  }
];

/** Classifies a hostname. Unknown hosts are `other`, never guessed. */
export function classifyDomain(host: string | null | undefined): ThirdPartyKind {
  if (!host) return 'other';
  const value = host.trim().toLowerCase();
  if (!value) return 'other';

  for (const rule of DOMAIN_RULES) {
    if (rule.needles.some((needle) => value === needle || value.endsWith(`.${needle}`) || value.includes(needle))) {
      return rule.kind;
    }
  }

  return 'other';
}

const EMPTY_BY_KIND = (): Record<ThirdPartyKind, string[]> => ({
  cdn: [],
  analytics: [],
  payment: [],
  'tag-manager': [],
  social: [],
  other: []
});

/** Cap on per-host detail rows kept in the report. */
const MAX_DETAIL_DOMAINS = 50;

/**
 * How a resource host relates to the page that references it.
 *
 * `same-site` uses a registrable-domain heuristic, so a `cdn.` subdomain of the
 * page's own domain is not presented as a third party. The heuristic is not
 * the Public Suffix List; on an unlisted multi-label suffix it errs towards
 * `third-party`, which only ever makes the report more cautious.
 */
export function relationshipOf(
  resource: NormalizedResource,
  pageOrigin: string,
  pageHost: string
): PartyRelationship {
  if (!resource.crossOrigin || resource.origin === pageOrigin) return 'first-party';
  if (!resource.host || !pageHost) return 'third-party';
  const resourceSite = registrableDomain(resource.host);
  return resourceSite !== null && resourceSite === registrableDomain(pageHost)
    ? 'same-site'
    : 'third-party';
}

/**
 * Summarizes the external resource surface across the analyzed pages.
 *
 * Counts cover only references declared in markup the engine could read.
 * Resources a script injects at runtime are invisible to a passive scan, so
 * these numbers are a floor, not a total. Nothing here judges a domain.
 */
export function summarizeThirdPartySurface(pages: readonly AnalyzedPage[]): ThirdPartySurface {
  const hosts = new Map<
    string,
    { kind: ThirdPartyKind; relationship: PartyRelationship; count: number; pages: Set<string>; byType: Partial<Record<ResourceType, number>> }
  >();

  let totalResources = 0;
  let firstPartyResources = 0;
  let sameSiteResources = 0;
  let thirdPartyResources = 0;
  let externalActiveResources = 0;
  let externalScripts = 0;
  let externalStylesheets = 0;
  let externalFrames = 0;
  let externalImages = 0;
  let externalFonts = 0;
  let externalMedia = 0;
  let paymentFormCount = 0;

  for (const page of pages) {
    const pageHost = parseUrl(page.url)?.hostname.toLowerCase() ?? '';
    paymentFormCount += page.forms.filter((form) => form.hasPaymentField).length;

    for (const resource of page.resources) {
      totalResources += 1;
      const relationship = relationshipOf(resource, page.origin, pageHost);

      if (relationship === 'first-party' || !resource.host) {
        firstPartyResources += 1;
        continue;
      }
      if (relationship === 'same-site') sameSiteResources += 1;
      else thirdPartyResources += 1;

      if (isActiveResource(resource)) externalActiveResources += 1;
      if (resource.type === 'script') externalScripts += 1;
      if (resource.type === 'stylesheet') externalStylesheets += 1;
      if (resource.type === 'iframe') externalFrames += 1;
      if (resource.type === 'image') externalImages += 1;
      if (resource.type === 'font') externalFonts += 1;
      if (resource.type === 'media') externalMedia += 1;

      let entry = hosts.get(resource.host);
      if (!entry) {
        entry = {
          kind: classifyDomain(resource.host),
          relationship,
          count: 0,
          pages: new Set<string>(),
          byType: {}
        };
        hosts.set(resource.host, entry);
      }
      entry.count += 1;
      entry.pages.add(page.url);
      entry.byType[resource.type] = (entry.byType[resource.type] ?? 0) + 1;
    }
  }

  const byKind = EMPTY_BY_KIND();
  const thirdPartyDomains: string[] = [];
  const sameSiteDomains: string[] = [];

  for (const [host, entry] of hosts) {
    byKind[entry.kind].push(host);
    (entry.relationship === 'same-site' ? sameSiteDomains : thirdPartyDomains).push(host);
  }
  for (const kind of Object.keys(byKind) as ThirdPartyKind[]) byKind[kind].sort();

  const details: ThirdPartyDomain[] = [...hosts.entries()]
    .map(([host, entry]) => ({
      host,
      kind: entry.kind,
      relationship: entry.relationship,
      resourceCount: entry.count,
      pageCount: entry.pages.size,
      byType: entry.byType
    }))
    .sort((a, b) => b.resourceCount - a.resourceCount || a.host.localeCompare(b.host))
    .slice(0, MAX_DETAIL_DOMAINS);

  return {
    totalResources,
    firstPartyResources,
    sameSiteResources,
    thirdPartyResources,
    externalResources: sameSiteResources + thirdPartyResources,
    externalActiveResources,
    externalScripts,
    externalStylesheets,
    externalFrames,
    externalImages,
    externalFonts,
    externalMedia,
    domains: [...hosts.keys()].sort(),
    thirdPartyDomains: thirdPartyDomains.sort(),
    sameSiteDomains: sameSiteDomains.sort(),
    byKind,
    paymentFormCount,
    details
  };
}

/** Human-readable name for a classification, for use in report text. */
export const THIRD_PARTY_KIND_LABELS: Record<ThirdPartyKind, string> = {
  cdn: 'CDN or asset host',
  analytics: 'analytics or monitoring',
  payment: 'payment provider',
  'tag-manager': 'tag manager',
  social: 'social or embed platform',
  other: 'other external domain'
};

/**
 * True when Subresource Integrity is a meaningful recommendation.
 *
 * SRI only applies to `<script>` and `<link rel=stylesheet>`, only helps for a
 * cross-origin URL, and is actively wrong for a resource whose body is
 * expected to change — a tag manager, an analytics loader, or a payment SDK
 * that ships fixes without a version bump. Recommending a hash there would
 * tell an operator to break their own site.
 */
export function sriIsMeaningful(resource: NormalizedResource): boolean {
  if (!resource.resolvable || !resource.crossOrigin) return false;
  if (resource.type !== 'script' && resource.type !== 'stylesheet') return false;

  const kind = classifyDomain(resource.host);
  return kind !== 'analytics' && kind !== 'payment' && kind !== 'tag-manager';
}
