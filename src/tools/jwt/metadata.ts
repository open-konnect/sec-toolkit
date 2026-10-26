import { ToolDefinition } from '../../types';

export const jwtMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'jwt-decoder',
  slug: 'jwt-decoder',
  name: 'JWT Decoder & Security Analyzer',
  shortDescription: 'Decode JSON Web Tokens and perform deep client-side security audits for expired timestamps, weak algorithms, and structural risks.',
  description: 'A privacy-first, 100% client-side JWT decoder and security analyzer. Safely inspect JOSE headers, payload claims, and signatures without sending credentials over the network.',
  category: 'security',
  badge: 'Flagship Tool',
  featured: true,
  iconName: 'Shield',
  keywords: ['jwt', 'json web token', 'jwt decoder', 'jwt analyzer', 'jwt security', 'token validator', 'claims inspector'],
  relatedTools: ['jwt-generator', 'json-formatter', 'base64', 'hash-generator'],
  seo: {
    title: 'JWT Decoder & Security Analyzer — Privacy-First Token Inspector',
    description: 'Decode, inspect, and analyze JSON Web Tokens (JWT) locally in your browser. Perform automated security checks for alg:none, expiration, and key misuse without transmitting data.',
    canonicalPath: '/jwt-decoder'
  },
  educationalContent: {
    title: 'Understanding JSON Web Tokens (JWT) & Security Best Practices',
    subtitle: 'An in-depth guide to JWT compact serialization, claim semantics, cryptographic verification, and common implementation vulnerabilities.',
    content: [
      {
        heading: 'What is a JSON Web Token (JWT)?',
        body: 'JSON Web Token (RFC 7519) is an open, industry-standard method for representing claims securely between two parties. JWTs are commonly used for stateless authorization and federated authentication in modern microservices and single-page applications.'
      },
      {
        heading: 'JWT Structure: The Three Dot Segments',
        body: 'A standard compact JWT is composed of three Base64URL-encoded strings joined by periods (header.payload.signature). The header describes the signing algorithm and token type. The payload holds the claims and application data. The signature verifies the integrity of the token.',
        codeExample: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvZSBEb2UifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      },
      {
        heading: 'Critical Distinction: Decoding vs. Verifying',
        body: 'Decoding simply converts the Base64URL-encoded strings into readable JSON. It does NOT prove who issued the token or that the token has not been altered in transit. Verifying requires calculating the cryptographic signature with the matching public key or secret key and confirming that it matches the signature segment.'
      },
      {
        heading: 'Standard Registered Claims (RFC 7519)',
        body: 'Common claims include "iss" (issuer), "sub" (subject/user identifier), "aud" (audience/intended recipient), "exp" (expiration epoch), "nbf" (not before epoch), "iat" (issued at epoch), and "jti" (unique token ID to prevent replays).'
      },
      {
        heading: 'The "alg: none" Vulnerability',
        body: 'The JWT specification permits unsigned tokens when the header indicates "alg": "none". Historically, flawed validation libraries accepted unsigned tokens if an attacker changed "alg" to "none" and removed the signature, granting them unauthorized administrative privileges. Modern backends must explicitly reject "none".'
      },
      {
        heading: 'Privacy Model: Zero External Requests',
        body: 'Unlike legacy online decoders that send your tokens over public HTTP connections to third-party servers, this tool executes 100% in your browser. Your authentication tokens, API secrets, and sensitive customer identifiers never leave your device.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool send my JWT to any remote server or database?',
        answer: 'No. All parsing, base64 decoding, timestamp calculations, and security heuristics run entirely within your local browser JavaScript engine. No network requests are made with your token.'
      },
      {
        question: 'Why doesn’t this tool verify the cryptographic signature?',
        answer: 'Verifying a cryptographic signature requires either the issuer’s private/shared secret or their authoritative public key certificate (e.g. from a JWKS endpoint). Client-side tools do not have access to your private infrastructure secrets. Decoding provides visibility into payload data, while verification must be done on your trusted backend servers.'
      },
      {
        question: 'Why should I avoid symmetric algorithms like HS256 in public clients?',
        answer: 'With HS256, anyone who can verify the token must know the same secret key used to sign it. If a single client or microservice leaks this shared secret, any party can forge valid JWTs with any claim.'
      },
      {
        question: 'What is the recommended expiration time for an access token?',
        answer: 'Access tokens should be short-lived, typically between 5 and 60 minutes. Use cryptographically secure refresh tokens with server-side revocation to obtain new access tokens without requiring users to repeatedly log in.'
      }
    ]
  }
};
