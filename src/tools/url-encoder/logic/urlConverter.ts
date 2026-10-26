import { UrlConversionResult, UrlMode, UrlScope } from '../types';
import { validateInputSize } from '../../../lib/security/safeParser';

/**
 * Encodes or decodes a URL string using either full URI or URI Component scope.
 */
export function convertUrl(input: string, mode: UrlMode, scope: UrlScope): UrlConversionResult {
  const inputLength = input.length;

  if (!input) {
    return {
      output: '',
      success: true,
      inputLength: 0,
      outputLength: 0
    };
  }

  const sizeCheck = validateInputSize(input);
  if (!sizeCheck.valid) {
    return {
      output: '',
      success: false,
      error: sizeCheck.error,
      inputLength,
      outputLength: 0
    };
  }

  try {
    let output = '';
    if (mode === 'encode') {
      output = scope === 'component' ? encodeURIComponent(input) : encodeURI(input);
    } else {
      // Decode mode: replace '+' with space if used as form URL-encoded space
      const sanitized = input.replace(/\+/g, '%20');
      output = scope === 'component' ? decodeURIComponent(sanitized) : decodeURI(sanitized);
    }

    return {
      output,
      success: true,
      inputLength,
      outputLength: output.length
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid percent-encoded sequence';
    return {
      output: '',
      success: false,
      error: `URI Decoding Error: ${message}. Check for incomplete '%' sequences.`,
      inputLength,
      outputLength: 0
    };
  }
}
