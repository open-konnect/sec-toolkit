/**
 * Builds a normalized `AnalyzedPage` from a scanned snapshot.
 *
 * Privacy rules enforced here:
 *
 * - Form field *values* are never read; only field types and counts are.
 * - Inline script text is matched against indicator patterns and then dropped.
 *   It is never stored on the page model and never leaves this function.
 * - Nothing in the snapshot is executed, evaluated, or resolved over the
 *   network.
 */

import {
  AnalyzedPage,
  InlineEventHandler,
  MetaTag,
  NormalizedResource,
  ObservedHeaders,
  PageForm,
  PageIndicator,
  PageLink,
  PageObservation,
  RawElement,
  RawPageSnapshot,
  ResourceType
} from '../types';
import { classifyForm, looksLikePaymentField } from './analysis/forms';
import {
  DANGEROUS_DOM_PATTERNS,
  DEBUG_PATTERNS,
  DYNAMIC_SCRIPT_PATTERNS,
  MARKUP_INDICATORS,
  POST_MESSAGE_PATTERNS,
  SENSITIVE_API_PATTERNS,
  SERVICE_WORKER_PATTERNS,
  SOURCE_MAP_PATTERNS,
  STORAGE_API_PATTERNS,
  countIndicators,
  looksInternalHost,
  mergeIndicators,
  sortedIndicators
} from './analysis/indicators';
import { detectTechnologies, scriptMarkerIds } from './analysis/technology';
import { normalizeResource, referencesFromElement } from './resource';
import {
  isNavigableProtocol,
  normalizeParsedUrl,
  normalizeUrl,
  originOf,
  parseUrl
} from './url';

/** Caps on the per-page collections retained for reporting. */
const MAX_LINKS = 1000;
const MAX_RESOURCES = 1000;
const MAX_FORMS = 100;
const MAX_META_TAGS = 200;
const MAX_INPUT_TYPES = 25;
const MAX_EVENT_HANDLER_ENTRIES = 50;
const MAX_FORM_TOKENS = 60;

/** Tags that count as a form field for the structural form model. */
const FIELD_TAGS = new Set(['input', 'select', 'textarea', 'button']);

/** Matches an inline `on*` handler attribute name. */
const EVENT_HANDLER_ATTRIBUTE = /^on[a-z]{3,20}$/;

/** A resource path that points at a source map. */
const SOURCE_MAP_PATH = /\.(?:js|css|mjs|cjs)\.map$|\.map$/i;

export interface BuildAnalyzedPageInput {
  snapshot: RawPageSnapshot;
  /** Page URL after redirects; used as the resolution base. */
  url: string;
  depth: number;
  statusCode: number | null;
  contentType: string | null;
  headers: ObservedHeaders;
  fetchedAt: Date;
  /** Byte length of the body as received. */
  htmlBytes?: number;
  bodyTruncated?: boolean;
}

export function emptyResourceCounts(): Record<ResourceType, number> {
  return {
    script: 0,
    stylesheet: 0,
    image: 0,
    font: 0,
    iframe: 0,
    media: 0,
    embed: 0,
    object: 0,
    manifest: 0,
    preload: 0,
    link: 0,
    other: 0
  };
}

export function buildAnalyzedPage(input: BuildAnalyzedPageInput): AnalyzedPage {
  const { snapshot, depth, statusCode, contentType, headers, fetchedAt } = input;

  const pageUrl = normalizeUrl(input.url) ?? input.url;
  const parsedPage = parseUrl(pageUrl);
  const pageOrigin = parsedPage ? originOf(parsedPage) : 'null';
  const protocol = parsedPage ? parsedPage.protocol.toLowerCase() : '';

  const observations: PageObservation[] = [];
  const baseUrl = resolveBaseUrl(snapshot.elements, pageUrl, observations);

  const links: PageLink[] = [];
  const resources: NormalizedResource[] = [];
  const metaTags: MetaTag[] = [];
  const formElements = new Map<number, RawElement>();
  const formFields = new Map<number, RawElement[]>();

  let inlineScriptCount = 0;
  let inlineStyleCount = 0;
  const serviceWorkerIndicators = new Set<string>();
  const storageIndicators = new Set<string>();
  const scriptMarkers = new Set<string>();

  // Indicator accumulators. Each holds catalogue ids and counts only.
  const scriptIndicators = new Map<string, PageIndicator>();
  const sensitiveApiIndicators = new Map<string, PageIndicator>();
  const sourceMapIndicators = new Map<string, PageIndicator>();
  const debugIndicators = new Map<string, PageIndicator>();
  const eventHandlers = new Map<string, InlineEventHandler>();

  for (const element of snapshot.elements) {
    collectEventHandlers(element, eventHandlers);

    switch (element.tag) {
      case 'a':
      case 'area': {
        if (links.length < MAX_LINKS) {
          const link = buildLink(element, baseUrl, pageOrigin);
          if (link) links.push(link);
        }
        break;
      }

      case 'meta': {
        if (metaTags.length < MAX_META_TAGS) {
          metaTags.push({
            name: element.attributes.name ?? null,
            property: element.attributes.property ?? null,
            httpEquiv: element.attributes['http-equiv'] ?? null,
            content: element.attributes.content ?? ''
          });
        }
        // A build pipeline sometimes leaves an environment marker in a meta
        // tag. Only the catalogue id survives the match.
        mergeIndicators(
          debugIndicators,
          countIndicators(element.attributes.content ?? '', DEBUG_PATTERNS, 'meta')
        );
        break;
      }

      case 'form': {
        if (element.formIndex !== undefined) formElements.set(element.formIndex, element);
        break;
      }

      case 'style': {
        inlineStyleCount += 1;
        break;
      }

      case 'script': {
        if (!element.attributes.src) {
          const text = element.text ?? '';
          if (text.trim()) inlineScriptCount += 1;

          for (const id of scriptMarkerIds(text)) scriptMarkers.add(id);
          collectLabels(text, SERVICE_WORKER_PATTERNS, serviceWorkerIndicators);
          collectLabels(text, STORAGE_API_PATTERNS, storageIndicators);

          mergeIndicators(scriptIndicators, countIndicators(text, DANGEROUS_DOM_PATTERNS, 'inline-script'));
          mergeIndicators(scriptIndicators, countIndicators(text, DYNAMIC_SCRIPT_PATTERNS, 'inline-script'));
          mergeIndicators(scriptIndicators, countIndicators(text, POST_MESSAGE_PATTERNS, 'inline-script'));
          mergeIndicators(
            sensitiveApiIndicators,
            countIndicators(text, SENSITIVE_API_PATTERNS, 'inline-script')
          );
          mergeIndicators(sourceMapIndicators, countIndicators(text, SOURCE_MAP_PATTERNS, 'inline-script'));
          mergeIndicators(debugIndicators, countIndicators(text, DEBUG_PATTERNS, 'inline-script'));
          // `text` goes out of scope here and is never stored on the page.
        }
        break;
      }

      default:
        break;
    }

    if (FIELD_TAGS.has(element.tag) && element.formIndex !== undefined) {
      const bucket = formFields.get(element.formIndex);
      if (bucket) bucket.push(element);
      else formFields.set(element.formIndex, [element]);
    }

    if (resources.length < MAX_RESOURCES) {
      for (const reference of referencesFromElement(element)) {
        if (resources.length >= MAX_RESOURCES) break;
        resources.push(normalizeResource(reference, baseUrl, pageOrigin));
      }
    }

    if (element.tag === 'iframe' && element.attributes.srcdoc !== undefined) {
      pushObservation(observations, {
        id: 'srcdoc-iframe',
        label: 'Inline iframe document',
        detail: 'At least one iframe supplies its document inline via srcdoc.'
      });
    }
  }

  const forms = buildForms(formElements, formFields, baseUrl, pageOrigin, pageUrl);

  collectUrlIndicators(resources, links, sourceMapIndicators, debugIndicators);

  const externalDomains = [
    ...new Set(
      resources
        .filter((resource) => resource.crossOrigin && resource.host)
        .map((resource) => resource.host as string)
    )
  ].sort();

  const protocols = [
    ...new Set(
      [
        protocol,
        ...resources.map((resource) => resource.protocol).filter((value): value is string => !!value)
      ].filter(Boolean)
    )
  ].sort();

  if (metaTags.some((meta) => (meta.httpEquiv || '').toLowerCase() === 'content-security-policy')) {
    pushObservation(observations, {
      id: 'meta-csp',
      label: 'CSP delivered in markup',
      detail:
        'A Content-Security-Policy is declared with a meta tag. Meta policies cannot express frame-ancestors, report-uri, or sandbox.'
    });
  }

  const generator = metaTags.find((meta) => (meta.name || '').toLowerCase() === 'generator');
  const technologies = detectTechnologies({
    resourceUrls: resources.flatMap((resource) => (resource.url ? [resource.url.toLowerCase()] : [])),
    resourceHosts: [
      ...new Set(resources.flatMap((resource) => (resource.host ? [resource.host.toLowerCase()] : [])))
    ],
    metaGenerator: generator && generator.content.trim() ? generator.content : null,
    headers: headers.visibility === 'readable' ? headers.values : {},
    markers: snapshot.markers ?? [],
    scriptMarkers
  });

  return {
    url: pageUrl,
    origin: pageOrigin,
    protocol,
    depth,
    fetchedAt: fetchedAt.toISOString(),
    statusCode,
    contentType,
    title: snapshot.title,
    canonicalUrl: findCanonicalUrl(snapshot.elements, baseUrl),
    metaDescription: findMetaDescription(metaTags),
    resourceCounts: countPageResources(resources),
    htmlBytes: input.htmlBytes ?? snapshot.htmlBytes,
    truncated: snapshot.truncated || input.bodyTruncated === true,
    headers,
    links,
    resources,
    forms,
    metaTags,
    externalDomains,
    protocols,
    inlineScriptCount,
    inlineStyleCount,
    serviceWorkerIndicators: [...serviceWorkerIndicators].sort(),
    storageIndicators: [...storageIndicators].sort(),
    inlineEventHandlers: [...eventHandlers.values()]
      .sort((a, b) => a.element.localeCompare(b.element) || a.attribute.localeCompare(b.attribute))
      .slice(0, MAX_EVENT_HANDLER_ENTRIES),
    scriptIndicators: sortedIndicators(scriptIndicators),
    sensitiveApiIndicators: sortedIndicators(sensitiveApiIndicators),
    sourceMapIndicators: sortedIndicators(sourceMapIndicators),
    debugIndicators: sortedIndicators(debugIndicators),
    detectedTechnologies: technologies,
    observations
  };
}

/**
 * Records inline `on*` handlers by element and attribute name.
 *
 * The scanner stores these attributes with an empty value, so the handler's
 * JavaScript never reaches this function and cannot be counted, logged, or
 * reported. Only the fact that a handler exists is retained.
 */
function collectEventHandlers(
  element: RawElement,
  into: Map<string, InlineEventHandler>
): void {
  for (const name of Object.keys(element.attributes)) {
    if (!EVENT_HANDLER_ATTRIBUTE.test(name)) continue;

    const key = `${element.tag}|${name}`;
    const existing = into.get(key);
    if (existing) {
      existing.count += 1;
    } else if (into.size < MAX_EVENT_HANDLER_ENTRIES) {
      into.set(key, { element: element.tag, attribute: name, count: 1 });
    }
  }
}

/**
 * Derives indicators from URLs the page references.
 *
 * Only the reference is examined. No resource is requested, so a source map
 * noted here is never downloaded and no original source is ever read.
 */
function collectUrlIndicators(
  resources: readonly NormalizedResource[],
  links: readonly PageLink[],
  sourceMaps: Map<string, PageIndicator>,
  debug: Map<string, PageIndicator>
): void {
  let sourceMapCount = 0;
  const internalHosts = new Set<string>();

  for (const resource of resources) {
    if (resource.url && SOURCE_MAP_PATH.test(stripQuery(resource.url))) sourceMapCount += 1;
    if (looksInternalHost(resource.host)) internalHosts.add(resource.host as string);
  }

  for (const link of links) {
    if (!link.isNavigable) continue;
    const parsed = parseUrl(link.url);
    if (parsed && looksInternalHost(parsed.hostname)) internalHosts.add(parsed.hostname);
  }

  if (sourceMapCount > 0) {
    mergeIndicators(sourceMaps, [
      { ...MARKUP_INDICATORS.sourceMapResource, occurrences: sourceMapCount, where: 'resource-url' }
    ]);
  }

  if (internalHosts.size > 0) {
    mergeIndicators(debug, [
      {
        ...MARKUP_INDICATORS.internalHostname,
        occurrences: internalHosts.size,
        where: 'resource-url',
        detail: [...internalHosts].sort().slice(0, 5).join(', ').slice(0, 200)
      }
    ]);
  }
}

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * A `<base href>` changes how every relative URL on the page resolves, so it
 * has to be honoured before any resource is normalized.
 */
function resolveBaseUrl(
  elements: readonly RawElement[],
  pageUrl: string,
  observations: PageObservation[]
): string {
  const base = elements.find((element) => element.tag === 'base' && element.attributes.href);
  if (!base) return pageUrl;

  const resolved = parseUrl(base.attributes.href, pageUrl);
  if (!resolved || !isNavigableProtocol(resolved.protocol)) return pageUrl;

  const normalized = normalizeParsedUrl(resolved);
  if (normalized !== pageUrl) {
    pushObservation(observations, {
      id: 'base-href',
      label: 'Relative URLs are rebased',
      detail: 'A <base href> element changes how relative URLs on this page resolve.'
    });
  }

  return resolved.href;
}

function buildLink(element: RawElement, baseUrl: string, pageOrigin: string): PageLink | null {
  const rawHref = element.attributes.href;
  if (!rawHref) return null;

  const parsed = parseUrl(rawHref, baseUrl);
  if (!parsed) return null;

  const navigable = isNavigableProtocol(parsed.protocol);
  const origin = originOf(parsed);

  return {
    url: normalizeParsedUrl(parsed),
    rawHref: rawHref.slice(0, 2048),
    sameOrigin: navigable && origin === pageOrigin,
    rel: element.attributes.rel ?? null,
    target: element.attributes.target ? element.attributes.target.toLowerCase() : null,
    protocol: parsed.protocol.toLowerCase(),
    isNavigable: navigable
  };
}

function buildForms(
  formElements: Map<number, RawElement>,
  formFields: Map<number, RawElement[]>,
  baseUrl: string,
  pageOrigin: string,
  pageUrl: string
): PageForm[] {
  const forms: PageForm[] = [];

  const indices = [...formElements.keys()].sort((a, b) => a - b).slice(0, MAX_FORMS);

  for (const index of indices) {
    const element = formElements.get(index);
    if (!element) continue;

    const fields = formFields.get(index) ?? [];
    const rawAction = element.attributes.action ?? null;

    // An absent or empty action submits to the current page URL.
    const actionIsImplicit = !rawAction || rawAction.trim() === '';
    const resolved = actionIsImplicit ? parseUrl(pageUrl) : parseUrl(rawAction as string, baseUrl);

    const inputTypes = new Set<string>();
    const fieldAutocomplete = new Set<string>();
    /**
     * Markup identifiers used only to classify the form. These are attribute
     * names the author chose, never anything a user typed: the scanner does
     * not capture a field `value` at all.
     */
    const fieldTokens = new Set<string>();
    let hasPasswordField = false;
    let hasFileField = false;

    for (const field of fields) {
      // Only the `type` attribute is read. A field's `value` is never captured
      // by the scanner, so it cannot leak into the model.
      const type = (field.attributes.type ?? (field.tag === 'input' ? 'text' : field.tag)).toLowerCase();
      if (inputTypes.size < MAX_INPUT_TYPES) inputTypes.add(type);
      if (type === 'password') hasPasswordField = true;
      if (type === 'file') hasFileField = true;

      const autocomplete = field.attributes.autocomplete?.trim().toLowerCase();
      if (autocomplete && fieldAutocomplete.size < MAX_INPUT_TYPES) {
        fieldAutocomplete.add(autocomplete.slice(0, 60));
      }

      for (const candidate of [field.attributes.name, field.attributes.id, autocomplete]) {
        if (candidate && fieldTokens.size < MAX_FORM_TOKENS) {
          fieldTokens.add(candidate.toLowerCase().slice(0, 80));
        }
      }
    }

    const contextTokens = [
      resolved?.pathname ?? '',
      element.attributes.id ?? '',
      element.attributes.name ?? ''
    ]
      .filter(Boolean)
      .map((token) => token.toLowerCase().slice(0, 200));

    const actionOrigin = resolved ? originOf(resolved) : null;
    const tokenList = [...fieldTokens];

    forms.push({
      action: resolved ? normalizeParsedUrl(resolved) : null,
      rawAction: rawAction ? rawAction.slice(0, 2048) : null,
      actionIsImplicit,
      method: (element.attributes.method ?? 'get').toLowerCase(),
      actionProtocol: resolved ? resolved.protocol.toLowerCase() : null,
      actionIsCrossOrigin: actionOrigin !== null && actionOrigin !== 'null' && actionOrigin !== pageOrigin,
      hasPasswordField,
      hasFileField,
      hasPaymentField: looksLikePaymentField(tokenList),
      kind: classifyForm({
        inputTypes: [...inputTypes],
        fieldTokens: tokenList,
        contextTokens
      }),
      inputTypes: [...inputTypes].sort(),
      fieldCount: fields.length,
      autocomplete: element.attributes.autocomplete ?? null,
      fieldAutocomplete: [...fieldAutocomplete].sort(),
      target: element.attributes.target ?? null
    });
    // `fieldTokens` and `contextTokens` go out of scope here. Only the
    // classification they produced is kept.
  }

  return forms;
}

/**
 * Records the *labels* of catalogue entries that matched, with no counts.
 *
 * Used for the two indicator lists the page model exposes as plain strings.
 */
function collectLabels(
  text: string,
  patterns: readonly { label: string; pattern: RegExp }[],
  into: Set<string>
): void {
  if (!text) return;
  for (const entry of patterns) {
    // `String.match` restarts at index 0, so a shared global RegExp is safe.
    if (text.match(entry.pattern)) into.add(entry.label);
  }
}

const MAX_META_DESCRIPTION = 300;

/** The canonical link target, without query or fragment, or null. */
function findCanonicalUrl(elements: readonly RawElement[], baseUrl: string): string | null {
  const link = elements.find(
    (element) =>
      element.tag === 'link' &&
      element.attributes.href &&
      (element.attributes.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')
  );
  if (!link) return null;

  const parsed = parseUrl(link.attributes.href, baseUrl);
  if (!parsed || !isNavigableProtocol(parsed.protocol)) return null;

  parsed.search = '';
  parsed.hash = '';
  return normalizeParsedUrl(parsed);
}

function findMetaDescription(metaTags: readonly MetaTag[]): string | null {
  const meta = metaTags.find((tag) => (tag.name || '').toLowerCase() === 'description');
  const text = meta?.content.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, MAX_META_DESCRIPTION) : null;
}

function countPageResources(resources: readonly NormalizedResource[]): Record<ResourceType, number> {
  const counts = emptyResourceCounts();
  for (const resource of resources) counts[resource.type] += 1;
  return counts;
}

function pushObservation(observations: PageObservation[], observation: PageObservation): void {
  if (!observations.some((existing) => existing.id === observation.id)) {
    observations.push(observation);
  }
}

/* -------------------------------------------------------------------------- */
/* Accessors used by checks                                                   */
/* -------------------------------------------------------------------------- */

export function resourcesOfType(page: AnalyzedPage, ...types: ResourceType[]): NormalizedResource[] {
  const wanted = new Set(types);
  return page.resources.filter((resource) => wanted.has(resource.type));
}

export function countResourcesByType(
  pages: readonly AnalyzedPage[]
): Record<ResourceType, number> {
  const counts = emptyResourceCounts();
  for (const page of pages) {
    for (const resource of page.resources) {
      counts[resource.type] += 1;
    }
  }
  return counts;
}

/** Same-origin links worth following during discovery. */
export function navigableSameOriginLinks(page: AnalyzedPage): PageLink[] {
  return page.links.filter((link) => link.isNavigable && link.sameOrigin);
}
