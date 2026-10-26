/**
 * Safe string and parsing utilities for privacy-first browser utilities.
 * Ensures malformed or hostile input never crashes the application.
 */

export const MAX_SAFE_INPUT_LENGTH = 1024 * 512; // 512 KB safe limit for instant browser parsing

export interface SafeParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Validates input string size before expensive parsing.
 */
export function validateInputSize(input: string, maxBytes = MAX_SAFE_INPUT_LENGTH): { valid: boolean; error?: string } {
  const byteSize = new Blob([input]).size;
  if (byteSize > maxBytes) {
    const kbLimit = Math.round(maxBytes / 1024);
    const actualKb = Math.round(byteSize / 1024);
    return {
      valid: false,
      error: `Input size (${actualKb} KB) exceeds the maximum client-side limit of ${kbLimit} KB.`
    };
  }
  return { valid: true };
}

/**
 * Safely parses JSON string without throwing.
 */
export function safeJsonParse<T = Record<string, unknown>>(input: string): SafeParseResult<T> {
  if (!input || !input.trim()) {
    return { success: false, data: null, error: 'Input is empty.' };
  }

  try {
    const data = JSON.parse(input) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON syntax';
    return { success: false, data: null, error: message };
  }
}

/**
 * Safely formats JSON with indentation.
 */
export function safeJsonStringify(data: unknown, indent = 2): string {
  try {
    return JSON.stringify(data, null, indent);
  } catch {
    return String(data);
  }
}

/**
 * Normalizes a Base64URL string to standard Base64 by:
 * - Replacing '-' with '+'
 * - Replacing '_' with '/'
 * - Appending appropriate '=' padding
 */
export function base64UrlToBase64(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64;
}

/**
 * Converts standard Base64 to Base64URL (no padding, url-safe chars).
 */
export function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Safely decodes a standard Base64 or Base64URL string into UTF-8 text using native browser APIs.
 */
export function safeBase64Decode(encoded: string, isUrlSafe = false): SafeParseResult<string> {
  if (!encoded || !encoded.trim()) {
    return { success: false, data: null, error: 'Input is empty.' };
  }

  try {
    let clean = encoded.trim();
    if (isUrlSafe || clean.includes('-') || clean.includes('_')) {
      clean = base64UrlToBase64(clean);
    }

    // atob gives binary string
    const binaryString = atob(clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode as UTF-8
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = decoder.decode(bytes);

    return { success: true, data: decoded };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to decode Base64 string';
    return {
      success: false,
      data: null,
      error: `Invalid Base64 sequence: ${message}`
    };
  }
}

/**
 * Safely encodes a UTF-8 string to standard Base64 or Base64URL.
 */
export function safeBase64Encode(text: string, toUrlSafe = false): SafeParseResult<string> {
  if (text === '') {
    return { success: true, data: '' };
  }

  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    
    // Convert bytes to binary string in safe chunks
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode(...chunk);
    }

    const base64 = btoa(binary);
    return {
      success: true,
      data: toUrlSafe ? base64ToBase64Url(base64) : base64
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encoding error';
    return { success: false, data: null, error: message };
  }
}
