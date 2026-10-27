/**
 * Parses response headers the user pasted in (`curl -I` output, DevTools
 * "copy response headers", a raw header block).
 *
 * Only the fixed security-relevant allowlist the live transport records is
 * kept. Everything else — notably Set-Cookie and Authorization — is dropped
 * at the door, so it can never reach a finding.
 */

import { RECORDED_HEADERS } from './recordedHeaders';

const MAX_INPUT_CHARS = 64 * 1024;
const MAX_VALUE_CHARS = 2048;
const ALLOWED = new Set(RECORDED_HEADERS);

export function parseHeaderBlock(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  let current: string | null = null;

  for (const line of raw.slice(0, MAX_INPUT_CHARS).split(/\r?\n/)) {
    // Obsolete line folding: a leading space continues the previous header.
    if (/^[ \t]+\S/.test(line) && current && values[current] !== undefined) {
      values[current] = (values[current] + ' ' + line.trim()).slice(0, MAX_VALUE_CHARS);
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0 || /^HTTP\//i.test(line)) {
      current = null;
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(name) || !ALLOWED.has(name)) {
      current = null;
      continue;
    }
    const value = line.slice(colon + 1).trim().slice(0, MAX_VALUE_CHARS);
    // Repeated headers combine with a comma, as HTTP defines.
    values[name] = values[name] !== undefined ? `${values[name]}, ${value}`.slice(0, MAX_VALUE_CHARS) : value;
    current = name;
  }
  return values;
}
