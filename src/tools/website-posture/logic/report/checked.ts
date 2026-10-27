/**
 * "What we checked" and "What we could not verify".
 *
 * Built from the check execution records plus a fixed list of things a
 * browser-only, passive assessment cannot see by design. None of the
 * limitations are failures, and none of them affect the score.
 */

import { CheckCapability, CheckExecutionStatus, SecurityAssessment } from '../../types';
import { ReportCategoryId, reportCategoryOf, REPORT_CATEGORIES } from './reportCategories';

export interface CheckedItem {
  checkId: string;
  name: string;
  status: CheckExecutionStatus;
}

export interface CheckedGroup {
  id: ReportCategoryId;
  label: string;
  checks: CheckedItem[];
}

export function summarizeChecked(assessment: SecurityAssessment): CheckedGroup[] {
  const byGroup = new Map<ReportCategoryId, CheckedItem[]>();
  for (const record of assessment.checkRecords) {
    const id = reportCategoryOf(record.category);
    const list = byGroup.get(id) ?? [];
    list.push({ checkId: record.checkId, name: record.checkName, status: record.status });
    byGroup.set(id, list);
  }
  return REPORT_CATEGORIES.flatMap((definition) => {
    const checks = byGroup.get(definition.id);
    return checks ? [{ id: definition.id, label: definition.label, checks }] : [];
  });
}

export const CAPABILITY_LIMITATIONS: Record<CheckCapability, string> = {
  'html-body': 'The page markup could not be read.',
  'response-headers':
    'Cross-origin response headers are hidden from browser scripts unless the server opts in, so header-based checks could not reach a verdict.',
  'linked-pages': 'Linked pages were not followed in this mode.',
  'well-known-probe':
    'Well-known files such as robots.txt, sitemap.xml and security.txt could not be requested from the browser.'
};

/** Things a browser-only passive assessment cannot observe, whatever the target. */
export const STANDING_LIMITATIONS: readonly string[] = [
  'Server-only cookie attributes (HttpOnly, Secure, SameSite) are not visible to page scripts, and cookies are never read.',
  'TLS certificate details, protocol versions and cipher suites are not exposed to the browser.',
  'Server configuration, back-end code, databases and infrastructure were not examined.',
  'Back-end vulnerabilities are outside what a passive, markup-level assessment can see.',
  'Authenticated areas and behavior behind a sign-in were not reached; no credentials are used.',
  'Resources are listed from markup. They were not downloaded or inspected, and resources added at runtime by script were not seen.',
  'Pages were not rendered or scripted, so content generated client-side is invisible to this assessment.'
];

export interface UnverifiedCheck {
  checkId: string;
  name: string;
  reasons: string[];
}

/** Checks that could not reach a verdict, with the limitation behind each. */
export function summarizeUnverified(assessment: SecurityAssessment): UnverifiedCheck[] {
  return assessment.checkRecords
    .filter((record) => record.status === 'unable-to-verify')
    .map((record) => ({
      checkId: record.checkId,
      name: record.checkName,
      reasons: (record.missingCapabilities ?? []).map((capability) => CAPABILITY_LIMITATIONS[capability])
    }));
}
