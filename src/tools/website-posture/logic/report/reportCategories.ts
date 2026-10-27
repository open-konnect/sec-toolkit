/**
 * Report category grouping.
 *
 * Maps the engine's fine-grained finding categories onto the handful of
 * headings a reader scans for. Pure data plus a summarizer; no UI.
 */

import { AggregatedFinding, FindingCategory, FindingStatus } from '../../types';

export type ReportCategoryId =
  | 'transport'
  | 'headers'
  | 'content'
  | 'forms'
  | 'javascript'
  | 'third-party'
  | 'browser'
  | 'disclosure'
  | 'hygiene'
  | 'correlation';

export interface ReportCategoryDefinition {
  id: ReportCategoryId;
  label: string;
  description: string;
  categories: readonly FindingCategory[];
}

export const REPORT_CATEGORIES: readonly ReportCategoryDefinition[] = [
  {
    id: 'transport',
    label: 'Transport Security',
    description: 'How pages and their subresources are delivered: HTTPS, upgrades and mixed content.',
    categories: ['transport']
  },
  {
    id: 'headers',
    label: 'Security Headers',
    description: 'Response headers that harden the browser’s handling of the page.',
    categories: ['response-headers']
  },
  {
    id: 'content',
    label: 'Content Security',
    description: 'Content Security Policy presence, strength and coverage.',
    categories: ['content-security-policy']
  },
  {
    id: 'forms',
    label: 'Forms',
    description: 'Where forms submit, and how sign-in and payment inputs are handled.',
    categories: ['forms-and-input', 'authentication-surface']
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    description: 'Inline script, risky APIs and DOM sinks visible in the markup.',
    categories: ['script-security']
  },
  {
    id: 'third-party',
    label: 'Third-Party Resources',
    description: 'External hosts the pages depend on and whether those loads are pinned.',
    categories: ['third-party', 'resource-integrity']
  },
  {
    id: 'browser',
    label: 'Browser Security',
    description: 'Framing, link behavior, storage, service workers and permissions.',
    categories: ['framing', 'links-and-navigation', 'browser-storage', 'service-workers', 'browser-permissions']
  },
  {
    id: 'disclosure',
    label: 'Information Disclosure',
    description: 'Details the site reveals about its stack, build or internals.',
    categories: ['information-disclosure']
  },
  {
    id: 'hygiene',
    label: 'Security Hygiene',
    description: 'Disclosure policy and site metadata files.',
    categories: ['disclosure-process', 'site-metadata']
  },
  {
    id: 'correlation',
    label: 'Cross-checks',
    description: 'Combinations of observations that matter more together than alone.',
    categories: ['correlation']
  }
];

const CATEGORY_TO_REPORT = new Map<FindingCategory, ReportCategoryId>();
for (const definition of REPORT_CATEGORIES) {
  for (const category of definition.categories) CATEGORY_TO_REPORT.set(category, definition.id);
}

export function reportCategoryOf(category: FindingCategory): ReportCategoryId {
  return CATEGORY_TO_REPORT.get(category) ?? 'hygiene';
}

export type CategoryHealth = 'fail' | 'warning' | 'info' | 'pass' | 'unverified' | 'none';

export interface CategorySummary {
  id: ReportCategoryId;
  label: string;
  description: string;
  counts: Record<FindingStatus, number>;
  total: number;
  /** Findings that need a reader’s attention: issues and warnings. */
  attention: number;
  health: CategoryHealth;
  findings: AggregatedFinding[];
}

export function emptyStatusCounts(): Record<FindingStatus, number> {
  return { fail: 0, warning: 0, pass: 0, info: 0, 'unable-to-verify': 0, 'not-applicable': 0 };
}

function healthOf(counts: Record<FindingStatus, number>): CategoryHealth {
  if (counts.fail > 0) return 'fail';
  if (counts.warning > 0) return 'warning';
  if (counts.info > 0) return 'info';
  if (counts.pass > 0) return 'pass';
  if (counts['unable-to-verify'] > 0) return 'unverified';
  return 'none';
}

/** One summary per category that has at least one finding, in report order. */
export function summarizeCategories(findings: readonly AggregatedFinding[]): CategorySummary[] {
  const byCategory = new Map<ReportCategoryId, AggregatedFinding[]>();
  for (const finding of findings) {
    const id = reportCategoryOf(finding.category);
    const list = byCategory.get(id) ?? [];
    list.push(finding);
    byCategory.set(id, list);
  }

  return REPORT_CATEGORIES.flatMap((definition) => {
    const list = byCategory.get(definition.id);
    if (!list || list.length === 0) return [];
    const counts = emptyStatusCounts();
    for (const finding of list) counts[finding.status] += 1;
    return [
      {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        counts,
        total: list.length,
        attention: counts.fail + counts.warning,
        health: healthOf(counts),
        findings: list
      }
    ];
  });
}
