/**
 * Permission-gated browser API usage.
 *
 * Observed only as text in inline script and in `allow` attributes. This
 * assessment never calls one of these APIs and never requests a permission —
 * doing so would put a prompt in front of the person running the scan and
 * would be an active interaction with the target's code, which is outside what
 * a passive assessment may do.
 *
 * Requesting camera access is not a weakness. The point of recording it is
 * that a page which can reach a device is a page whose script-injection risk
 * carries a larger consequence, and that the permission set is worth keeping
 * deliberately small.
 */

import { CheckContext, CheckOutcome, PageIndicator, SecurityCheck } from '../../types';
import { createFinding, notApplicable } from '../findings';

/** APIs whose misuse reaches hardware or the person rather than the page. */
const HIGH_IMPACT_IDS: ReadonlySet<string> = new Set([
  'geolocation',
  'camera-microphone',
  'screen-capture',
  'device-access',
  'midi',
  'sensors'
]);

/** Merges indicators across pages, summing occurrences. */
function mergeAcrossPages(indicators: readonly PageIndicator[][]): PageIndicator[] {
  const merged = new Map<string, PageIndicator>();
  for (const list of indicators) {
    for (const indicator of list) {
      const existing = merged.get(indicator.id);
      if (existing) existing.occurrences += indicator.occurrences;
      else merged.set(indicator.id, { ...indicator });
    }
  }
  return [...merged.values()].sort((a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id));
}

export const sensitiveApiCheck: SecurityCheck = {
  id: 'sensitive-api-indicators',
  category: 'browser-permissions',
  name: 'Sensitive browser API usage',
  description:
    'Notes references to permission-gated APIs such as geolocation, camera, microphone, notifications, and clipboard.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const pages = context.pages.filter((page) => page.sensitiveApiIndicators.length > 0);

    if (pages.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No permission-gated browser API was referenced in the inline script analyzed. Usage inside an external script file would not appear here, since external scripts are never downloaded, and no permission was ever requested by this assessment.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    const indicators = mergeAcrossPages(pages.map((page) => page.sensitiveApiIndicators));
    const highImpact = indicators.filter((indicator) => HIGH_IMPACT_IDS.has(indicator.id));

    return {
      findings: [
        createFinding(this, {
          status: 'info',
          observation: highImpact.length > 0 ? 'potential-concern' : 'verified-observation',
          confidence: 'medium',
          source: 'html',
          title: 'Page references permission-gated browser APIs',
          summary: `References to ${indicators.map((indicator) => indicator.label).slice(0, 5).join(', ')}${indicators.length > 5 ? ', and others' : ''} were seen.`,
          explanation:
            `A permission the origin holds is a permission any script on the origin can use, including a third-party tag and including injected script. ${highImpact.length > 0 ? 'Some of the APIs referenced here reach hardware or the visitor\'s surroundings, so the consequence of a script problem on this origin is correspondingly larger. ' : ''}No permission was requested and no API was called while producing this report, so nothing here says whether the visitor is actually prompted or what the page does with the result.`,
          recommendation:
            'Request each permission only at the moment it is needed and explain why, and restrict the set with a Permissions-Policy response header so a third-party frame or an unexpected script cannot reach a device your own code never uses.',
          affectedPages: pages.map((page) => page.url),
          aggregationKey: highImpact.length > 0 ? 'high-impact-apis' : 'apis-referenced',
          occurrences: indicators.reduce((total, indicator) => total + indicator.occurrences, 0),
          evidence: indicators.slice(0, 6).map((indicator) => ({
            label: indicator.label,
            value: `${indicator.occurrences} reference${indicator.occurrences === 1 ? '' : 's'}`
          }))
        })
      ]
    };
  }
};
