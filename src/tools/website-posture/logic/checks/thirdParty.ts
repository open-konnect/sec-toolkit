/**
 * Third-party attack surface.
 *
 * Nothing in this file is a defect. Using a CDN, an analytics tag, or a hosted
 * payment form is normal engineering, and a site with twenty external domains
 * is not twenty times less safe than one with one. What matters for a posture
 * report is that the operator can see the shape of what they have delegated —
 * so these checks carry a score weight of zero and only describe.
 */

import { CheckContext, CheckOutcome, SecurityCheck } from '../../types';
import { createFinding, notApplicable } from '../findings';
import {
  THIRD_PARTY_KIND_LABELS,
  ThirdPartyKind,
  summarizeThirdPartySurface
} from '../analysis/thirdParty';

/** Kinds listed in the order a reviewer most likely cares about them. */
const KIND_ORDER: readonly ThirdPartyKind[] = [
  'payment',
  'tag-manager',
  'analytics',
  'social',
  'cdn',
  'other'
];

export const thirdPartySurfaceCheck: SecurityCheck = {
  id: 'third-party-surface',
  category: 'third-party',
  name: 'Third-party resource surface',
  description:
    'Inventories external resources and the distinct third-party domains a page depends on.',
  severity: 'informational',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const surface = summarizeThirdPartySurface(context.pages);
    const pages = context.pages.map((page) => page.url);

    if (surface.externalResources === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason: `All ${surface.totalResources} resource references in the markup analyzed are same-origin, so there is no third-party surface to inventory. Resources a script loads at runtime are not visible to a passive scan.`,
            affectedPages: pages
          })
        ]
      };
    }

    const populated = KIND_ORDER.filter((kind) => surface.byKind[kind].length > 0);
    const activeKinds = populated.filter(
      (kind) => kind === 'payment' || kind === 'tag-manager' || kind === 'analytics'
    );

    return {
      findings: [
        createFinding(this, {
          status: 'info',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'html',
          title: 'Page depends on third-party domains',
          summary: `${surface.externalResources} of ${surface.totalResources} resource references are cross-origin (${surface.thirdPartyResources} third-party, ${surface.sameSiteResources} same-site), spanning ${surface.domains.length} distinct domain${surface.domains.length === 1 ? '' : 's'}.`,
          explanation:
            `Every external domain that serves script, styles, or frames is part of this site's trust boundary: whoever controls that domain can change what runs in your visitors' browsers. ${surface.externalScripts} external script reference${surface.externalScripts === 1 ? '' : 's'} and ${surface.externalFrames} external frame${surface.externalFrames === 1 ? '' : 's'} were seen. This is an inventory, not a finding — third-party content is normal, and none of these domains was assessed or contacted.`,
          recommendation:
            'Confirm every domain on this list is one you intended to depend on, and that each is still in use. Pin versions and add Subresource Integrity where the content is static, and constrain the set with a CSP so an unexpected domain cannot start serving script.',
          affectedPages: pages,
          aggregationKey: 'inventory',
          occurrences: surface.externalResources,
          evidence: [
            { label: 'External resources', value: String(surface.externalResources) },
            { label: 'External scripts', value: String(surface.externalScripts) },
            { label: 'External stylesheets', value: String(surface.externalStylesheets) },
            { label: 'External frames', value: String(surface.externalFrames) },
            { label: 'Distinct domains', value: String(surface.domains.length) },
            { label: 'Third-party domains', value: String(surface.thirdPartyDomains.length) },
            { label: 'Same-site domains', value: String(surface.sameSiteDomains.length) },
            ...populated.map((kind) => ({
              label: THIRD_PARTY_KIND_LABELS[kind],
              value: surface.byKind[kind].slice(0, 8).join(', ')
            })),
            ...(activeKinds.length > 0
              ? [{ label: 'Classified categories present', value: activeKinds.join(', ') }]
              : [])
          ]
        })
      ]
    };
  }
};
