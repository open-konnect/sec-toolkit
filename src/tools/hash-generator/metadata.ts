import { ToolDefinition } from '../../types';

export const hashGeneratorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'hash-generator',
  slug: 'hash-generator',
  name: "Hash Generator",
  shortDescription: 'Compute SHA-256, SHA-384, SHA-512, and SHA-1 cryptographic hashes entirely in your browser using the native Web Crypto API.',
  description: 'Generate secure message digests locally using browser-native SubtleCrypto. Fast, private, and deterministic hashing for verifying checksums, passwords, and data integrity.',
  category: 'security',
  badge: 'CSPRNG Native',
  featured: true,
  iconName: 'Hash',
  keywords: ['hash', 'hash generator', 'sha256', 'sha512', 'sha384', 'sha1', 'checksum', 'crypto.subtle', 'message digest'],
  relatedTools: ['password-strength', 'base64', 'jwt-decoder'],
  seo: {
    title: "Hash Generator — SHA-256 & SHA-512",
    description: "Generate SHA-256, SHA-384, and SHA-512 hashes directly in your browser. Verify checksums and compare digests without uploading your data.",
    canonicalPath: '/hash-generator'
  },
  educationalContent: {
    title: 'Understanding Cryptographic Hash Functions & Security',
    subtitle: 'A technical overview of one-way functions, collision resistance, and safe usage in modern engineering.',
    content: [
      {
        heading: 'What is a Cryptographic Hash Function?',
        body: 'A cryptographic hash function is a mathematical algorithm that maps an arbitrary amount of data to a fixed-size bit string (the hash value or message digest). A secure hash function is designed to be a one-way function—computationally infeasible to invert—and collision-resistant, meaning no two distinct inputs should yield the same output.'
      },
      {
        heading: 'Why Hashes Are Not Encryption',
        body: 'Encryption is a two-way operation that transforms data with a key so that anyone holding the matching key can recover the original plaintext. Hashing is strictly one-way and lossy: infinite possible inputs are mapped into a finite number of bits, making reverse decryption mathematically impossible.'
      },
      {
        heading: 'Hashing vs encoding',
        body: 'Encoding such as Base64 is reversible by anyone and is used to move data through text-only channels. Hashing is one-way and is used to compare or fingerprint data. Encryption is reversible with a key and provides confidentiality. These are different tools: do not use Base64 or a hash when you need encryption, and do not use a plain hash when you need to recover the original value.'
      },
      {
        heading: 'SHA-256, SHA-384, and SHA-512',
        body: 'SHA-256 produces a 256-bit digest (64 hex characters), SHA-384 produces 384 bits, and SHA-512 produces 512 bits. The SHA-512 family uses 64-bit words and can be faster than SHA-256 on some 64-bit processors, but SHA-256 is the most widely supported choice. Prefer the algorithm required by your protocol or platform; all three are acceptable for modern integrity checks.'
      },
      {
        heading: 'Integrity checks and common uses',
        body: 'Hashes are commonly used to verify downloaded files, detect accidental corruption, create cache keys, deduplicate content, and compare values without storing the original. For message authentication, use an HMAC with a secret key rather than a bare hash. A hash alone does not prove who created the data or that it was not replaced.'
      },
      {
        heading: 'Why MD5 and SHA-1 Are Deprecated',
        body: 'Both MD5 and SHA-1 have been broken by practical cryptographic collision attacks. Attackers can generate two different documents or certificates with identical hash digests, enabling spoofing. Modern applications should exclusively rely on SHA-2 (SHA-256, SHA-512) or SHA-3.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool upload my text to compute the hash?',
        answer: 'No. All calculations are executed by your browser engine using the standard W3C Web Cryptography API (crypto.subtle.digest). No text or hashes are ever sent across the network.'
      },
      {
        question: 'Can someone reverse a SHA-256 hash to find my original password?',
        answer: 'Cryptographic hashes cannot be mathematically reversed. However, attackers can compare a known hash against precomputed lookup tables (rainbow tables) or dictionaries. Therefore, passwords should always be hashed using salted, computationally slow algorithms like Argon2 or bcrypt rather than bare SHA-256.'
      },
      {
        question: 'Which SHA-2 algorithm should I use?',
        answer: 'SHA-256 is the safest default for compatibility and is widely supported. Use SHA-384 or SHA-512 when a protocol or compliance requirement specifies them; all three are secure for integrity checks. Never use MD5 or SHA-1 for security-sensitive purposes.'
      },
      {
        question: 'Does hashing a value encrypt it?',
        answer: 'No. A hash is a one-way fingerprint and cannot be decrypted. If you need to recover the original value later, use encryption with proper key management instead.'
      }
    ]
  }
};
