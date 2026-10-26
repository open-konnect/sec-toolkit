import { JwtGenerateParams, JwtGenerateResult } from '../types';
import { safeBase64Encode, base64ToBase64Url } from '../../../lib/security/safeParser';

const HASH_MAP: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
};

/**
 * Signs and generates a JWT compact token entirely in the browser using Web Crypto API.
 */
export async function generateJwt(params: JwtGenerateParams): Promise<JwtGenerateResult> {
  const { algorithm, headerJson, payloadJson, secret } = params;

  // 1. Validate JSON syntax
  try {
    JSON.parse(headerJson);
  } catch (err) {
    return {
      token: '',
      success: false,
      error: `Invalid Header JSON: ${(err as Error).message}`,
      headerEncoded: '',
      payloadEncoded: '',
      signatureEncoded: ''
    };
  }

  try {
    JSON.parse(payloadJson);
  } catch (err) {
    return {
      token: '',
      success: false,
      error: `Invalid Payload JSON: ${(err as Error).message}`,
      headerEncoded: '',
      payloadEncoded: '',
      signatureEncoded: ''
    };
  }

  // 2. Base64URL encode header and payload
  const headerEncoded = safeBase64Encode(headerJson.trim(), true).data || '';
  const payloadEncoded = safeBase64Encode(payloadJson.trim(), true).data || '';
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  // 3. Handle unsigned "none" algorithm
  if (algorithm === 'none') {
    return {
      token: `${signingInput}.`,
      success: true,
      headerEncoded,
      payloadEncoded,
      signatureEncoded: ''
    };
  }

  // 4. HMAC Sign with Web Crypto
  const hashName = HASH_MAP[algorithm];
  if (!hashName) {
    return {
      token: '',
      success: false,
      error: `Unsupported algorithm "${algorithm}"`,
      headerEncoded,
      payloadEncoded,
      signatureEncoded: ''
    };
  }

  try {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret || 'default-secret-key-change-me');
    const inputBytes = encoder.encode(signingInput);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: { name: hashName } },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, inputBytes);
    const signatureBytes = new Uint8Array(signatureBuffer);

    // Convert to binary string in chunks
    let binary = '';
    const len = signatureBytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
      binary += String.fromCharCode(...signatureBytes.subarray(i, Math.min(i + 8192, len)));
    }
    const signatureEncoded = base64ToBase64Url(btoa(binary));

    return {
      token: `${signingInput}.${signatureEncoded}`,
      success: true,
      headerEncoded,
      payloadEncoded,
      signatureEncoded
    };
  } catch (err) {
    return {
      token: '',
      success: false,
      error: `Signing failed: ${(err as Error).message}`,
      headerEncoded,
      payloadEncoded,
      signatureEncoded: ''
    };
  }
}
