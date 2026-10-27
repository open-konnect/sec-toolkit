/**
 * Iframe checks.
 *
 * Only the embedding markup is examined. The contents of a cross-origin frame
 * are inaccessible to a browser by design, and this engine never attempts to
 * reach into one — so a cross-origin iframe is described by its attributes and
 * nothing more.
 */

import { CheckContext, CheckOutcome, NormalizedResource, SecurityCheck, SecurityFinding } from '../../types';
import { createFinding, notApplicable, passed, sanitizeUrlForEvidence } from '../findings';
import { resourcesOfType } from '../page';
import { classifyDomain } from '../analysis/thirdParty';

/** Lowercase sandbox tokens, or null when the attribute is absent. */
function sandboxTokens(resource: NormalizedResource): string[] | null {
  if (resource.sandbox === null) return null;
  return resource.sandbox.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Iframe security posture: transport, sandboxing, and origin.
 *
 * Each concern gets its own aggregation key so one problem does not hide
 * another, and so the same problem across many pages collapses into one
 * reported item.
 */
export const iframeSecurityCheck: SecurityCheck = {
  id: 'iframe-security',
  category: 'framing',
  name: 'Embedded frame security',
  description:
    'Examines iframe sources and sandbox attributes for insecure transport, missing isolation, and self-defeating sandbox configurations.',
  severity: 'medium',
  scoreWeight: 10,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let framesSeen = 0;

    for (const page of context.pages) {
      const frames = resourcesOfType(page, 'iframe');
      const srcdoc = page.observations.some((observation) => observation.id === 'srcdoc-iframe');

      if (frames.length === 0 && !srcdoc) continue;
      framesSeen += frames.length;

      const insecure = frames.filter((frame) => frame.protocol === 'http:');
      const crossOrigin = frames.filter((frame) => frame.crossOrigin);
      const unsandboxedCrossOrigin = crossOrigin.filter((frame) => sandboxTokens(frame) === null);

      const selfDefeating = frames.filter((frame) => {
        const tokens = sandboxTokens(frame);
        if (!tokens) return false;
        return tokens.includes('allow-scripts') && tokens.includes('allow-same-origin');
      });

      if (insecure.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Iframe source uses plaintext HTTP',
            summary: `${insecure.length} iframe${insecure.length === 1 ? '' : 's'} reference${insecure.length === 1 ? 's' : ''} an http:// URL.`,
            explanation:
              'A framed document loaded over HTTP can be replaced in transit, and the replacement runs with whatever capabilities the frame has been granted. On an HTTPS page the browser blocks the load as active mixed content, so the frame is also likely broken.',
            recommendation:
              'Point each iframe at an https:// URL, and add a sandbox attribute if the framed document does not need full capabilities.',
            affectedPages: [page.url],
            aggregationKey: 'http-source',
            affectedResources: insecure.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: insecure.length,
            evidence: insecure.slice(0, 3).map((frame) => ({
              label: 'iframe[src]',
              value: sanitizeUrlForEvidence(frame.url ?? frame.rawUrl),
              pageUrl: page.url
            }))
          })
        );
      }

      if (selfDefeating.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Sandbox grants both scripts and same-origin access',
            summary: `${selfDefeating.length} iframe${selfDefeating.length === 1 ? '' : 's'} combine allow-scripts with allow-same-origin.`,
            explanation:
              'Together these two tokens let the framed document reach its own origin and run script there — which includes removing its own sandbox attribute and reloading itself without it. For a same-origin frame the sandbox therefore provides no containment at all. For a genuinely cross-origin frame the combination is less severe, because same-origin refers to the frame\'s own origin rather than yours.',
            recommendation:
              'Grant allow-scripts or allow-same-origin, not both. If the framed content needs both, host it on a separate origin so that "same origin" does not mean your application.',
            affectedPages: [page.url],
            aggregationKey: 'sandbox-self-defeating',
            affectedResources: selfDefeating.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: selfDefeating.length,
            evidence: selfDefeating.slice(0, 3).map((frame) => ({
              label: 'iframe[sandbox]',
              value: frame.sandbox ?? '',
              pageUrl: page.url
            }))
          })
        );
      }

      if (unsandboxedCrossOrigin.length > 0) {
        const kinds = [...new Set(unsandboxedCrossOrigin.map((frame) => classifyDomain(frame.host)))];

        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'best-practice',
            confidence: 'high',
            source: 'html',
            title: 'Cross-origin iframe without a sandbox attribute',
            summary: `${unsandboxedCrossOrigin.length} cross-origin iframe${unsandboxedCrossOrigin.length === 1 ? '' : 's'} carry no sandbox attribute.`,
            explanation:
              'Without a sandbox the framed document may run script, submit forms, open popups, trigger downloads, and request permissions in the context of your page. The same-origin policy still prevents it from reading your DOM. Many embeds — a video player, a payment form, a map — need these capabilities, so a missing sandbox is a hardening opportunity rather than a flaw.',
            recommendation:
              'Add the narrowest sandbox that keeps each embed working, plus an allow attribute limiting the permissions it may request. Confirm with the provider before restricting a payment or authentication frame.',
            affectedPages: [page.url],
            aggregationKey: 'cross-origin-no-sandbox',
            affectedResources: unsandboxedCrossOrigin.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: unsandboxedCrossOrigin.length,
            evidence: [
              {
                label: 'Embedded hosts',
                value: [...new Set(unsandboxedCrossOrigin.map((frame) => frame.host ?? 'unknown'))]
                  .slice(0, 4)
                  .join(', '),
                pageUrl: page.url
              },
              { label: 'Classified as', value: kinds.join(', '), pageUrl: page.url }
            ]
          })
        );
      }

      if (srcdoc) {
        findings.push(
          createFinding(this, {
            status: 'info',
            observation: 'potential-concern',
            confidence: 'low',
            source: 'html',
            title: 'Iframe supplies its document inline',
            summary: 'At least one iframe uses srcdoc to provide its content inline.',
            explanation:
              'A srcdoc frame inherits the embedding page\'s origin, so script inside it runs with the same access as the page itself. That is fine for static content you authored, and a problem if any part of the srcdoc value is assembled from untrusted input. The attribute\'s contents were not read by this assessment.',
            recommendation:
              'Confirm no srcdoc value is built from user input. Add a sandbox attribute so the inline document does not inherit the page origin.',
            affectedPages: [page.url],
            aggregationKey: 'srcdoc'
          })
        );
      }

      if (
        insecure.length === 0 &&
        selfDefeating.length === 0 &&
        unsandboxedCrossOrigin.length === 0 &&
        !srcdoc
      ) {
        findings.push(
          passed(this, {
            summary: `${frames.length} iframe${frames.length === 1 ? '' : 's'} on this page ${frames.length === 1 ? 'is' : 'are'} loaded over HTTPS with sandboxing where it applies.`,
            explanation:
              'No framed document is loaded over plaintext HTTP, no sandbox attribute defeats itself, and every cross-origin frame declares a sandbox. The contents of the framed documents were not inspected — a browser cannot read across an origin boundary.',
            affectedPages: [page.url],
            evidence: [{ label: 'Frames examined', value: String(frames.length), pageUrl: page.url }]
          })
        );
      }
    }

    if (framesSeen === 0 && findings.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No iframe was declared in the markup analyzed. A frame inserted later by script would not appear here.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};
