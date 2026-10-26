import { ToolDefinition } from '../../types';

export const hashGeneratorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'hash-generator',
  slug: 'hash-generator',
  name: 'Cryptographic Hash Generator',
  shortDescription: 'Compute SHA-256, SHA-384, SHA-512, and SHA-1 cryptographic hashes entirely in your browser using the native Web Crypto API.',
  description: 'Generate secure message digests locally using browser-native SubtleCrypto. Fast, private, and deterministic hashing for verifying checksums, passwords, and data integrity.',
  category: 'security',
  badge: 'CSPRNG Native',
  featured: true,
  iconName: 'Hash',
  keywords: ['hash', 'hash generator', 'sha256', 'sha512', 'sha384', 'sha1', 'checksum', 'crypto.subtle', 'message digest'],
  relatedTools: ['password-strength', 'base64', 'jwt-decoder'],
  seo: {
    title: 'Hash Generator — Free SHA-256, SHA-512 & SHA-384 Calculator',
    description: 'Generate cryptographic hash digests (SHA-256, SHA-512, SHA-384) directly in your browser with zero data transmitted over the network.',
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
      }
    ]
  }
};
