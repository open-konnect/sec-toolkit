/**
 * Central check registry.
 *
 * Adding a check means appending it here and nowhere else: discovery,
 * execution, aggregation, scoring, coverage, and the report UI are all driven
 * from this list. Check IDs are stable and are part of the tool's contract —
 * they appear in finding IDs, so renaming one changes user-visible output.
 *
 * Checks are grouped by area. Each declares the capability it needs, so a check
 * the browser cannot support reports unable-to-verify instead of failing.
 */

import { AssessmentMode, CheckCapability, FetcherCapabilities, SecurityCheck } from '../types';
import { authenticationSurfaceCheck } from './checks/authentication';
import { CORRELATION_CHECKS } from './checks/correlations';
import {
  cspBroadSourcesCheck,
  cspMissingDirectivesCheck,
  cspReportOnlyCheck,
  cspUnsafeEvalCheck,
  cspUnsafeInlineCheck
} from './checks/csp';
import {
  debugIndicatorCheck,
  securityTxtCheck,
  sourceMapIndicatorCheck,
  technologyDisclosureCheck
} from './checks/disclosure';
import { dangerousUrlSchemeCheck, objectEmbedCheck } from './checks/dom';
import { iframeSecurityCheck } from './checks/framing';
import {
  crossOriginFormActionCheck,
  formObservationsCheck,
  passwordFormHttpCheck,
  sensitiveFormTransportCheck
} from './checks/forms';
import {
  clickjackingProtectionCheck,
  contentTypeOptionsCheck,
  corsPolicyCheck,
  crossOriginIsolationCheck,
  hstsCheck,
  permissionsPolicyCheck,
  referrerPolicyCheck,
  sensitiveCacheControlCheck,
  serverHeaderDisclosureCheck
} from './checks/headers';
import { missingSriCheck } from './checks/integrity';
import { externalLinkHygieneCheck } from './checks/links';
import { sensitiveApiCheck } from './checks/permissions';
import {
  dangerousDomApiCheck,
  dynamicScriptLoadingCheck,
  inlineEventHandlerCheck,
  postMessageCheck
} from './checks/scripts';
import { robotsTxtCheck, sitemapCheck } from './checks/siteMetadata';
import { browserStorageCheck, serviceWorkerCheck } from './checks/storage';
import { thirdPartySurfaceCheck } from './checks/thirdParty';
import { httpUpgradeCheck, httpsAvailableCheck, mixedContentCheck } from './checks/transport';

export const CHECK_REGISTRY: readonly SecurityCheck[] = [
  // Transport
  httpsAvailableCheck,
  httpUpgradeCheck,
  mixedContentCheck,
  hstsCheck,
  // Response headers
  contentTypeOptionsCheck,
  clickjackingProtectionCheck,
  referrerPolicyCheck,
  permissionsPolicyCheck,
  crossOriginIsolationCheck,
  corsPolicyCheck,
  sensitiveCacheControlCheck,
  serverHeaderDisclosureCheck,
  // Content Security Policy
  cspUnsafeInlineCheck,
  cspUnsafeEvalCheck,
  cspBroadSourcesCheck,
  cspMissingDirectivesCheck,
  cspReportOnlyCheck,
  // Resources
  missingSriCheck,
  thirdPartySurfaceCheck,
  iframeSecurityCheck,
  externalLinkHygieneCheck,
  // Script and DOM hygiene
  dangerousDomApiCheck,
  inlineEventHandlerCheck,
  postMessageCheck,
  dynamicScriptLoadingCheck,
  dangerousUrlSchemeCheck,
  objectEmbedCheck,
  // Forms and authentication
  passwordFormHttpCheck,
  sensitiveFormTransportCheck,
  crossOriginFormActionCheck,
  formObservationsCheck,
  authenticationSurfaceCheck,
  // Browser features
  browserStorageCheck,
  serviceWorkerCheck,
  sensitiveApiCheck,
  // Disclosure
  technologyDisclosureCheck,
  debugIndicatorCheck,
  sourceMapIndicatorCheck,
  securityTxtCheck,
  // Site metadata
  robotsTxtCheck,
  sitemapCheck,
  // Cross-check correlations; they read other checks' inputs, so they run last
  ...CORRELATION_CHECKS
];

export function getCheckById(id: string): SecurityCheck | undefined {
  return CHECK_REGISTRY.find((check) => check.id === id);
}

export function getChecksForMode(mode: AssessmentMode): SecurityCheck[] {
  return CHECK_REGISTRY.filter((check) => check.modes.includes(mode));
}

/** Maps a check's declared capability need onto a transport capability. */
export function hasCapability(
  capabilities: FetcherCapabilities,
  capability: CheckCapability
): boolean {
  switch (capability) {
    case 'html-body':
      return capabilities.canReadHtmlBody;
    case 'response-headers':
      return capabilities.canReadResponseHeaders;
    case 'linked-pages':
      return capabilities.canDiscoverLinkedPages;
    case 'well-known-probe':
      return capabilities.canProbeWellKnownPaths;
  }
}

/** Capabilities a check needs but this run cannot provide. */
export function missingCapabilities(
  check: SecurityCheck,
  capabilities: FetcherCapabilities
): CheckCapability[] {
  return (check.requires ?? []).filter((capability) => !hasCapability(capabilities, capability));
}

/** Human-readable explanation used when a capability is unavailable. */
export const CAPABILITY_REASONS: Record<CheckCapability, string> = {
  'html-body':
    'The page markup could not be read. A browser can only read a cross-origin response body when the target sends an Access-Control-Allow-Origin header, and most sites do not. This is a browser restriction, not a finding about the site.',
  'response-headers':
    'The response headers could not be read. A cross-origin fetch only exposes CORS-safelisted headers, so security headers are invisible unless the server opts in with Access-Control-Expose-Headers.',
  'linked-pages':
    'Linked pages could not be retrieved, so only the page source that was supplied could be assessed.',
  'well-known-probe':
    'Well-known paths could not be requested with the current transport, so their presence could be neither confirmed nor ruled out.'
};
