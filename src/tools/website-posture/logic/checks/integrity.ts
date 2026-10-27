/**
 * Subresource Integrity check: `missing-sri`.
 */

import { CheckContext, CheckOutcome, SecurityCheck, SecurityFinding } from '../../types';
import { sriIsMeaningful } from '../analysis/thirdParty';
import { createFinding, notApplicable, passed, sanitizeUrlForEvidence } from '../findings';

/**
 * Cross-origin scripts and stylesheets without an `integrity` attribute.
 *
 * Reported as a best-practice observation rather than a verified weakness:
 * a third-party CDN serving the expected file is the normal case, and a
 * missing integrity hash is an absent safeguard, not evidence of compromise.
 */
export const missingSriCheck: SecurityCheck = {
  id: 'missing-sri',
  category: 'resource-integrity',
  name: 'Subresource Integrity coverage',
  description:
    'Finds cross-origin scripts and stylesheets that carry no Subresource Integrity hash.',
  severity: 'medium',
  scoreWeight: 12,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const candidates = page.resources.filter(sriIsMeaningful);

      if (candidates.length === 0) {
        findings.push(
          notApplicable(this, {
            reason:
              'This page references no cross-origin script or stylesheet, so there is no third-party resource for Subresource Integrity to protect.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      const withoutIntegrity = candidates.filter((resource) => !resource.integrity);

      // An integrity hash without a crossorigin attribute fails open: the
      // browser cannot read the opaque response to verify it, so the hash is
      // silently ignored. This is worth separating from a plain omission.
      const integrityWithoutCors = candidates.filter(
        (resource) => resource.integrity && !resource.crossOriginAttr
      );

      if (withoutIntegrity.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'best-practice',
            confidence: 'high',
            source: 'html',
            title: 'Cross-origin resources load without Subresource Integrity',
            summary: `${withoutIntegrity.length} cross-origin ${withoutIntegrity.length === 1 ? 'resource is' : 'resources are'} loaded with no integrity hash.`,
            explanation:
              'Without an integrity hash the browser executes whatever the third-party origin returns. If that origin, its CDN, or its DNS is ever compromised, the substituted file runs with full access to this page. An integrity hash makes the browser reject any file whose content does not match.',
            recommendation:
              'Add integrity="sha384-…" together with crossorigin="anonymous" to each pinned third-party script and stylesheet. For assets whose content changes without a version change, self-host them instead, since a hash cannot be pinned to a moving target.',
            affectedPages: [page.url],
            aggregationKey: 'missing-integrity',
            affectedResources: withoutIntegrity.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: withoutIntegrity.length,
            evidence: withoutIntegrity.slice(0, 4).map((resource) => ({
              label: `${resource.type} · ${resource.host ?? 'unknown host'}`,
              value: sanitizeUrlForEvidence(resource.url),
              pageUrl: page.url
            }))
          })
        );
      }

      if (integrityWithoutCors.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'medium',
            source: 'html',
            title: 'Integrity hash present without crossorigin',
            summary: `${integrityWithoutCors.length} cross-origin ${integrityWithoutCors.length === 1 ? 'resource declares' : 'resources declare'} integrity but omit the crossorigin attribute.`,
            explanation:
              'Integrity verification needs a CORS-enabled response. Without crossorigin the browser receives an opaque response, cannot compute a hash over it, and blocks the resource — so the protection does not apply and the asset may simply fail to load.',
            recommendation:
              'Add crossorigin="anonymous" alongside integrity, and confirm the serving origin returns an Access-Control-Allow-Origin header for the asset.',
            affectedPages: [page.url],
            aggregationKey: 'integrity-without-crossorigin',
            affectedResources: integrityWithoutCors.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: integrityWithoutCors.length,
            evidence: integrityWithoutCors.slice(0, 4).map((resource) => ({
              label: `${resource.type} · ${resource.host ?? 'unknown host'}`,
              value: sanitizeUrlForEvidence(resource.url),
              pageUrl: page.url
            }))
          })
        );
      }

      if (withoutIntegrity.length === 0 && integrityWithoutCors.length === 0) {
        findings.push(
          passed(this, {
            summary: 'Every cross-origin script and stylesheet on this page carries an integrity hash.',
            explanation:
              'Each third-party script and stylesheet declared in the markup is pinned with Subresource Integrity, so the browser rejects any substituted content. Resources injected at runtime by script were not examined.',
            affectedPages: [page.url],
            evidence: [{ label: 'Pinned resources', value: String(candidates.length), pageUrl: page.url }]
          })
        );
      }
    }

    return { findings };
  }
};
