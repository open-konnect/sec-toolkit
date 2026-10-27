/**
 * Resource normalization.
 *
 * Turns a markup reference into a consistent `NormalizedResource`. Everything
 * here is derived from attributes that were already in the HTML; the engine
 * never issues a request for a resource in order to classify it.
 */

import { NormalizedResource, RawElement, ResourceType } from '../types';
import { normalizeParsedUrl, originOf, parseUrl, pathExtension } from './url';

/** Attributes retained on a resource, for reporting only. */
const REPORTED_ATTRIBUTES = [
  'as',
  'async',
  'crossorigin',
  'defer',
  'integrity',
  'loading',
  'media',
  'referrerpolicy',
  'rel',
  'sandbox',
  'type'
] as const;

const FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'bmp',
  'ico',
  'svg',
  'tif',
  'tiff'
]);
const MEDIA_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'oga',
  'flac',
  'm4a',
  'aac',
  'mp4',
  'm4v',
  'webm',
  'mov',
  'avi',
  'mkv'
]);

/**
 * Resource types a browser fetches and then *executes or applies* in the page
 * context. Mixed content in these is far more serious than in a passive asset,
 * and browsers block them outright.
 */
export const ACTIVE_RESOURCE_TYPES: ReadonlySet<ResourceType> = new Set<ResourceType>([
  'script',
  'stylesheet',
  'iframe',
  'object',
  'embed'
]);

/** A resource reference pulled out of markup, before normalization. */
export interface ResourceReference {
  /** Lowercase tag name. */
  element: string;
  /** Attribute the URL came from. */
  attribute: string;
  rawUrl: string;
  /** Whitelisted attributes of the owning element. */
  attributes: Readonly<Record<string, string>>;
}

/** Where each type of reference lives in markup. */
interface ReferenceSpec {
  attribute: string;
  type: ResourceType;
}

const TAG_REFERENCES: Record<string, ReferenceSpec[]> = {
  script: [{ attribute: 'src', type: 'script' }],
  link: [{ attribute: 'href', type: 'link' }],
  img: [
    { attribute: 'src', type: 'image' },
    { attribute: 'srcset', type: 'image' }
  ],
  source: [
    { attribute: 'src', type: 'media' },
    { attribute: 'srcset', type: 'image' }
  ],
  iframe: [{ attribute: 'src', type: 'iframe' }],
  frame: [{ attribute: 'src', type: 'iframe' }],
  embed: [{ attribute: 'src', type: 'embed' }],
  object: [{ attribute: 'data', type: 'object' }],
  video: [{ attribute: 'src', type: 'media' }],
  audio: [{ attribute: 'src', type: 'media' }],
  track: [{ attribute: 'src', type: 'media' }],
  input: [{ attribute: 'src', type: 'image' }]
};

/** Classifies a `<link>` by its `rel` and `as` attributes. */
function classifyLink(rel: string | null, asAttr: string | null): ResourceType {
  const rels = (rel || '').toLowerCase().split(/\s+/).filter(Boolean);

  if (rels.includes('stylesheet')) return 'stylesheet';
  if (rels.includes('manifest')) return 'manifest';
  if (rels.includes('icon') || rels.includes('apple-touch-icon') || rels.includes('shortcut')) {
    return 'image';
  }

  if (rels.includes('preload') || rels.includes('modulepreload') || rels.includes('prefetch')) {
    switch ((asAttr || '').toLowerCase()) {
      case 'script':
        return 'script';
      case 'style':
        return 'stylesheet';
      case 'font':
        return 'font';
      case 'image':
        return 'image';
      case 'audio':
      case 'video':
        return 'media';
      default:
        return 'preload';
    }
  }

  return 'link';
}

/** Refines a type using the file extension when markup alone is ambiguous. */
function refineByExtension(type: ResourceType, url: URL | null): ResourceType {
  if (!url) return type;

  const extension = pathExtension(url);
  if (!extension) return type;

  if (FONT_EXTENSIONS.has(extension)) return 'font';
  if (type === 'media' && IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (type === 'image' && MEDIA_EXTENSIONS.has(extension)) return 'media';

  return type;
}

/**
 * Takes the first candidate from a `srcset`.
 *
 * One entry is enough: `srcset` variants almost always share an origin and a
 * scheme, which is all the engine reads from them.
 */
export function firstSrcsetCandidate(srcset: string): string | null {
  for (const entry of srcset.split(',')) {
    const candidate = entry.trim().split(/\s+/)[0];
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Normalizes one reference against the page's base URL.
 *
 * Never throws: an unparseable reference comes back with `resolvable: false`
 * so a single piece of malformed markup cannot abort the assessment.
 */
export function normalizeResource(
  reference: ResourceReference,
  baseUrl: string,
  pageOrigin: string
): NormalizedResource {
  const rawUrl = (reference.rawUrl || '').slice(0, 2048).trim();
  const attributes = pickReportedAttributes(reference.attributes);

  const rel = reference.attributes.rel ?? null;
  const asAttr = reference.attributes.as ?? null;

  const declaredType =
    reference.element === 'link'
      ? classifyLink(rel, asAttr)
      : (TAG_REFERENCES[reference.element]?.find((spec) => spec.attribute === reference.attribute)
          ?.type ?? 'other');

  const isDataUri = /^(?:data|blob):/i.test(rawUrl);
  const parsed = isDataUri ? null : parseUrl(rawUrl, baseUrl);
  const type = refineByExtension(declaredType, parsed);

  const url = parsed ? normalizeParsedUrl(parsed) : null;
  const origin = parsed ? originOf(parsed) : null;
  const sameOrigin = origin !== null && origin !== 'null' && origin === pageOrigin;

  return {
    url,
    rawUrl,
    type,
    element: reference.element,
    attribute: reference.attribute,
    origin,
    protocol: parsed ? parsed.protocol.toLowerCase() : null,
    // A trailing dot names the same host; origins stay distinct, hosts do not.
    host: parsed ? parsed.hostname.toLowerCase().replace(/\.+$/, '') : null,
    sameOrigin,
    // A data: or unresolvable reference is neither same-origin nor
    // cross-origin; reporting it as cross-origin would be misleading.
    crossOrigin: origin !== null && origin !== 'null' && !sameOrigin,
    resolvable: parsed !== null,
    isDataUri,
    integrity: reference.attributes.integrity || null,
    crossOriginAttr: reference.attributes.crossorigin ?? null,
    referrerPolicy: reference.attributes.referrerpolicy ?? null,
    rel,
    asAttr,
    sandbox: reference.attributes.sandbox ?? null,
    attributes
  };
}

function pickReportedAttributes(
  attributes: Readonly<Record<string, string>>
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of REPORTED_ATTRIBUTES) {
    const value = attributes[name];
    if (value !== undefined) picked[name] = value;
  }
  return picked;
}

/** Pulls every resource reference out of one scanned element. */
export function referencesFromElement(element: RawElement): ResourceReference[] {
  const specs = TAG_REFERENCES[element.tag];
  if (!specs) return [];

  const references: ResourceReference[] = [];

  for (const spec of specs) {
    const raw = element.attributes[spec.attribute];
    if (!raw) continue;

    const value = spec.attribute === 'srcset' ? firstSrcsetCandidate(raw) : raw;
    if (!value) continue;

    references.push({
      element: element.tag,
      attribute: spec.attribute,
      rawUrl: value,
      attributes: element.attributes
    });
  }

  // `<img src>` and `<img srcset>` usually point at the same asset; keep one.
  if (references.length > 1) {
    const seen = new Set<string>();
    return references.filter((reference) => {
      if (seen.has(reference.rawUrl)) return false;
      seen.add(reference.rawUrl);
      return true;
    });
  }

  return references;
}

/** True for a resource the browser executes or applies in the page context. */
export function isActiveResource(resource: NormalizedResource): boolean {
  return ACTIVE_RESOURCE_TYPES.has(resource.type);
}
