import { HashAlgorithm, HashResult } from '../types';

/**
 * Computes a cryptographic hash using native Web Crypto API (SubtleCrypto).
 */
export async function computeHash(text: string, algorithm: HashAlgorithm): Promise<HashResult> {
  if (!text) {
    return {
      algorithm,
      hex: '',
      bitLength: 0,
      byteLength: 0,
      isWeak: algorithm === 'SHA-1'
    };
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const bitLengths: Record<HashAlgorithm, number> = {
    'SHA-256': 256,
    'SHA-384': 384,
    'SHA-512': 512,
    'SHA-1': 160
  };

  return {
    algorithm,
    hex,
    bitLength: bitLengths[algorithm],
    byteLength: hashBuffer.byteLength,
    isWeak: algorithm === 'SHA-1'
  };
}
