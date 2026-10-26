import { ParsedJwt, JwtHeader, JwtPayload } from '../types';
import { safeBase64Decode, safeJsonParse, validateInputSize } from '../../../lib/security/safeParser';

/**
 * Parses a standard compact JWT string (header.payload.signature) safely.
 * Returns decoded objects or precise parsing error without throwing exceptions.
 */
export function parseJwt(token: string): ParsedJwt {
  const trimmed = token.trim();

  const emptyResult: ParsedJwt = {
    raw: trimmed,
    segments: { rawHeader: '', rawPayload: '', rawSignature: '' },
    header: null,
    payload: null,
    hasSignature: false,
    isValidStructure: false
  };

  if (!trimmed) {
    return emptyResult;
  }

  // 1. Guard against oversized payloads causing browser hang
  const sizeValidation = validateInputSize(trimmed);
  if (!sizeValidation.valid) {
    return {
      ...emptyResult,
      parseError: sizeValidation.error
    };
  }

  // 2. Split compact serialization by '.'
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return {
      ...emptyResult,
      parseError: `JWT compact serialization must contain exactly 3 segments separated by dots (header.payload.signature). Found ${parts.length} segment${parts.length === 1 ? '' : 's'}.`
    };
  }

  const [rawHeader, rawPayload, rawSignature] = parts;
  const hasSignature = rawSignature.length > 0;

  // 3. Decode & Parse Header
  const headerDecoded = safeBase64Decode(rawHeader, true);
  if (!headerDecoded.success || !headerDecoded.data) {
    return {
      ...emptyResult,
      segments: { rawHeader, rawPayload, rawSignature },
      hasSignature,
      parseError: `Header segment is not valid Base64URL: ${headerDecoded.error || 'Failed to decode'}`
    };
  }

  const headerParsed = safeJsonParse<JwtHeader>(headerDecoded.data);
  if (!headerParsed.success || !headerParsed.data) {
    return {
      ...emptyResult,
      segments: { rawHeader, rawPayload, rawSignature },
      hasSignature,
      parseError: `Header JSON is invalid: ${headerParsed.error || 'Syntax error'}`
    };
  }

  // 4. Decode & Parse Payload
  const payloadDecoded = safeBase64Decode(rawPayload, true);
  if (!payloadDecoded.success || !payloadDecoded.data) {
    return {
      ...emptyResult,
      segments: { rawHeader, rawPayload, rawSignature },
      header: headerParsed.data,
      hasSignature,
      parseError: `Payload segment is not valid Base64URL: ${payloadDecoded.error || 'Failed to decode'}`
    };
  }

  const payloadParsed = safeJsonParse<JwtPayload>(payloadDecoded.data);
  if (!payloadParsed.success || !payloadParsed.data) {
    return {
      ...emptyResult,
      segments: { rawHeader, rawPayload, rawSignature },
      header: headerParsed.data,
      hasSignature,
      parseError: `Payload JSON is invalid: ${payloadParsed.error || 'Syntax error'}`
    };
  }

  return {
    raw: trimmed,
    segments: { rawHeader, rawPayload, rawSignature },
    header: headerParsed.data,
    payload: payloadParsed.data,
    hasSignature,
    isValidStructure: true
  };
}
