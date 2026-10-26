import { JsonValidationResult } from '../types';
import { validateInputSize } from '../../../lib/security/safeParser';

/**
 * Extracts line and column number from a string given a character position.
 */
function getLineAndColumn(text: string, index: number): { line: number; column: number } {
  const safeIndex = Math.min(Math.max(0, index), text.length);
  const lines = text.slice(0, safeIndex).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

/**
 * Parses JSON error position from standard browser JSON.parse error message.
 * e.g. "Unexpected token } in JSON at position 91" or "at line 3 column 5"
 */
function extractErrorPosition(errorMsg: string, input: string): { line: number; column: number; characterIndex: number } | undefined {
  // Check "at position X"
  const posMatch = errorMsg.match(/at position (\d+)/i);
  if (posMatch) {
    const charIndex = parseInt(posMatch[1], 10);
    const loc = getLineAndColumn(input, charIndex);
    return { ...loc, characterIndex: charIndex };
  }

  // Check "line X column Y"
  const lineColMatch = errorMsg.match(/line (\d+) column (\d+)/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const col = parseInt(lineColMatch[2], 10);
    return { line, column: col, characterIndex: 0 };
  }

  return undefined;
}

/**
 * Counts total keys in a parsed JSON structure.
 */
function countKeys(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  if (Array.isArray(obj)) {
    return obj.reduce((acc, item) => acc + countKeys(item), 0);
  }
  return Object.keys(obj).reduce((acc, key) => {
    return acc + 1 + countKeys((obj as Record<string, unknown>)[key]);
  }, 0);
}

/**
 * Validates, formats, and minifies JSON safely.
 */
export function processJson(input: string, indent = 2): JsonValidationResult {
  const byteSize = new Blob([input]).size;

  if (!input || !input.trim()) {
    return {
      isValid: true,
      formatted: '',
      minified: '',
      byteSize: 0,
      keyCount: 0
    };
  }

  const sizeCheck = validateInputSize(input);
  if (!sizeCheck.valid) {
    return {
      isValid: false,
      error: sizeCheck.error,
      byteSize
    };
  }

  try {
    const parsed = JSON.parse(input);
    const formatted = JSON.stringify(parsed, null, indent);
    const minified = JSON.stringify(parsed);
    const keyCount = countKeys(parsed);

    return {
      isValid: true,
      formatted,
      minified,
      byteSize,
      keyCount
    };
  } catch (err) {
    const rawError = err instanceof Error ? err.message : 'Invalid JSON syntax';
    const location = extractErrorPosition(rawError, input);

    let friendlyError = rawError;
    if (location) {
      friendlyError = `Syntax error near line ${location.line}, column ${location.column}: ${rawError.replace(/at position \d+/i, '').trim()}`;
    }

    return {
      isValid: false,
      error: friendlyError,
      errorLocation: location,
      byteSize
    };
  }
}
