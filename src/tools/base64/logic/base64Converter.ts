import { Base64ConvertOptions, Base64Result } from '../types';
import { safeBase64Decode, safeBase64Encode, validateInputSize } from '../../../lib/security/safeParser';

/**
 * Converts text using Base64 or Base64URL encoding/decoding with full UTF-8 support.
 */
export function convertBase64(input: string, options: Base64ConvertOptions): Base64Result {
  const inputBytes = new Blob([input]).size;

  if (!input) {
    return {
      output: '',
      success: true,
      inputBytes: 0,
      outputBytes: 0
    };
  }

  // Size limit safety check
  const sizeCheck = validateInputSize(input);
  if (!sizeCheck.valid) {
    return {
      output: '',
      success: false,
      error: sizeCheck.error,
      inputBytes,
      outputBytes: 0
    };
  }

  const isUrlSafe = options.variant === 'urlSafe';

  if (options.mode === 'encode') {
    const encoded = safeBase64Encode(input, isUrlSafe);
    if (!encoded.success || encoded.data === null) {
      return {
        output: '',
        success: false,
        error: encoded.error || 'Failed to encode input to Base64',
        inputBytes,
        outputBytes: 0
      };
    }

    return {
      output: encoded.data,
      success: true,
      inputBytes,
      outputBytes: new Blob([encoded.data]).size
    };
  } else {
    // Decode mode
    // Strip common whitespace/newlines that occur when copying base64 strings
    const sanitizedInput = input.trim().replace(/\s+/g, '');
    const decoded = safeBase64Decode(sanitizedInput, isUrlSafe);

    if (!decoded.success || decoded.data === null) {
      return {
        output: '',
        success: false,
        error: decoded.error || 'Malformed Base64 input string',
        inputBytes,
        outputBytes: 0
      };
    }

    return {
      output: decoded.data,
      success: true,
      inputBytes,
      outputBytes: new Blob([decoded.data]).size
    };
  }
}
