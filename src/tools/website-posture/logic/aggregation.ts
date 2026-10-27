/**
 * Finding aggregation.
 *
 * A 20-page site with one bad CSP produces 20 identical findings. The report
 * must show one item that says "observed on 20 pages", not 20 cards.
 *
 * Findings collapse when they share a check id, a status, and an aggregation
 * key. Status is part of the key on purpose: a check that passes on three
 * pages and warns on seven should produce two honest items, not one item whose
 * page list mixes the two.
 *
 * Enough page-level detail is retained for the result to be actionable: the
 * full affected-page count, a capped page list, and a capped evidence sample.
 */

import {
  AggregatedFinding,
  Confidence,
  FindingSource,
  FindingStatus,
  ObservationKind,
  SecurityFinding,
  Severity
} from '../types';

/** Pages listed per finding; the true total is kept in `affectedPageCount`. */
export const MAX_LISTED_PAGES = 25;
/** Resources listed per finding; the full count is always reported. */
export const MAX_LISTED_RESOURCES = 100;

/** Evidence entries sampled per finding. */
export const MAX_SAMPLED_EVIDENCE = 8;

/** Report order: act on failures first, then warnings, and so on. */
const STATUS_ORDER: Record<FindingStatus, number> = {
  fail: 0,
  warning: 1,
  info: 2,
  'unable-to-verify': 3,
  pass: 4,
  'not-applicable': 5
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4
};

const SEVERITY_RANK: Record<Severity, number> = {
  informational: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export interface AggregationOptions {
  maxListedPages?: number;
  maxListedResources?: number;
  maxSampledEvidence?: number;
  /** Pages analyzed in the run, so a finding can say "3 of 12 pages". */
  totalPages?: number;
}

const OBSERVATION_RATIONALE: Record<ObservationKind, string> = {
  'verified-observation': 'directly observed in data that was read',
  'best-practice': 'a hardening recommendation rather than a confirmed weakness',
  'potential-concern': 'suggestive but not conclusive',
  'unable-to-verify': 'the data needed to decide was not available',
  'not-applicable': 'the precondition for this check was absent'
};

const SOURCE_RATIONALE: Record<FindingSource, string> = {
  browser: 'the request and response metadata the browser exposes',
  html: 'markup the page declares',
  dom: 'the parsed document structure',
  resource: 'resource references in the page',
  derived: 'a combination of other checks'
};

const CONFIDENCE_RATIONALE: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence'
};

/**
 * One deterministic sentence explaining a confidence level. It is built from
 * fixed vocabulary only, so it can never carry target content.
 */
export function confidenceRationaleFor(
  confidence: Confidence,
  observation: ObservationKind,
  source: FindingSource
): string {
  return `${CONFIDENCE_RATIONALE[confidence]}: ${OBSERVATION_RATIONALE[observation]}, based on ${SOURCE_RATIONALE[source]}.`;
}

/** Findings sharing this key describe the same issue. */
export function aggregationGroupKey(finding: SecurityFinding): string {
  return `${finding.checkId}|${finding.status}|${finding.aggregationKey}`;
}

export function aggregateFindings(
  findings: readonly SecurityFinding[],
  options: AggregationOptions = {}
): AggregatedFinding[] {
  const maxPages = options.maxListedPages ?? MAX_LISTED_PAGES;
  const maxEvidence = options.maxSampledEvidence ?? MAX_SAMPLED_EVIDENCE;
  const maxResources = options.maxListedResources ?? MAX_LISTED_RESOURCES;

  const groups = new Map<
    string,
    {
      base: SecurityFinding;
      pages: Set<string>;
      resources: Set<string>;
      evidence: SecurityFinding['evidence'];
      evidenceSeen: Set<string>;
      evidenceTotal: number;
      occurrences: number;
      severity: Severity;
      confidence: Confidence;
    }
  >();

  for (const finding of findings) {
    const key = aggregationGroupKey(finding);
    const existing = groups.get(key);

    if (!existing) {
      const evidence: SecurityFinding['evidence'] = [];
      const evidenceSeen = new Set<string>();
      let evidenceTotal = 0;

      for (const entry of finding.evidence) {
        evidenceTotal += 1;
        const dedupeKey = `${entry.label}|${entry.value}`;
        if (evidenceSeen.has(dedupeKey)) continue;
        evidenceSeen.add(dedupeKey);
        if (evidence.length < maxEvidence) evidence.push(entry);
      }

      groups.set(key, {
        base: finding,
        pages: new Set(finding.affectedPages),
        resources: new Set(finding.affectedResources ?? []),
        evidence,
        evidenceSeen,
        evidenceTotal,
        occurrences: finding.occurrences,
        severity: finding.severity,
        confidence: finding.confidence
      });
      continue;
    }

    for (const page of finding.affectedPages) existing.pages.add(page);
    for (const resource of finding.affectedResources ?? []) existing.resources.add(resource);

    for (const entry of finding.evidence) {
      existing.evidenceTotal += 1;
      const dedupeKey = `${entry.label}|${entry.value}`;
      if (existing.evidenceSeen.has(dedupeKey)) continue;
      existing.evidenceSeen.add(dedupeKey);
      if (existing.evidence.length < maxEvidence) existing.evidence.push(entry);
    }

    existing.occurrences += finding.occurrences;

    // The merged item takes the worst severity and the strongest confidence
    // observed, so collapsing never understates an issue.
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity]) {
      existing.severity = finding.severity;
    }
    if (CONFIDENCE_RANK[finding.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      existing.confidence = finding.confidence;
    }
  }

  const aggregated: AggregatedFinding[] = [];

  for (const group of groups.values()) {
    const pages = [...group.pages].sort();
    const listed = pages.slice(0, maxPages);
    const resources = [...group.resources].sort();

    aggregated.push({
      ...group.base,
      severity: group.severity,
      confidence: group.confidence,
      evidence: group.evidence,
      affectedPages: listed,
      affectedPageCount: pages.length,
      analyzedPageCount: Math.max(options.totalPages ?? 0, pages.length),
      confidenceRationale: confidenceRationaleFor(
        group.confidence,
        group.base.observation,
        group.base.source
      ),
      affectedPagesTruncated: pages.length > listed.length,
      affectedResources: resources.slice(0, maxResources),
      affectedResourceCount: resources.length,
      affectedResourcesTruncated: resources.length > maxResources,
      evidenceTruncated: group.evidenceTotal > group.evidence.length,
      occurrences: group.occurrences
    });
  }

  return sortFindings(aggregated);
}

/** Most actionable first: status, then severity, then breadth. */
export function sortFindings<T extends AggregatedFinding>(findings: T[]): T[] {
  return [...findings].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;

    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;

    const byBreadth = b.affectedPageCount - a.affectedPageCount;
    if (byBreadth !== 0) return byBreadth;

    return a.id.localeCompare(b.id);
  });
}

/** Counts per status, for the report summary strip. */
export function countByStatus(
  findings: readonly AggregatedFinding[]
): Record<FindingStatus, number> {
  const counts: Record<FindingStatus, number> = {
    pass: 0,
    warning: 0,
    fail: 0,
    info: 0,
    'unable-to-verify': 0,
    'not-applicable': 0
  };

  for (const finding of findings) counts[finding.status] += 1;
  return counts;
}
