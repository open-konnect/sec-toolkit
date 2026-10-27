/**
 * Passive technology detection.
 *
 * Detection reads only evidence the engine already holds: resource URLs, the
 * meta generator tag, readable response headers, a fixed list of framework
 * markers, and catalogue ids derived from inline script. It never requests a
 * file to confirm a guess, and it never executes anything.
 *
 * - A technology is reported only on a *definitive* signal (it names itself,
 *   e.g. a generator tag or vendor-specific header) or a *strong* one (a marker
 *   specific to it in practice). Anything weaker is not reported.
 * - Confidence is high for a definitive signal or two independent strong
 *   signals, and medium for a single strong signal.
 * - A version is attached only when the version string itself appeared in the
 *   evidence. Naming a framework never implies a version.
 * - Every signal's `detail` is fixed catalogue text, never matched page
 *   content, so the evidence view cannot echo target data.
 */

import {
  Confidence,
  DetectedTechnology,
  TechnologyCategory,
  TechnologySignal,
  TechnologySignalSource
} from '../../types';

export interface TechnologyInput {
  /** Lowercased absolute resource URLs, query included. */
  resourceUrls: readonly string[];
  /** Lowercased hostnames of every resource. */
  resourceHosts: readonly string[];
  /** Raw `<meta name=generator>` content, or null. */
  metaGenerator: string | null;
  /** Lowercase header name to value; empty when headers were not readable. */
  headers: Readonly<Record<string, string>>;
  /** Fixed-vocabulary markers from the scanner. */
  markers: readonly string[];
  /** Catalogue ids of inline-script markers (see `TECH_SCRIPT_PATTERNS`). */
  scriptMarkers: ReadonlySet<string>;
}

type Strength = 'definitive' | 'strong';

interface HeaderRule {
  name: string;
  /** When omitted, presence of the header is the signal. */
  test?: RegExp;
  strength: Strength;
  /** Extracts a version from the header value, when it carries one. */
  version?: RegExp;
}

interface TechnologyRule {
  id: string;
  name: string;
  category: TechnologyCategory;
  urls?: readonly RegExp[];
  /** Matched against resource hostnames as exact or suffix. */
  hosts?: readonly string[];
  markers?: readonly string[];
  definitiveMarkers?: readonly string[];
  scripts?: readonly string[];
  definitiveScripts?: readonly string[];
  headers?: readonly HeaderRule[];
  /** Matched against the generator meta tag; a match is definitive. */
  generator?: RegExp;
  /** Technologies necessarily present when this one is. */
  implies?: readonly string[];
  /** Marker prefix that carries a version, e.g. `attr:ng-version=`. */
  markerVersionPrefix?: string;
}

/** Inline-script catalogue. Matches are reduced to the ids below. */
export const TECH_SCRIPT_PATTERNS: readonly { id: string; pattern: RegExp }[] = [
  { id: 'next-data', pattern: /__NEXT_DATA__/ },
  { id: 'nuxt-state', pattern: /__NUXT__/ },
  { id: 'shopify-global', pattern: /\bShopify\.(?:theme|shop|locale|currency|routes)\b|window\.Shopify\b/ },
  { id: 'drupal-settings', pattern: /\bdrupalSettings\b|\bDrupal\.settings\b/ },
  { id: 'react-devtools-hook', pattern: /__REACT_DEVTOOLS_GLOBAL_HOOK__/ },
  { id: 'wp-settings', pattern: /\bwpApiSettings\b|\bwp-emoji-settings\b/ },
  { id: 'gtag-config', pattern: /\bgtag\s*\(\s*['"]config['"]/ },
  { id: 'ga-create', pattern: /\bga\s*\(\s*['"]create['"]/ },
  { id: 'fb-pixel', pattern: /\bfbq\s*\(\s*['"]init['"]/ },
  { id: 'hotjar-init', pattern: /\b_hjSettings\b/ }
];

const RULES: readonly TechnologyRule[] = [
  /* ---------------------------- frameworks ---------------------------- */
  {
    id: 'react',
    name: 'React',
    category: 'framework',
    urls: [/\/react(?:-dom)?(?:\.production|\.development)?(?:\.min)?\.js\b/, /\/react(?:-dom)?@\d/],
    markers: ['attr:data-reactroot', 'attr:data-reactid'],
    scripts: ['react-devtools-hook']
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'framework',
    urls: [/\/_next\/static\//],
    markers: ['id:__next'],
    definitiveMarkers: ['id:__next_data__'],
    definitiveScripts: ['next-data'],
    headers: [{ name: 'x-powered-by', test: /next\.js/i, strength: 'definitive' }],
    implies: ['react']
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'framework',
    urls: [/\/vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js\b/, /\/vue@\d/],
    markers: ['attr:data-v', 'attr:data-server-rendered']
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'framework',
    urls: [/\/_nuxt\//],
    markers: ['id:__nuxt'],
    scripts: ['nuxt-state'],
    implies: ['vue']
  },
  {
    id: 'angular',
    name: 'Angular',
    category: 'framework',
    definitiveMarkers: ['attr:ng-version'],
    markers: ['attr:_nghost', 'attr:_ngcontent'],
    markerVersionPrefix: 'attr:ng-version='
  },
  {
    id: 'angularjs',
    name: 'AngularJS',
    category: 'framework',
    urls: [/\/angular(?:\.min)?\.js\b/],
    markers: ['attr:ng-app']
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'framework',
    markers: ['id:__gatsby'],
    implies: ['react']
  },
  {
    id: 'jquery',
    name: 'jQuery',
    category: 'library',
    urls: [/\/jquery(?:[.-]\d[\w.-]*)?(?:\.min)?\.js\b/]
  },

  /* ------------------------------- CMS -------------------------------- */
  {
    id: 'wordpress',
    name: 'WordPress',
    category: 'cms',
    generator: /\bwordpress\b/i,
    urls: [/\/wp-content\//, /\/wp-includes\//],
    scripts: ['wp-settings']
  },
  {
    id: 'drupal',
    name: 'Drupal',
    category: 'cms',
    generator: /\bdrupal\b/i,
    urls: [/\/sites\/default\/files\//, /\/sites\/all\//, /\/core\/misc\/drupal\.js/],
    scripts: ['drupal-settings'],
    headers: [
      { name: 'x-generator', test: /drupal/i, strength: 'definitive' },
      { name: 'x-drupal-cache', strength: 'strong' }
    ]
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    hosts: ['cdn.shopify.com', 'shopifycdn.com'],
    markers: ['id:shopify-section-header'],
    scripts: ['shopify-global'],
    headers: [
      { name: 'x-shopid', strength: 'definitive' },
      { name: 'x-shopify-stage', strength: 'definitive' }
    ]
  },
  {
    id: 'wix',
    name: 'Wix',
    category: 'cms',
    generator: /\bwix\.com\b/i,
    hosts: ['static.wixstatic.com', 'static.parastorage.com'],
    headers: [{ name: 'x-wix-request-id', strength: 'definitive' }]
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    category: 'cms',
    generator: /\bsquarespace\b/i,
    hosts: ['static1.squarespace.com', 'images.squarespace-cdn.com']
  },
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'cms',
    generator: /\bwebflow\b/i,
    hosts: ['assets.website-files.com', 'uploads-ssl.webflow.com']
  },

  /* ----------------------------- hosting ------------------------------ */
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'hosting',
    headers: [
      { name: 'x-vercel-id', strength: 'definitive' },
      { name: 'server', test: /^vercel$/i, strength: 'definitive' }
    ]
  },
  {
    id: 'netlify',
    name: 'Netlify',
    category: 'hosting',
    headers: [
      { name: 'x-nf-request-id', strength: 'definitive' },
      { name: 'server', test: /^netlify$/i, strength: 'definitive' }
    ]
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    category: 'hosting',
    headers: [{ name: 'server', test: /^github\.com$/i, strength: 'definitive' }]
  },
  {
    id: 'amazon-s3',
    name: 'Amazon S3',
    category: 'hosting',
    headers: [{ name: 'server', test: /^amazons3$/i, strength: 'definitive' }]
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    category: 'hosting',
    headers: [{ name: 'x-azure-ref', strength: 'strong' }]
  },

  /* ------------------------------- CDNs ------------------------------- */
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'cdn',
    headers: [
      { name: 'cf-ray', strength: 'definitive' },
      { name: 'server', test: /^cloudflare$/i, strength: 'definitive' }
    ]
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    category: 'cdn',
    hosts: ['cloudfront.net'],
    headers: [
      { name: 'x-amz-cf-id', strength: 'definitive' },
      { name: 'via', test: /cloudfront/i, strength: 'definitive' }
    ]
  },
  {
    id: 'fastly',
    name: 'Fastly',
    category: 'cdn',
    hosts: ['fastly.net', 'fastlylb.net'],
    headers: [{ name: 'x-fastly-request-id', strength: 'definitive' }]
  },
  {
    id: 'akamai',
    name: 'Akamai',
    category: 'cdn',
    hosts: ['akamaihd.net', 'akamaized.net', 'edgekey.net'],
    headers: [{ name: 'server', test: /^akamaighost$/i, strength: 'definitive' }]
  },
  { id: 'jsdelivr', name: 'jsDelivr', category: 'cdn', hosts: ['cdn.jsdelivr.net'] },
  { id: 'cdnjs', name: 'cdnjs', category: 'cdn', hosts: ['cdnjs.cloudflare.com'] },
  { id: 'unpkg', name: 'unpkg', category: 'cdn', hosts: ['unpkg.com'] },
  {
    id: 'google-hosted-libraries',
    name: 'Google Hosted Libraries',
    category: 'cdn',
    hosts: ['ajax.googleapis.com']
  },
  {
    id: 'google-fonts',
    name: 'Google Fonts',
    category: 'cdn',
    hosts: ['fonts.googleapis.com', 'fonts.gstatic.com']
  },
  { id: 'bunny-cdn', name: 'Bunny CDN', category: 'cdn', hosts: ['b-cdn.net'] },

  /* ------------------------- web servers / stacks ---------------------- */
  {
    id: 'nginx',
    name: 'nginx',
    category: 'web-server',
    headers: [{ name: 'server', test: /^nginx\b/i, strength: 'definitive', version: /nginx\/(\d+(?:\.\d+){1,3})/i }]
  },
  {
    id: 'apache',
    name: 'Apache HTTP Server',
    category: 'web-server',
    headers: [{ name: 'server', test: /^apache\b/i, strength: 'definitive', version: /apache\/(\d+(?:\.\d+){1,3})/i }]
  },
  {
    id: 'iis',
    name: 'Microsoft IIS',
    category: 'web-server',
    headers: [
      { name: 'server', test: /microsoft-iis/i, strength: 'definitive', version: /microsoft-iis\/(\d+(?:\.\d+){1,3})/i }
    ]
  },
  {
    id: 'litespeed',
    name: 'LiteSpeed',
    category: 'web-server',
    headers: [{ name: 'server', test: /^litespeed\b/i, strength: 'definitive' }]
  },
  {
    id: 'caddy',
    name: 'Caddy',
    category: 'web-server',
    headers: [{ name: 'server', test: /^caddy\b/i, strength: 'definitive' }]
  },
  {
    id: 'php',
    name: 'PHP',
    category: 'framework',
    headers: [{ name: 'x-powered-by', test: /\bphp\b/i, strength: 'definitive', version: /php\/(\d+(?:\.\d+){1,3})/i }]
  },
  {
    id: 'express',
    name: 'Express',
    category: 'framework',
    headers: [{ name: 'x-powered-by', test: /^express$/i, strength: 'definitive' }]
  },
  {
    id: 'aspnet',
    name: 'ASP.NET',
    category: 'framework',
    headers: [
      { name: 'x-aspnet-version', strength: 'definitive' },
      { name: 'x-powered-by', test: /asp\.net/i, strength: 'definitive' }
    ]
  },

  /* ------------------- analytics, tags, monitoring -------------------- */
  {
    id: 'google-tag-manager',
    name: 'Google Tag Manager',
    category: 'tag-manager',
    urls: [/googletagmanager\.com\/gtm\.js/]
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'analytics',
    urls: [/googletagmanager\.com\/gtag\/js/, /google-analytics\.com\/(?:analytics|ga)\.js/],
    scripts: ['gtag-config', 'ga-create']
  },
  { id: 'segment', name: 'Segment', category: 'analytics', hosts: ['cdn.segment.com'] },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'analytics',
    hosts: ['static.hotjar.com', 'script.hotjar.com'],
    scripts: ['hotjar-init']
  },
  { id: 'mixpanel', name: 'Mixpanel', category: 'analytics', hosts: ['cdn.mxpnl.com'] },
  { id: 'amplitude', name: 'Amplitude', category: 'analytics', hosts: ['cdn.amplitude.com'] },
  { id: 'plausible', name: 'Plausible', category: 'analytics', hosts: ['plausible.io'] },
  {
    id: 'matomo',
    name: 'Matomo',
    category: 'analytics',
    urls: [/\/matomo\.js\b/, /\/piwik\.js\b/],
    hosts: ['matomo.cloud']
  },
  { id: 'microsoft-clarity', name: 'Microsoft Clarity', category: 'analytics', hosts: ['clarity.ms'] },
  {
    id: 'facebook-pixel',
    name: 'Meta Pixel',
    category: 'analytics',
    urls: [/connect\.facebook\.net\/[^/]+\/fbevents\.js/],
    scripts: ['fb-pixel']
  },
  {
    id: 'cloudflare-insights',
    name: 'Cloudflare Web Analytics',
    category: 'analytics',
    hosts: ['static.cloudflareinsights.com']
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'monitoring',
    hosts: ['browser.sentry-cdn.com', 'js.sentry-cdn.com']
  },
  {
    id: 'datadog-rum',
    name: 'Datadog RUM',
    category: 'monitoring',
    hosts: ['datadoghq-browser-agent.com']
  },
  {
    id: 'new-relic',
    name: 'New Relic Browser',
    category: 'monitoring',
    hosts: ['js-agent.newrelic.com']
  }
];

const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

const MAX_SIGNALS = 6;
const VERSION_IN_TEXT = /\b(\d{1,3}(?:\.\d{1,4}){1,3})\b/;

interface Hit {
  strength: Strength;
  signal: TechnologySignal;
  implied: boolean;
}

function hostMatches(host: string, needle: string): boolean {
  return host === needle || host.endsWith(`.${needle}`);
}

function addHit(
  hits: Hit[],
  strength: Strength,
  source: TechnologySignalSource,
  detail: string
): void {
  if (hits.some((hit) => hit.signal.source === source && hit.signal.detail === detail)) return;
  hits.push({ strength, signal: { source, detail }, implied: false });
}

function hasMarker(markers: readonly string[], marker: string): boolean {
  return markers.some((candidate) => candidate === marker || candidate.startsWith(`${marker}=`));
}

function markerLabel(marker: string): string {
  return marker.replace(/^(?:attr|id):/, '');
}

function evaluateRule(
  rule: TechnologyRule,
  input: TechnologyInput
): { hits: Hit[]; version?: string } {
  const hits: Hit[] = [];
  let version: string | undefined;

  if (rule.generator && input.metaGenerator && rule.generator.test(input.metaGenerator)) {
    addHit(hits, 'definitive', 'meta', `meta generator names ${rule.name}`);
    const found = VERSION_IN_TEXT.exec(input.metaGenerator);
    if (found) version = found[1];
  }

  for (const header of rule.headers ?? []) {
    const value = input.headers[header.name];
    if (value === undefined) continue;
    if (header.test && !header.test.test(value.trim())) continue;

    addHit(
      hits,
      header.strength,
      'response-header',
      header.test ? `${header.name} header names ${rule.name}` : `${header.name} header present`
    );
    if (header.version) {
      const found = header.version.exec(value);
      if (found) version = found[1];
    }
  }

  for (const pattern of rule.urls ?? []) {
    if (input.resourceUrls.some((url) => pattern.test(url))) {
      addHit(hits, 'strong', 'resource-url', `resource path matches a ${rule.name} pattern`);
      break;
    }
  }

  for (const needle of rule.hosts ?? []) {
    if (input.resourceHosts.some((host) => hostMatches(host, needle))) {
      addHit(hits, 'strong', 'resource-url', `resource loaded from ${needle}`);
      break;
    }
  }

  for (const marker of rule.definitiveMarkers ?? []) {
    if (hasMarker(input.markers, marker)) {
      addHit(hits, 'definitive', 'markup', `markup carries ${markerLabel(marker)}`);
    }
  }
  for (const marker of rule.markers ?? []) {
    if (hasMarker(input.markers, marker)) {
      addHit(hits, 'strong', 'markup', `markup carries ${markerLabel(marker)}`);
    }
  }

  if (rule.markerVersionPrefix) {
    const prefix = rule.markerVersionPrefix;
    const marker = input.markers.find((candidate) => candidate.startsWith(prefix));
    if (marker) version = marker.slice(prefix.length);
  }

  for (const id of rule.definitiveScripts ?? []) {
    if (input.scriptMarkers.has(id)) addHit(hits, 'definitive', 'inline-script', `inline script defines ${id}`);
  }
  for (const id of rule.scripts ?? []) {
    if (input.scriptMarkers.has(id)) addHit(hits, 'strong', 'inline-script', `inline script references ${id}`);
  }

  return { hits, ...(version ? { version } : {}) };
}

function confidenceFor(hits: readonly Hit[]): Confidence {
  if (hits.some((hit) => hit.strength === 'definitive' && !hit.implied)) return 'high';
  const distinct = new Set(
    hits.filter((hit) => !hit.implied).map((hit) => `${hit.signal.source}:${hit.signal.detail}`)
  );
  return distinct.size >= 2 ? 'high' : 'medium';
}

function byCategoryThenName(a: DetectedTechnology, b: DetectedTechnology): number {
  return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
}

/** Detects technologies from one page's observable evidence. */
export function detectTechnologies(input: TechnologyInput): DetectedTechnology[] {
  const found = new Map<string, { hits: Hit[]; version?: string }>();

  for (const rule of RULES) {
    const result = evaluateRule(rule, input);
    if (result.hits.length > 0) found.set(rule.id, result);
  }

  // Implication runs after direct detection, and is labelled as implied so it
  // never raises confidence on its own.
  for (const id of [...found.keys()]) {
    const parent = RULES_BY_ID.get(id);
    for (const impliedId of parent?.implies ?? []) {
      if (found.has(impliedId)) continue;
      found.set(impliedId, {
        hits: [
          {
            strength: 'strong',
            implied: true,
            signal: { source: 'markup', detail: `implied by ${parent?.name ?? id} indicators` }
          }
        ]
      });
    }
  }

  const detected: DetectedTechnology[] = [];

  for (const [id, result] of found) {
    const rule = RULES_BY_ID.get(id);
    if (!rule) continue;

    const ordered = [...result.hits].sort((a, b) =>
      a.strength === b.strength ? 0 : a.strength === 'definitive' ? -1 : 1
    );
    const signals = ordered.slice(0, MAX_SIGNALS).map((hit) => hit.signal);

    detected.push({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      evidence: signals[0]?.detail ?? '',
      signals,
      confidence: confidenceFor(result.hits),
      ...(result.version ? { version: result.version } : {})
    });
  }

  // A generator tag for something the catalogue does not know is still an
  // explicit self-declaration: surfaced by name (capped), without a version.
  if (input.metaGenerator && !detected.some((tech) => tech.signals.some((s) => s.source === 'meta'))) {
    const name = input.metaGenerator.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name) {
      detected.push({
        id: 'generator',
        name,
        category: 'cms',
        evidence: 'meta generator tag',
        signals: [{ source: 'meta', detail: 'meta generator tag' }],
        confidence: 'medium'
      });
    }
  }

  return detected.sort(byCategoryThenName);
}

/**
 * Merges per-page detections into one site-level list.
 *
 * Signals are unioned (capped), confidence takes the strongest page, and a
 * version is kept only if every page that reported one agreed on it.
 */
export function mergeTechnologies(
  pages: ReadonlyArray<readonly DetectedTechnology[]>
): DetectedTechnology[] {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  const merged = new Map<string, DetectedTechnology>();
  const versions = new Map<string, Set<string>>();

  for (const technologies of pages) {
    for (const technology of technologies) {
      if (technology.version) {
        const set = versions.get(technology.id) ?? new Set<string>();
        set.add(technology.version);
        versions.set(technology.id, set);
      }

      const existing = merged.get(technology.id);
      if (!existing) {
        merged.set(technology.id, { ...technology, signals: [...technology.signals] });
        continue;
      }

      for (const signal of technology.signals) {
        if (
          existing.signals.length < MAX_SIGNALS &&
          !existing.signals.some((s) => s.source === signal.source && s.detail === signal.detail)
        ) {
          existing.signals.push(signal);
        }
      }
      if (rank[technology.confidence] > rank[existing.confidence]) {
        existing.confidence = technology.confidence;
      }
    }
  }

  for (const [id, technology] of merged) {
    const seen = versions.get(id);
    if (seen && seen.size === 1) technology.version = [...seen][0];
    else delete technology.version;
  }

  return [...merged.values()].sort(byCategoryThenName);
}

/** Reduces inline script text to the ids of the catalogue markers it contains. */
export function scriptMarkerIds(text: string): string[] {
  if (!text) return [];
  return TECH_SCRIPT_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.id);
}

export const TECHNOLOGY_CATEGORY_LABELS: Record<TechnologyCategory, string> = {
  framework: 'Framework or runtime',
  cms: 'Content platform',
  ecommerce: 'E-commerce platform',
  library: 'Library',
  cdn: 'CDN or asset host',
  hosting: 'Hosting platform',
  'web-server': 'Web server',
  analytics: 'Analytics',
  'tag-manager': 'Tag manager',
  monitoring: 'Monitoring'
};
