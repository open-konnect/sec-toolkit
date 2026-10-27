/**
 * Text safety and identifiers for the report layer.
 *
 * Everything the report shows about a target — URLs, hostnames, page titles —
 * is untrusted. The UI only ever renders it as React text nodes or as canvas
 * labels, never as markup. These helpers add a second layer: they strip
 * characters that can reorder or hide text (bidirectional overrides,
 * zero-width characters, control characters) and bound length.
 */

/** C0/C1 controls, bidi embeddings/overrides/isolates, zero-width and BOM. */
const UNSAFE_TEXT = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

export function safeText(raw: unknown, maxLength = 200): string {
  if (raw === null || raw === undefined) return '';
  const value = String(raw)
    .slice(0, maxLength * 4)
    // Whitespace first, so a newline separates words rather than joining them.
    .replace(/\s+/g, ' ')
    .replace(UNSAFE_TEXT, '')
    .trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

/** Shortens a URL for a graph label, keeping the end of the path readable. */
export function shortLabel(raw: string, maxLength = 32): string {
  const value = safeText(raw, 400).replace(/^https?:\/\//i, '');
  if (value.length <= maxLength) return value;
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/** 53-bit string hash (cyrb53). Deterministic across runs and platforms. */
function hash53(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * A stable identifier derived from a key: the same key always yields the same
 * id, and ids never contain target-derived text.
 */
export function stableId(prefix: 'pg' | 'rs' | 'dm' | 'fd', key: string): string {
  return `${prefix}-${hash53(key).toString(36)}`;
}
