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
    title: "JWT Decoder & Security Analyzer",
    description: "Decode and analyze JWT tokens directly in your browser. Inspect headers, payloads, claims, expiry, and common security issues without uploading your token.",
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
        heading: 'Claims in practice: exp, nbf, iat, iss, aud',
        body: '"exp", "nbf", and "iat" are NumericDate values measured in seconds since the Unix epoch. "exp" is the last moment the token may be accepted; "nbf" is the earliest; "iat" records when it was issued. "iss" identifies the issuer and "aud" identifies the intended recipient. A decoder can display these values, but only the verifying service can enforce them. A signature-valid token with a past "exp" must still be rejected.'
      },
      {
        heading: 'Common JWT security mistakes',
        body: 'Frequent mistakes include accepting "alg": "none", trusting the algorithm named in the token header without an allowlist, using a weak or shared HS256 secret, skipping "iss" and "aud" validation, issuing long-lived access tokens, storing tokens where XSS can read them, and placing sensitive data in the payload. Remember that the header and payload are only Base64URL-encoded and are readable by anyone holding the token.'
      },
      {
        heading: 'Expired tokens and clock skew',
        body: 'Expiration is enforced by the verifier, not by the browser. This analyzer can show that "exp" is in the past, but it cannot refresh or validate the token. In distributed systems, allow a small clock skew (often 30–60 seconds) between the issuer and verifier, and use short-lived access tokens with rotating refresh tokens that can be revoked server-side.'
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
        question: 'Can I decode a JWT without the secret?',
        answer: 'Yes. The header and payload are Base64URL-encoded JSON, so anyone with the token can read them without a key. The signature cannot be verified or forged without the correct secret or private key.'
      },
      {
        question: 'Is it safe to paste a JWT into this tool?',
        answer: 'Decoding happens entirely in your browser and the token is not uploaded. Still, treat any JWT as a credential: use synthetic or short-lived test tokens when possible, and avoid pasting long-lived production tokens into a shared or untrusted device.'
      },
      {
        question: 'What does the exp claim mean?',
        answer: '"exp" is the expiration time as a NumericDate in seconds since the Unix epoch. A verifier must reject the token once the current time is later than "exp", even if the signature is valid.'
      },
      {
        question: 'Why does my token show as expired?',
        answer: 'The "exp" value is in the past relative to your device clock. The token cannot be repaired by decoding it again; request a new access token from the issuer or refresh it through your normal authentication flow.'
      },
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
