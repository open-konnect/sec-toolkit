/**
 * Deterministic scoring and coverage.
 *
 * The score answers "of the checks that actually completed, how much weighted
 * concern was found?". It is NOT an estimate of how secure the site is, and
 * the report must never present it as one. Coverage is reported separately and
 * is the honest measure of how much could be looked at.
 *
 * Rules enforced here:
 *
 * - `unable-to-verify` never lowers the score. Such a check contributes no
 *   weight to the denominator either, so a blocked check is invisible to the
 *   score and visible in coverage.
 * - `not-applicable` never lowers the score.
 * - `informational` findings never lower the score.
 * - A high-confidence verified weakness outweighs a low-confidence
 *   observation, via the confidence multiplier.
 * - A hardening recommendation is damped by the observation multiplier so it
 *   is never scored like a confirmed defect.
 * - Only checks that completed contribute weight, so the score is relative to
 *   the work really performed.
 * - When nothing scoreable completed, the score is `null` — reported as "not
 *   scored", never as 100 and never as 0.
 */

import {
  AggregatedFinding,
  AssessmentCoverage,
  AssessmentScore,
  CheckExecutionRecord,
  Confidence,
  DiscoveryReport,
  FindingStatus,
  MaturityDimension,
  MaturityDimensionId,
  ObservationKind,
  ScoreContribution,
  ScoreGrade,
  SecurityCheck,
  Severity
} from '../types';
import { DIMENSION_LABELS, dimensionOf } from './maturity';

/** Base penalty weight per severity. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
  informational: 0
};

/** Only `fail` and `warning` carry weight; every other status is neutral. */
export const STATUS_FACTORS: Record<FindingStatus, number> = {
  fail: 1,
  warning: 0.5,
  pass: 0,
  info: 0,
  'unable-to-verify': 0,
  'not-applicable': 0
};

/** How much we trust the observation itself. */
export const CONFIDENCE_FACTORS: Record<Confidence, number> = {
  high: 1,
  medium: 0.6,
  low: 0.3
};

/** Keeps best-practice advice from scoring like a confirmed weakness. */
export const OBSERVATION_FACTORS: Record<ObservationKind, number> = {
  'verified-observation': 1,
  'potential-concern': 0.6,
  'best-practice': 0.35,
  'unable-to-verify': 0,
  'not-applicable': 0
};

/** Breadth multiplier, capped so a wide issue cannot dominate the score. */
export const MAX_BREADTH_MULTIPLIER = 1.5;

/**
 * An issue on every page is worse than an issue on one page, but only
 * modestly: it is still one misconfiguration.
 */
export function breadthFactor(affectedPageCount: number): number {
  const extraPages = Math.max(0, affectedPageCount - 1);
  return Math.min(MAX_BREADTH_MULTIPLIER, 1 + extraPages * 0.05);
}

/** Penalty a single aggregated finding contributes. */
export function findingPenalty(finding: AggregatedFinding): number {
  const statusFactor = STATUS_FACTORS[finding.status];
  if (statusFactor === 0) return 0;

  const weight = SEVERITY_WEIGHTS[finding.severity];
  if (weight === 0) return 0;

  const penalty =
    weight *
    statusFactor *
    CONFIDENCE_FACTORS[finding.confidence] *
    OBSERVATION_FACTORS[finding.observation] *
    breadthFactor(finding.affectedPageCount);

  return round2(penalty);
}

export function gradeForScore(score: number): ScoreGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export interface ComputeScoreInput {
  findings: readonly AggregatedFinding[];
  records: readonly CheckExecutionRecord[];
  checks: readonly SecurityCheck[];
}

type BaseScore = Omit<AssessmentScore, 'dimensions'>;

/**
 * Headline score plus the two maturity dimensions.
 *
 * Each dimension reuses the same arithmetic on the subset of checks assigned
 * to it, so the three numbers can never disagree about how a finding is
 * weighed. The headline stays the primary score; dimensions are for drill-down.
 */
export function computeScore(input: ComputeScoreInput): AssessmentScore {
  const base = scoreChecks(input);

  const dimension = (id: MaturityDimensionId): MaturityDimension => {
    const checks = input.checks.filter((check) => dimensionOf(check.id) === id);
    const ids = new Set(checks.map((check) => check.id));
    const part = scoreChecks({
      checks,
      records: input.records.filter((record) => ids.has(record.checkId)),
      findings: input.findings.filter((finding) => ids.has(finding.checkId))
    });
    return {
      id,
      label: DIMENSION_LABELS[id],
      value: part.value,
      grade: part.grade,
      availableWeight: part.availableWeight,
      appliedPenalty: part.appliedPenalty,
      scoredChecks: part.scoredChecks,
      checkCount: checks.length
    };
  };

  return {
    ...base,
    dimensions: {
      technical: dimension('technical-security'),
      hygiene: dimension('security-hygiene')
    }
  };
}

function scoreChecks(input: ComputeScoreInput): BaseScore {
  const weightById = new Map(input.checks.map((check) => [check.id, check.scoreWeight]));

  // Only completed checks contribute weight. A check that was blocked,
  // skipped, or errored is absent from both numerator and denominator.
  const scoredChecks: string[] = [];
  let availableWeight = 0;

  for (const record of input.records) {
    if (record.status !== 'completed') continue;

    const weight = weightById.get(record.checkId) ?? 0;
    if (weight <= 0) continue;

    availableWeight += weight;
    scoredChecks.push(record.checkId);
  }

  const scoredCheckIds = new Set(scoredChecks);
  const contributions: ScoreContribution[] = [];
  let appliedPenalty = 0;

  for (const finding of input.findings) {
    // A finding from a check that did not complete, or from a check carrying no
    // weight, cannot move the score.
    if (!scoredCheckIds.has(finding.checkId)) continue;

    const penalty = findingPenalty(finding);
    if (penalty <= 0) continue;

    appliedPenalty += penalty;
    contributions.push({
      checkId: finding.checkId,
      findingId: finding.id,
      status: finding.status,
      severity: finding.severity,
      confidence: finding.confidence,
      observation: finding.observation,
      affectedPageCount: finding.affectedPageCount,
      penalty
    });
  }

  appliedPenalty = round2(appliedPenalty);

  if (availableWeight <= 0) {
    return {
      value: null,
      grade: null,
      availableWeight: 0,
      appliedPenalty,
      scoredChecks,
      contributions
    };
  }

  const ratio = Math.min(1, appliedPenalty / availableWeight);
  const value = Math.max(0, Math.min(100, Math.round(100 * (1 - ratio))));

  return {
    value,
    grade: gradeForScore(value),
    availableWeight: round2(availableWeight),
    appliedPenalty,
    scoredChecks,
    contributions
  };
}

export interface ComputeCoverageInput {
  records: readonly CheckExecutionRecord[];
  /** Total checks selected for the run, including ones that never executed. */
  totalChecks: number;
  discovery: DiscoveryReport;
}

/**
 * Coverage: of the checks that could apply, how many produced a verdict?
 *
 * `not-applicable` checks leave the denominator, because a check with no
 * subject is not a gap in what we looked at. `unable-to-verify` and `error`
 * checks stay in the denominator, because those are real gaps.
 */
export function computeCoverage(input: ComputeCoverageInput): AssessmentCoverage {
  let performed = 0;
  let unableToVerify = 0;
  let notApplicable = 0;
  let errored = 0;

  for (const record of input.records) {
    switch (record.status) {
      case 'completed':
        performed += 1;
        break;
      case 'unable-to-verify':
        unableToVerify += 1;
        break;
      case 'not-applicable':
        notApplicable += 1;
        break;
      case 'error':
        errored += 1;
        break;
    }
  }

  // Checks selected but never recorded (for example, a run cancelled partway)
  // count as gaps rather than silently shrinking the denominator.
  const unrecorded = Math.max(0, input.totalChecks - input.records.length);
  const applicable = Math.max(0, input.totalChecks - notApplicable);

  const percent = applicable === 0 ? 100 : Math.round((performed / applicable) * 100);

  return {
    percent,
    totalChecks: input.totalChecks,
    performed,
    unableToVerify: unableToVerify + unrecorded,
    notApplicable,
    errored,
    pagesAnalyzed: input.discovery.analyzed,
    pagesAttempted: input.discovery.attempted,
    pagesDiscovered: input.discovery.candidates,
    pagesInaccessible: input.discovery.failures.length,
    pagesSkipped: input.discovery.skipped.length,
    explanation: COVERAGE_EXPLANATION,
    limitations: buildLimitations({
      unableToVerify: unableToVerify + unrecorded,
      errored,
      notApplicable,
      discovery: input.discovery
    })
  };
}

/**
 * Fixed text: it defines the two outcomes a reader must not conflate. "No issue
 * observed" is a statement about checks that ran; "could not verify" is a
 * statement about checks that could not.
 */
export const COVERAGE_EXPLANATION =
  '"No issue observed" means a check ran on the pages that could be read and found nothing in the data it examined — it is not a guarantee that none exists. "Could not verify" means the browser could not provide the data (for example a CORS restriction), so nothing can be said either way; it is not a failure and does not lower the score.';

function buildLimitations(params: {
  unableToVerify: number;
  errored: number;
  notApplicable: number;
  discovery: DiscoveryReport;
}): string[] {
  const limitations: string[] = [];
  const { discovery } = params;

  if (discovery.analyzed === 0) {
    limitations.push(
      'No page could be read, so every content-based check is unverified. The reason is listed above; it reflects the connection to the site (an unresponsive host, a blocked request or a browser restriction), not a finding about the site.'
    );
  }

  if (params.unableToVerify > 0) {
    limitations.push(
      `${params.unableToVerify} ${plural(params.unableToVerify, 'check', 'checks')} could not be verified from the browser. These are reported separately and do not affect the score.`
    );
  }

  if (params.errored > 0) {
    limitations.push(
      `${params.errored} ${plural(params.errored, 'check', 'checks')} failed to run. The rest of the assessment completed normally.`
    );
  }

  if (params.notApplicable > 0) {
    limitations.push(
      `${params.notApplicable} ${plural(params.notApplicable, 'check', 'checks')} did not apply to this target and were excluded from both score and coverage.`
    );
  }

  if (discovery.failures.length > 0) {
    limitations.push(
      `${discovery.failures.length} ${plural(discovery.failures.length, 'page', 'pages')} could not be retrieved.`
    );
  }

  if (discovery.limitReached) {
    limitations.push(
      `Discovery stopped at the configured limits (${discovery.maxPages} ${plural(discovery.maxPages, 'page', 'pages')}, depth ${discovery.maxDepth}). Linked pages beyond those limits were not assessed.`
    );
  }

  if (discovery.timedOut) {
    limitations.push(
      'Crawling stopped when its time budget ran out. Pages still queued were not assessed.'
    );
  }

  const stateChanging = discovery.skipped.filter((entry) => entry.reason === 'state-changing').length;
  if (stateChanging > 0) {
    limitations.push(
      `${stateChanging} ${plural(stateChanging, 'link', 'links')} that look like ${stateChanging === 1 ? 'a state-changing action' : 'state-changing actions'} (sign-out, delete and similar) ${stateChanging === 1 ? 'was' : 'were'} deliberately not requested.`
    );
  }

  if (discovery.cancelled) {
    limitations.push('The assessment was cancelled before discovery finished.');
  }

  return limitations;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
