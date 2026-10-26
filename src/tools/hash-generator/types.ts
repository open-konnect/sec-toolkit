export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1';

export interface HashResult {
  algorithm: HashAlgorithm;
  hex: string;
  bitLength: number;
  byteLength: number;
  isWeak?: boolean;
}
