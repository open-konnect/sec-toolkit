import { UuidFormatOptions, GeneratedUuidItem } from '../types';

/**
 * Standard RFC 4122 v4 UUID validation regular expression.
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a valid RFC 4122 UUID v4.
 */
export function isValidUuidV4(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return UUID_V4_REGEX.test(uuid.trim());
}

/**
 * Generates a single cryptographically secure UUID v4 using native Web Crypto APIs.
 * Strictly uses crypto.randomUUID() or crypto.getRandomValues().
 */
export function generateSingleUuid(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);

      // Set version 4 bits: 0100xxxx
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set variant bits: 10xxxxxx
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
  }

  throw new Error('Web Cryptography API (crypto.randomUUID / crypto.getRandomValues) is required to generate secure UUIDs.');
}

/**
 * Formats a raw UUID v4 according to options.
 */
export function formatUuid(raw: string, options: UuidFormatOptions): string {
  let result = raw;
  if (!options.hyphens) {
    result = result.replace(/-/g, '');
  }
  if (options.uppercase) {
    result = result.toUpperCase();
  } else {
    result = result.toLowerCase();
  }
  return result;
}

/**
 * Generates multiple cryptographically secure UUID v4 items.
 */
export function generateBulkUuids(
  count: number,
  options: UuidFormatOptions = { uppercase: false, hyphens: true }
): GeneratedUuidItem[] {
  const safeCount = Math.min(Math.max(1, count), 500);
  const items: GeneratedUuidItem[] = [];

  for (let i = 0; i < safeCount; i++) {
    const raw = generateSingleUuid();
    items.push({
      id: raw,
      value: formatUuid(raw, options),
      version: 4
    });
  }

  return items;
}
