/**
 * Response headers worth recording when the browser lets us see them.
 *
 * Request and response headers can carry credentials, so the transport
 * records only this fixed, security-relevant allowlist rather than everything
 * it happens to be handed.
 */
export const RECORDED_HEADERS: readonly string[] = [
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'content-type',
  'server',
  'x-powered-by',
  'cache-control',
  'access-control-allow-origin',
  'access-control-allow-credentials'
];
