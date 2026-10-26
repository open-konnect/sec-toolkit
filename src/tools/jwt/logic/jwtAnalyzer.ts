import { ParsedJwt, JwtAnalysisResult } from '../types';
import { SecurityFindingData } from '../../../components/tool/SecurityFinding';
import { formatUnixTimestamp } from '../../../lib/formatting/timestamp';

/**
 * Analyzes a parsed or malformed JWT and produces actionable security findings.
 * Follows the strict 3-part format: What was detected, Why it matters, What to do.
 */
export function analyzeJwt(parsed: ParsedJwt): JwtAnalysisResult {
  const findings: SecurityFindingData[] = [];

  // Case 1: Empty input
  if (!parsed.raw) {
    return {
      parsed,
      findings: [],
      overallStatus: 'empty'
    };
  }

  // Case 2: Structural/Parsing failure
  if (!parsed.isValidStructure) {
    findings.push({
      id: 'malformed-jwt',
      title: 'Malformed JWT Structure',
      severity: 'critical',
      what: parsed.parseError || 'The token does not match standard JWT compact serialization (header.payload.signature).',
      why: 'Applications expecting standard RFC 7519 tokens will reject this token or throw unhandled parsing exceptions.',
      recommendation: 'Verify the token generation source. Ensure headers, payloads, and signatures are Base64URL encoded without whitespace, line breaks, or missing dot delimiters.'
    });

    return {
      parsed,
      findings,
      overallStatus: 'invalid_structure'
    };
  }

  const header = parsed.header || {};
  const payload = parsed.payload || {};
  const nowInSeconds = Math.floor(Date.now() / 1000);

  // --- 1. Algorithm & Signature Checks ---
  const rawAlg = header.alg;
  const alg = typeof rawAlg === 'string' ? rawAlg.trim() : undefined;

  if (!alg) {
    findings.push({
      id: 'missing-alg',
      title: 'Missing "alg" Header Claim',
      severity: 'critical',
      what: 'The JOSE header does not declare an "alg" (algorithm) parameter.',
      why: 'Without a specified algorithm, verifying libraries cannot determine how to validate the token, often leading to insecure fallback logic or complete rejection.',
      recommendation: 'Ensure your token issuer explicitly declares an accepted algorithm (such as RS256, ES256, or EdDSA).'
    });
  } else if (alg.toLowerCase() === 'none') {
    findings.push({
      id: 'alg-none',
      title: 'Unsecured JWT ("alg": "none")',
      severity: 'critical',
      what: 'The token specifies "alg": "none", indicating an unsecured JWT with no cryptographic signature.',
      why: 'Tokens with "alg": "none" allow anyone to modify claims without being detected. This is a notorious vulnerability (CVE-2015-9235 and similar) where attackers strip signatures to forge admin identities.',
      recommendation: 'Reject "alg": "none" tokens in backend verification logic. Mandate strong asymmetric or symmetric cryptographic verification.',
      codeSnippet: '// Backend verification guard\nif (decodedHeader.alg === "none") {\n  throw new UnauthorizedException("Unsecured tokens are strictly prohibited.");\n}'
    });
  } else {
    // Check if algorithm is considered legacy/symmetric
    if (alg.toUpperCase() === 'HS256' || alg.toUpperCase() === 'HS384' || alg.toUpperCase() === 'HS512') {
      findings.push({
        id: 'symmetric-alg',
        title: `Symmetric Algorithm in Use (${alg})`,
        severity: 'low',
        what: `The token uses HMAC with SHA (${alg}), a symmetric cryptographic algorithm.`,
        why: 'Symmetric algorithms require both the issuer and every verifying service to share the identical secret key. If any verifying microservice is compromised, an attacker can forge arbitrary valid tokens.',
        recommendation: 'Ensure the secret has high entropy (at least 256 bits). In distributed microservice environments, prefer asymmetric signing (RS256, ES256, or EdDSA) where consumers only need the public key.'
      });
    }
  }

  // Signature segment check
  if (alg && alg.toLowerCase() !== 'none' && !parsed.hasSignature) {
    findings.push({
      id: 'missing-signature-segment',
      title: 'Missing Cryptographic Signature',
      severity: 'high',
      what: `The header specifies algorithm "${alg}", but the 3rd segment (signature) is empty.`,
      why: 'A signed token without a signature payload cannot be verified by any compliant validator and is likely truncated or forged.',
      recommendation: 'Check why the signature segment was truncated. Never process unsigned tokens when an algorithm is expected.'
    });
  } else if (parsed.hasSignature) {
    // Core Educational & Safety Distinction: Unverified Signature notice
    findings.push({
      id: 'unverified-signature-notice',
      title: 'Signature Not Verified (Client-Side Decoder Notice)',
      severity: 'info',
      what: 'A cryptographic signature is present in the token, but this tool has only decoded the claims.',
      why: 'Decoding a JWT simply reads base64url data and does not prove the token was issued by a trusted party or that claims were not tampered with.',
      recommendation: 'Cryptographic verification must be performed by your server or API gateway using the issuer’s public key or secret key before trusting any claim in this token.'
    });
  }

  // --- 2. Expiration (exp) Checks ---
  if (payload.exp === undefined) {
    findings.push({
      id: 'missing-exp',
      title: 'No Expiration Time ("exp") Defined',
      severity: 'high',
      what: 'The payload does not contain an "exp" (expiration time) claim.',
      why: 'Tokens without expiration remain valid forever unless an active revocation list is checked on every request. If intercepted, an attacker can use this token indefinitely.',
      recommendation: 'Always set a reasonable expiration time ("exp") when issuing tokens, preferably minutes to hours for access tokens.'
    });
  } else if (typeof payload.exp !== 'number') {
    findings.push({
      id: 'invalid-exp-type',
      title: 'Invalid "exp" Claim Type',
      severity: 'high',
      what: `The "exp" claim value is of type "${typeof payload.exp}" instead of a numeric Unix epoch timestamp.`,
      why: 'Standard JWT libraries (RFC 7519) require "exp" to be a NumericDate. Non-numeric values will fail validation or cause evaluation bugs.',
      recommendation: 'Encode "exp" as an integer representing seconds since Unix epoch (1970-01-01T00:00:00Z).'
    });
  } else {
    const expInfo = formatUnixTimestamp(payload.exp);
    if (payload.exp < nowInSeconds) {
      findings.push({
        id: 'token-expired',
        title: 'Token is Expired',
        severity: 'medium',
        what: `The token expired on ${expInfo?.utcString || payload.exp} (${expInfo?.relative || 'in the past'}).`,
        why: 'An expired token must not be accepted for authenticated operations by API endpoints.',
        recommendation: 'Request a fresh token using standard refresh token flows or prompt the user to re-authenticate.'
      });
    } else {
      // Check for unusually long lifetime (> 365 days)
      const secondsUntilExp = payload.exp - nowInSeconds;
      const oneYearSeconds = 365 * 24 * 60 * 60;
      if (secondsUntilExp > oneYearSeconds) {
        findings.push({
          id: 'long-lived-token',
          title: 'Unusually Long Token Lifetime',
          severity: 'low',
          what: `The token does not expire until ${expInfo?.utcString} (${expInfo?.relative}). This exceeds 1 year.`,
          why: 'Long-lived access tokens dramatically expand the window of vulnerability if the token is leaked or intercepted.',
          recommendation: 'Use short-lived access tokens (e.g., 15 minutes to 24 hours) combined with secure refresh token rotation.'
        });
      }
    }
  }

  // --- 3. Not Before (nbf) Checks ---
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number') {
      findings.push({
        id: 'invalid-nbf-type',
        title: 'Invalid "nbf" Claim Type',
        severity: 'medium',
        what: `The "nbf" claim value is "${typeof payload.nbf}" instead of a numeric Unix timestamp.`,
        why: 'RFC 7519 requires "nbf" (Not Before) to be a NumericDate.',
        recommendation: 'Set "nbf" to a numeric Unix timestamp in seconds.'
      });
    } else if (payload.nbf > nowInSeconds) {
      const nbfInfo = formatUnixTimestamp(payload.nbf);
      findings.push({
        id: 'future-nbf',
        title: 'Token Not Yet Active ("nbf" in future)',
        severity: 'medium',
        what: `The "nbf" (Not Before) claim is set to ${nbfInfo?.utcString || payload.nbf} (${nbfInfo?.relative}).`,
        why: 'The token must not be accepted prior to this time. If accepted now, this violates the issuer’s activation constraints.',
        recommendation: 'Verify system clocks are synchronized via NTP. Do not accept this token until the specified time has elapsed.'
      });
    }
  }

  // --- 4. Issued At (iat) Checks ---
  if (payload.iat === undefined) {
    findings.push({
      id: 'missing-iat',
      title: 'Missing "iat" (Issued At) Claim',
      severity: 'info',
      what: 'The payload does not specify when the token was issued.',
      why: 'Without "iat", systems cannot determine token age or verify whether a token was issued before a user changed their password or revoked sessions.',
      recommendation: 'Include standard "iat" claim with the current epoch timestamp upon generation.'
    });
  } else if (typeof payload.iat === 'number' && payload.iat > nowInSeconds + 300) {
    // 5 minutes clock skew tolerance
    const iatInfo = formatUnixTimestamp(payload.iat);
    findings.push({
      id: 'future-iat',
      title: '"iat" (Issued At) is in the Future',
      severity: 'low',
      what: `The "iat" claim is set to ${iatInfo?.utcString || payload.iat}, which is in the future.`,
      why: 'This usually indicates clock drift between the server that issued the token and this machine, or a misconfigured timestamp.',
      recommendation: 'Ensure NTP clock synchronization is enabled on your authentication servers.'
    });
  }

  // --- 5. Subject & Issuer Checks ---
  if (!payload.sub && !payload.iss) {
    findings.push({
      id: 'missing-identity-claims',
      title: 'Missing "sub" and "iss" Claims',
      severity: 'info',
      what: 'The token payload contains neither a subject ("sub") nor an issuer ("iss").',
      why: 'Standard tokens usually identify who issued the token ("iss") and the identity or principal it represents ("sub").',
      recommendation: 'Include "iss" and "sub" where appropriate to clarify token provenance and principal authority.'
    });
  }

  return {
    parsed,
    findings,
    overallStatus: 'valid_structure'
  };
}
