/**
 * Inert HTML scanner.
 *
 * Produces a flat list of the start tags and attributes the check engine needs.
 * It is a scanner rather than a DOM parser on purpose:
 *
 * - It never builds a live document, so nothing in the target's markup can
 *   load, prefetch, or execute. Target JavaScript is matched as text only.
 * - It runs identically in a browser, in Node, and in a future server-side
 *   runner, with no `jsdom`-class dependency.
 * - Every output is bounded, so hostile markup cannot exhaust memory.
 *
 * Only the tags and attributes listed below are retained; everything else is
 * skipped as it is encountered.
 */

import { PageExtractor, RawElement, RawPageSnapshot } from '../types';

/** Caps that keep a hostile or enormous page from exhausting memory. */
export const DEFAULT_MAX_ELEMENTS = 5000;
export const DEFAULT_MAX_ATTRIBUTE_LENGTH = 2048;
export const DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT = 32;
export const DEFAULT_MAX_INLINE_TEXT_LENGTH = 32 * 1024;

/** Elements whose content is raw text and must be skipped, not scanned. */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'noscript']);

/** Elements whose raw text the engine actually needs. */
const TEXT_CAPTURE_TAGS = new Set(['script', 'title']);

/** Elements retained in the snapshot. */
const CAPTURED_TAGS = new Set([
  'a',
  'area',
  'audio',
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'iframe',
  'img',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'source',
  'style',
  'textarea',
  'title',
  'track',
  'video'
]);

/**
 * Attributes retained per element.
 *
 * `value` is deliberately absent: a form field's value may hold a credential
 * or a token, and the engine has no use for it.
 */
const CAPTURED_ATTRIBUTES = new Set([
  'action',
  'allow',
  'as',
  'async',
  'autocomplete',
  'charset',
  'content',
  'crossorigin',
  'data',
  'defer',
  'enctype',
  'formaction',
  'href',
  'http-equiv',
  'id',
  'integrity',
  'loading',
  'media',
  'method',
  'name',
  'nomodule',
  'property',
  'referrerpolicy',
  'rel',
  'sandbox',
  'src',
  'srcdoc',
  'srcset',
  'target',
  'type'
]);

/**
 * Framework markers worth noting on any element.
 *
 * Only attribute *names* and a short list of well-known `id` values are
 * recognized, and only the marker label is kept. The one value ever retained
 * is an Angular `ng-version`, and only if it is shaped like a version number.
 */
const MARKER_ATTRIBUTE_NAMES = new Set([
  'data-reactroot',
  'data-reactid',
  'ng-app',
  'ng-version',
  'data-server-rendered',
  'data-n-head',
  'data-wp-interactive'
]);

const MARKER_ATTRIBUTE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['_nghost-', 'attr:_nghost'],
  ['_ngcontent-', 'attr:_ngcontent'],
  ['data-v-', 'attr:data-v']
];

const MARKER_IDS = new Set(['__next', '__next_data__', '__nuxt', '__gatsby', 'ng-app', 'shopify-section-header']);

const VERSION_SHAPE = /^\d{1,3}(?:\.\d{1,4}){0,3}(?:-[a-z0-9.]{1,12})?$/i;

const MAX_MARKERS = 24;

function markerFor(name: string, value: string): string | null {
  if (name === 'ng-version') {
    const version = value.trim();
    return VERSION_SHAPE.test(version) ? `attr:ng-version=${version}` : 'attr:ng-version';
  }
  if (MARKER_ATTRIBUTE_NAMES.has(name)) return `attr:${name}`;
  for (const [prefix, label] of MARKER_ATTRIBUTE_PREFIXES) {
    if (name.startsWith(prefix)) return label;
  }
  if (name === 'id' && MARKER_IDS.has(value.trim().toLowerCase())) {
    return `id:${value.trim().toLowerCase()}`;
  }
  return null;
}

/**
 * Matches an inline event handler attribute such as `onclick` or `onload`.
 *
 * The handler's *value* is target JavaScript. It is never captured: only the
 * attribute name is retained, with an empty value, so a check can report that
 * inline handlers exist without the engine ever holding target code.
 */
const EVENT_HANDLER_NAME = /^on[a-z]{3,20}$/;

function isEventHandlerName(name: string): boolean {
  return EVENT_HANDLER_NAME.test(name);
}

/** True when an element carries at least one inline event handler. */
function hasEventHandler(attributes: Readonly<Record<string, string>>): boolean {
  for (const name of Object.keys(attributes)) {
    if (isEventHandlerName(name)) return true;
  }
  return false;
}

/** Void elements that never have a matching close tag. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#x27': "'",
  '#x2f': '/',
  '#47': '/'
};

export interface HtmlScanOptions {
  maxElements?: number;
  maxAttributeLength?: number;
  maxAttributesPerElement?: number;
  maxInlineTextLength?: number;
}

export interface HtmlScanResult {
  elements: RawElement[];
  title: string | null;
  /** True when a cap stopped the scan early. */
  truncated: boolean;
  /** Number of `<form>` start tags seen. */
  formCount: number;
  /** Distinct framework markers, in first-seen order. */
  markers: string[];
}

/**
 * Decodes the handful of entities that actually appear in URL attributes.
 *
 * Attribute values routinely contain `&amp;` between query parameters, which
 * would otherwise corrupt every URL the engine parses. This is not a complete
 * entity table and does not need to be: the output is treated as untrusted
 * data and is never rendered as markup.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) return value;

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    const key = entity.toLowerCase();
    const named = NAMED_ENTITIES[key];
    if (named !== undefined) return named;

    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? safeFromCodePoint(code) : match;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? safeFromCodePoint(code) : match;
    }
    return match;
  });
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function isTagNameChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '-' ||
    char === ':' ||
    char === '_'
  );
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

interface AttributeScan {
  attributes: Record<string, string>;
  markers: string[];
  selfClosing: boolean;
  /** Index just past the closing `>`. */
  next: number;
}

function scanAttributes(
  html: string,
  start: number,
  maxAttributeLength: number,
  maxAttributes: number
): AttributeScan {
  const attributes: Record<string, string> = {};
  const markers: string[] = [];
  let index = start;
  let selfClosing = false;
  let count = 0;
  const length = html.length;

  while (index < length) {
    while (index < length && isWhitespace(html[index])) index += 1;
    if (index >= length) break;

    const char = html[index];
    if (char === '>') {
      index += 1;
      break;
    }
    if (char === '/') {
      selfClosing = true;
      index += 1;
      continue;
    }

    // Attribute name.
    const nameStart = index;
    while (index < length) {
      const current = html[index];
      if (isWhitespace(current) || current === '=' || current === '>' || current === '/') break;
      index += 1;
    }

    if (index === nameStart) {
      // Nothing consumed (a stray character such as `"`); skip it so the loop
      // always makes progress and can never spin.
      index += 1;
      continue;
    }

    const name = html.slice(nameStart, index).toLowerCase();

    // Optional `= value`.
    let value = '';
    let cursor = index;
    while (cursor < length && isWhitespace(html[cursor])) cursor += 1;

    if (html[cursor] === '=') {
      cursor += 1;
      while (cursor < length && isWhitespace(html[cursor])) cursor += 1;

      const quote = html[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const end = html.indexOf(quote, cursor);
        if (end === -1) {
          value = html.slice(cursor);
          cursor = length;
        } else {
          value = html.slice(cursor, end);
          cursor = end + 1;
        }
      } else {
        const valueStart = cursor;
        while (cursor < length && !isWhitespace(html[cursor]) && html[cursor] !== '>') cursor += 1;
        value = html.slice(valueStart, cursor);
      }
      index = cursor;
    }

    count += 1;
    if (count <= maxAttributes) {
      const marker = markerFor(name, value);
      if (marker) markers.push(marker);
    }
    if (count <= maxAttributes && !(name in attributes)) {
      if (CAPTURED_ATTRIBUTES.has(name)) {
        attributes[name] = decodeHtmlEntities(value).slice(0, maxAttributeLength).trim();
      } else if (isEventHandlerName(name)) {
        // Name only. The handler body is target code and is dropped here.
        attributes[name] = '';
      }
    }
  }

  return { attributes, markers, selfClosing, next: index };
}

/** Finds the end of a raw-text element and returns its text plus the cursor. */
function scanRawText(html: string, start: number, tag: string): { text: string; next: number } {
  const lower = html.toLowerCase();
  const closeTag = `</${tag}`;
  let searchFrom = start;

  while (searchFrom <= html.length) {
    const found = lower.indexOf(closeTag, searchFrom);
    if (found === -1) {
      return { text: html.slice(start), next: html.length };
    }

    // `</scriptfoo>` is not a close tag; the next char must end the name.
    const after = lower[found + closeTag.length];
    if (after === undefined || after === '>' || isWhitespace(after) || after === '/') {
      const close = html.indexOf('>', found);
      return {
        text: html.slice(start, found),
        next: close === -1 ? html.length : close + 1
      };
    }
    searchFrom = found + closeTag.length;
  }

  return { text: html.slice(start), next: html.length };
}

/**
 * Scans markup into a flat element list.
 *
 * Handles comments, doctypes, processing instructions, CDATA, quoted and
 * unquoted attributes, self-closing tags, void elements, and raw-text
 * elements. Malformed markup degrades to fewer elements rather than throwing.
 */
export function scanHtml(html: string, options: HtmlScanOptions = {}): HtmlScanResult {
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const maxAttributeLength = options.maxAttributeLength ?? DEFAULT_MAX_ATTRIBUTE_LENGTH;
  const maxAttributes = options.maxAttributesPerElement ?? DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT;
  const maxInlineText = options.maxInlineTextLength ?? DEFAULT_MAX_INLINE_TEXT_LENGTH;

  const elements: RawElement[] = [];
  let title: string | null = null;
  let truncated = false;
  let formCount = 0;
  const markers = new Set<string>();
  /** Stack of open `<form>` indices; HTML forbids nesting but markup lies. */
  const formStack: number[] = [];

  if (typeof html !== 'string' || !html) {
    return { elements, title, truncated, formCount, markers: [] };
  }

  let index = 0;
  const length = html.length;

  while (index < length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    index = open + 1;
    if (index >= length) break;

    // Comment.
    if (html.startsWith('!--', index)) {
      const end = html.indexOf('-->', index + 3);
      index = end === -1 ? length : end + 3;
      continue;
    }

    // Doctype, CDATA, or processing instruction.
    if (html[index] === '!' || html[index] === '?') {
      const end = html.indexOf('>', index);
      index = end === -1 ? length : end + 1;
      continue;
    }

    const isClosing = html[index] === '/';
    if (isClosing) index += 1;

    const nameStart = index;
    while (index < length && isTagNameChar(html[index])) index += 1;
    const tag = html.slice(nameStart, index).toLowerCase();

    if (!tag) continue;

    if (isClosing) {
      const end = html.indexOf('>', index);
      index = end === -1 ? length : end + 1;
      if (tag === 'form') formStack.pop();
      continue;
    }

    const scan = scanAttributes(html, index, maxAttributeLength, maxAttributes);
    index = scan.next;

    for (const marker of scan.markers) {
      if (markers.size < MAX_MARKERS) markers.add(marker);
    }

    const isVoid = VOID_TAGS.has(tag);
    let text: string | undefined;

    if (RAW_TEXT_TAGS.has(tag) && !scan.selfClosing && !isVoid) {
      const raw = scanRawText(html, index, tag);
      index = raw.next;
      if (TEXT_CAPTURE_TAGS.has(tag)) {
        text = raw.text.slice(0, maxInlineText);
      }
    }

    if (tag === 'title' && title === null && text) {
      title = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim().slice(0, 300) || null;
    }

    // An element is retained when the engine needs the tag itself, or when it
    // carries an inline event handler — which can appear on any element at
    // all, so the tag allowlist alone would miss most of them.
    if (!CAPTURED_TAGS.has(tag) && !hasEventHandler(scan.attributes)) continue;

    if (elements.length >= maxElements) {
      truncated = true;
      break;
    }

    const element: RawElement = { tag, attributes: scan.attributes };
    if (text !== undefined) element.text = text;

    // A `<form>` carries its own index; any other element carries the index of
    // the form it sits inside, which is how fields are matched to their form.
    const enclosingForm = tag === 'form' ? formCount : formStack[formStack.length - 1];
    if (enclosingForm !== undefined) element.formIndex = enclosingForm;

    elements.push(element);

    if (tag === 'form' && !scan.selfClosing) {
      formStack.push(formCount);
      formCount += 1;
    } else if (tag === 'form') {
      formCount += 1;
    }
  }

  return { elements, title, truncated, formCount, markers: [...markers] };
}

/**
 * The default `PageExtractor`.
 *
 * Swapping in a DOM-based extractor later only means implementing this
 * interface; no check, aggregation, scoring, or UI code changes.
 */
export function createHtmlScannerExtractor(options: HtmlScanOptions = {}): PageExtractor {
  return {
    id: 'html-scanner',
    extract(html: string, pageUrl: string): RawPageSnapshot {
      const result = scanHtml(html, options);
      return {
        url: pageUrl,
        elements: result.elements,
        title: result.title,
        htmlBytes: typeof html === 'string' ? html.length : 0,
        truncated: result.truncated,
        formCount: result.formCount,
        markers: result.markers
      };
    }
  };
}
