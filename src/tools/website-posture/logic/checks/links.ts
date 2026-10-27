/**
 * Outbound link hygiene.
 *
 * Links are read from markup only. No link is ever followed, so nothing here
 * says anything about the destination itself — only about how this page links
 * to it.
 */

import { CheckContext, CheckOutcome, PageLink, SecurityCheck, SecurityFinding } from '../../types';
import { createFinding, passed, sanitizeUrlForEvidence } from '../findings';

/** Lowercase `rel` tokens. */
function relTokens(link: PageLink): Set<string> {
  return new Set((link.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean));
}

/** A link that opens a new browsing context. */
function opensNewContext(link: PageLink): boolean {
  if (!link.target) return false;
  // A named target reuses one window, but still creates a context that keeps a
  // reference to the opener.
  return link.target !== '_self' && link.target !== '_parent' && link.target !== '_top';
}

export const externalLinkHygieneCheck: SecurityCheck = {
  id: 'external-link-hygiene',
  category: 'links-and-navigation',
  name: 'Outbound link hygiene',
  description:
    'Checks cross-origin links for rel="noopener" when they open a new context, and for plaintext HTTP destinations.',
  severity: 'low',
  scoreWeight: 6,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let externalLinksSeen = 0;

    for (const page of context.pages) {
      const external = page.links.filter((link) => link.isNavigable && !link.sameOrigin);
      if (external.length === 0) continue;
      externalLinksSeen += external.length;

      const newContext = external.filter(opensNewContext);
      const withoutNoopener = newContext.filter((link) => {
        const tokens = relTokens(link);
        return !tokens.has('noopener') && !tokens.has('noreferrer');
      });

      const insecureDestinations =
        page.protocol === 'https:' ? external.filter((link) => link.protocol === 'http:') : [];

      if (withoutNoopener.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'best-practice',
            confidence: 'high',
            source: 'html',
            title: 'Cross-origin links open a new context without rel="noopener"',
            summary: `${withoutNoopener.length} cross-origin link${withoutNoopener.length === 1 ? '' : 's'} with a target attribute ${withoutNoopener.length === 1 ? 'does' : 'do'} not declare noopener or noreferrer.`,
            explanation:
              'The opened page receives a window.opener reference back to this one and can use it to navigate this tab elsewhere — the tabnabbing pattern, where a visitor returns to what looks like your site and is asked to sign in again. Every current browser now implies noopener for target="_blank", so the practical exposure is limited to older clients and to named targets. Declaring it is still the reliable fix.',
            recommendation:
              'Add rel="noopener" to every link with a target attribute, and rel="noopener noreferrer" where the destination should not learn which page the visitor came from.',
            affectedPages: [page.url],
            aggregationKey: 'missing-noopener',
            occurrences: withoutNoopener.length,
            evidence: withoutNoopener.slice(0, 4).map((link) => ({
              label: `target="${link.target}"`,
              value: sanitizeUrlForEvidence(link.url),
              pageUrl: page.url
            }))
          })
        );
      }

      if (insecureDestinations.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Secure page links to plaintext HTTP destinations',
            summary: `${insecureDestinations.length} link${insecureDestinations.length === 1 ? '' : 's'} from an HTTPS page point${insecureDestinations.length === 1 ? 's' : ''} at an http:// URL.`,
            explanation:
              'A visitor who follows the link leaves an encrypted connection for an unencrypted one, where the request and the response can be read or rewritten on the path. This does not weaken the current page — it is a downgrade at the moment the visitor navigates — and many destinations now redirect to HTTPS themselves, which this assessment did not check because it does not follow links.',
            recommendation:
              'Update each link to https:// where the destination supports it. For destinations that do not, consider whether the link is still appropriate.',
            affectedPages: [page.url],
            aggregationKey: 'http-destination',
            occurrences: insecureDestinations.length,
            evidence: insecureDestinations.slice(0, 4).map((link) => ({
              label: 'Destination',
              value: sanitizeUrlForEvidence(link.url),
              pageUrl: page.url
            }))
          })
        );
      }

      if (withoutNoopener.length === 0 && insecureDestinations.length === 0) {
        findings.push(
          passed(this, {
            summary: `${external.length} cross-origin link${external.length === 1 ? '' : 's'} on this page ${external.length === 1 ? 'is' : 'are'} declared safely.`,
            explanation:
              'Every cross-origin link that opens a new context declares noopener or noreferrer, and none of them downgrades to plaintext HTTP. Link destinations were not requested, so nothing here speaks to the safety of the destinations themselves.',
            affectedPages: [page.url],
            evidence: [
              { label: 'External links', value: String(external.length), pageUrl: page.url },
              { label: 'Opening a new context', value: String(newContext.length), pageUrl: page.url }
            ]
          })
        );
      }
    }

    if (externalLinksSeen === 0) {
      return {
        findings: [
          passed(this, {
            summary: 'No cross-origin links were found in the markup analyzed.',
            explanation:
              'Every navigable link on the pages analyzed stays on this origin, so there is no outbound link hygiene to assess.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};
