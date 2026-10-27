import { describe, expect, it } from 'vitest';
import {
  breadthFactor,
  computeCoverage,
  computeScore,
  findingPenalty,
  gradeForScore,
  MAX_BREADTH_MULTIPLIER,
  SEVERITY_WEIGHTS
} from '../src/tools/website-posture/logic/scoring';
import {
  AggregatedFinding,
  CheckExecutionRecord,
  CheckExecutionStatus,
  DiscoveryReport,
  FindingStatus,
  SecurityCheck
} from '../src/tools/website-posture/types';

function aggregated(overrides: Partial<AggregatedFinding> = {}): AggregatedFinding {
  return {
    id: 'check-a:fail:default',
    checkId: 'check-a',
    category: 'transport',
    title: 'Check A',
    status: 'fail',
    severity: 'high',
    observation: 'verified-observation',
    confidence: 'high',
    source: 'html',
    summary: 's',
    explanation: 'e',
    recommendation: 'r',
    evidence: [],
    affectedPages: ['https://example.com/'],
    aggregationKey: 'default',
    occurrences: 1,
    affectedPageCount: 1,
    affectedPagesTruncated: false,
    evidenceTruncated: false,
    ...overrides
  };
}

function check(id: string, scoreWeight: number): SecurityCheck {
  return {
    id,
    category: 'transport',
    name: id,
    severity: 'high',
    description: 'd',
    scoreWeight,
    modes: ['browser-passive'],
    execute: () => ({ findings: [] })
  };
}

function record(
  checkId: string,
  status: CheckExecutionStatus = 'completed'
): CheckExecutionRecord {
  return {
    checkId,
    checkName: checkId,
    category: 'transport',
    status,
    findings: [],
    durationMs: 1
  };
}

const EMPTY_DISCOVERY: DiscoveryReport = {
  entryUrl: 'https://example.com/',
  maxPages: 1,
  maxDepth: 0,
  candidates: 1,
  analyzed: 1,
  attempted: 1,
  skipped: [],
  failures: [],
  limitReached: false,
  cancelled: false
};

describe('website posture: penalty math', () => {
  it('scales the penalty by severity', () => {
    const high = findingPenalty(aggregated({ severity: 'high' }));
    const medium = findingPenalty(aggregated({ severity: 'medium' }));
    const low = findingPenalty(aggregated({ severity: 'low' }));

    expect(high).toBe(SEVERITY_WEIGHTS.high);
    expect(medium).toBe(SEVERITY_WEIGHTS.medium);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it('halves a warning relative to a fail', () => {
    const fail = findingPenalty(aggregated({ status: 'fail' }));
    const warning = findingPenalty(aggregated({ status: 'warning' }));

    expect(warning).toBe(fail / 2);
  });

  it('never penalizes a status that is not a verdict', () => {
    const neutral: FindingStatus[] = ['pass', 'info', 'unable-to-verify', 'not-applicable'];

    for (const status of neutral) {
      // Even with an (impossible) high severity attached, the status is neutral.
      expect(findingPenalty(aggregated({ status, severity: 'critical' })), status).toBe(0);
    }
  });

  it('never penalizes an informational severity', () => {
    expect(findingPenalty(aggregated({ severity: 'informational' }))).toBe(0);
  });

  it('weighs a high-confidence observation above a low-confidence one', () => {
    const high = findingPenalty(aggregated({ confidence: 'high' }));
    const medium = findingPenalty(aggregated({ confidence: 'medium' }));
    const low = findingPenalty(aggregated({ confidence: 'low' }));

    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it('damps a hardening recommendation well below a verified weakness', () => {
    const verified = findingPenalty(aggregated({ observation: 'verified-observation' }));
    const potential = findingPenalty(aggregated({ observation: 'potential-concern' }));
    const bestPractice = findingPenalty(aggregated({ observation: 'best-practice' }));

    expect(verified).toBeGreaterThan(potential);
    expect(potential).toBeGreaterThan(bestPractice);
    expect(bestPractice).toBeLessThan(verified / 2);
  });

  it('carries no penalty for an unverifiable or inapplicable observation', () => {
    expect(
      findingPenalty(aggregated({ status: 'fail', observation: 'unable-to-verify' }))
    ).toBe(0);
    expect(findingPenalty(aggregated({ status: 'fail', observation: 'not-applicable' }))).toBe(0);
  });

  it('increases modestly with breadth and caps the multiplier', () => {
    expect(breadthFactor(0)).toBe(1);
    expect(breadthFactor(1)).toBe(1);
    expect(breadthFactor(3)).toBeCloseTo(1.1);
    expect(breadthFactor(500)).toBe(MAX_BREADTH_MULTIPLIER);

    const wide = findingPenalty(aggregated({ affectedPageCount: 1_000 }));
    const narrow = findingPenalty(aggregated({ affectedPageCount: 1 }));
    expect(wide).toBe(narrow * MAX_BREADTH_MULTIPLIER);
  });
});

describe('website posture: score computation', () => {
  it('returns a perfect score when every completed check found nothing', () => {
    const score = computeScore({
      findings: [aggregated({ status: 'pass', severity: 'informational' })],
      records: [record('check-a'), record('check-b')],
      checks: [check('check-a', 10), check('check-b', 10)]
    });

    expect(score.value).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.availableWeight).toBe(20);
    expect(score.appliedPenalty).toBe(0);
    expect(score.contributions).toEqual([]);
  });

  it('normalizes the penalty against the weight of completed checks only', () => {
    const findings = [aggregated({ checkId: 'check-a', severity: 'medium', status: 'fail' })];

    const narrow = computeScore({
      findings,
      records: [record('check-a')],
      checks: [check('check-a', 20), check('check-b', 20)]
    });
    const wide = computeScore({
      findings,
      records: [record('check-a'), record('check-b')],
      checks: [check('check-a', 20), check('check-b', 20)]
    });

    // The same issue hurts less when more checks completed around it.
    expect(narrow.availableWeight).toBe(20);
    expect(wide.availableWeight).toBe(40);
    expect(narrow.value!).toBeLessThan(wide.value!);
    expect(narrow.value).toBe(40);
    expect(wide.value).toBe(70);
  });

  it('ignores a finding whose check did not complete', () => {
    const score = computeScore({
      findings: [aggregated({ checkId: 'check-b', status: 'fail', severity: 'critical' })],
      records: [record('check-a'), record('check-b', 'unable-to-verify')],
      checks: [check('check-a', 10), check('check-b', 10)]
    });

    expect(score.value).toBe(100);
    expect(score.appliedPenalty).toBe(0);
    expect(score.scoredChecks).toEqual(['check-a']);
  });

  it('ignores a finding from a zero-weight informational check', () => {
    const score = computeScore({
      findings: [aggregated({ checkId: 'check-info', status: 'fail', severity: 'critical' })],
      records: [record('check-a'), record('check-info')],
      checks: [check('check-a', 10), check('check-info', 0)]
    });

    expect(score.value).toBe(100);
    expect(score.scoredChecks).toEqual(['check-a']);
  });

  it('reports no score when nothing scoreable completed', () => {
    const blocked = computeScore({
      findings: [],
      records: [record('check-a', 'unable-to-verify')],
      checks: [check('check-a', 10)]
    });

    expect(blocked.value).toBeNull();
    expect(blocked.grade).toBeNull();
    expect(blocked.availableWeight).toBe(0);

    const empty = computeScore({ findings: [], records: [], checks: [] });
    expect(empty.value).toBeNull();
  });

  it('floors the score at zero rather than going negative', () => {
    const score = computeScore({
      findings: [
        aggregated({ id: 'f1', checkId: 'check-a', severity: 'critical', affectedPageCount: 50 })
      ],
      records: [record('check-a')],
      checks: [check('check-a', 1)]
    });

    expect(score.value).toBe(0);
    expect(score.grade).toBe('F');
  });

  it('records one contribution per penalizing finding and none for neutral ones', () => {
    const score = computeScore({
      findings: [
        aggregated({ id: 'f1', checkId: 'check-a', status: 'fail', severity: 'medium' }),
        aggregated({ id: 'f2', checkId: 'check-a', status: 'pass', severity: 'informational' }),
        aggregated({ id: 'f3', checkId: 'check-a', status: 'unable-to-verify' })
      ],
      records: [record('check-a')],
      checks: [check('check-a', 50)]
    });

    expect(score.contributions).toHaveLength(1);
    expect(score.contributions[0].findingId).toBe('f1');
    expect(score.contributions[0].penalty).toBe(SEVERITY_WEIGHTS.medium);
    expect(score.appliedPenalty).toBe(SEVERITY_WEIGHTS.medium);
  });

  it('maps scores to grades at the documented boundaries', () => {
    expect(gradeForScore(100)).toBe('A');
    expect(gradeForScore(90)).toBe('A');
    expect(gradeForScore(89)).toBe('B');
    expect(gradeForScore(80)).toBe('B');
    expect(gradeForScore(79)).toBe('C');
    expect(gradeForScore(70)).toBe('C');
    expect(gradeForScore(69)).toBe('D');
    expect(gradeForScore(60)).toBe('D');
    expect(gradeForScore(59)).toBe('F');
    expect(gradeForScore(0)).toBe('F');
  });

  it('is deterministic for the same input', () => {
    const input = {
      findings: [aggregated({ checkId: 'check-a', status: 'warning', confidence: 'medium' })],
      records: [record('check-a'), record('check-b')],
      checks: [check('check-a', 15), check('check-b', 15)]
    } as const;

    expect(computeScore(input)).toEqual(computeScore(input));
  });
});

describe('website posture: coverage computation', () => {
  it('reports full coverage when every check produced a verdict', () => {
    const coverage = computeCoverage({
      records: [record('a'), record('b'), record('c')],
      totalChecks: 3,
      discovery: EMPTY_DISCOVERY
    });

    expect(coverage.percent).toBe(100);
    expect(coverage.performed).toBe(3);
    expect(coverage.limitations).toEqual([]);
  });

  it('treats unverifiable checks as coverage gaps, not failures', () => {
    const coverage = computeCoverage({
      records: [record('a'), record('b', 'unable-to-verify'), record('c', 'unable-to-verify')],
      totalChecks: 3,
      discovery: EMPTY_DISCOVERY
    });

    expect(coverage.percent).toBe(33);
    expect(coverage.unableToVerify).toBe(2);
    expect(coverage.limitations.join(' ')).toMatch(/do not affect the score/i);
  });

  it('removes not-applicable checks from the denominator', () => {
    const coverage = computeCoverage({
      records: [record('a'), record('b'), record('c', 'not-applicable')],
      totalChecks: 3,
      discovery: EMPTY_DISCOVERY
    });

    // 2 of 2 applicable checks produced a verdict.
    expect(coverage.percent).toBe(100);
    expect(coverage.notApplicable).toBe(1);
    expect(coverage.limitations.join(' ')).toMatch(/did not apply/i);
  });

  it('counts an errored check as a gap and names it in the limitations', () => {
    const coverage = computeCoverage({
      records: [record('a'), record('b', 'error')],
      totalChecks: 2,
      discovery: EMPTY_DISCOVERY
    });

    expect(coverage.percent).toBe(50);
    expect(coverage.errored).toBe(1);
    expect(coverage.limitations.join(' ')).toMatch(/failed to run/i);
  });

  it('counts a check that never produced a record as unverified', () => {
    const coverage = computeCoverage({
      records: [record('a')],
      totalChecks: 4,
      discovery: EMPTY_DISCOVERY
    });

    expect(coverage.performed).toBe(1);
    expect(coverage.unableToVerify).toBe(3);
    expect(coverage.percent).toBe(25);
  });

  it('avoids dividing by zero when every check is inapplicable', () => {
    const coverage = computeCoverage({
      records: [record('a', 'not-applicable')],
      totalChecks: 1,
      discovery: EMPTY_DISCOVERY
    });

    expect(coverage.percent).toBe(100);
  });

  it('explains that an unreadable target is a connection problem, not a finding', () => {
    const coverage = computeCoverage({
      records: [record('a', 'unable-to-verify')],
      totalChecks: 1,
      discovery: { ...EMPTY_DISCOVERY, analyzed: 0 }
    });

    expect(coverage.percent).toBe(0);
    expect(coverage.pagesAnalyzed).toBe(0);
    expect(coverage.limitations[0]).toMatch(/connection to the site.*not a finding about the site/i);
  });

  it('surfaces discovery failures, limits, and cancellation', () => {
    const coverage = computeCoverage({
      records: [record('a')],
      totalChecks: 1,
      discovery: {
        ...EMPTY_DISCOVERY,
        maxPages: 5,
        maxDepth: 2,
        analyzed: 3,
        attempted: 4,
        failures: [{ url: 'https://example.com/x', depth: 1, kind: 'network', message: 'm' }],
        limitReached: true,
        cancelled: true
      }
    });

    const text = coverage.limitations.join(' | ');
    expect(coverage.pagesAnalyzed).toBe(3);
    expect(coverage.pagesAttempted).toBe(4);
    expect(text).toMatch(/1 page could not be retrieved/);
    expect(text).toMatch(/stopped at the configured limits \(5 pages, depth 2\)/);
    expect(text).toMatch(/cancelled before discovery finished/);
  });

  it('pluralizes limitation counts correctly', () => {
    const one = computeCoverage({
      records: [record('a', 'unable-to-verify')],
      totalChecks: 1,
      discovery: EMPTY_DISCOVERY
    });
    const many = computeCoverage({
      records: [record('a', 'unable-to-verify'), record('b', 'unable-to-verify')],
      totalChecks: 2,
      discovery: EMPTY_DISCOVERY
    });

    expect(one.limitations.join(' ')).toContain('1 check could not be verified');
    expect(many.limitations.join(' ')).toContain('2 checks could not be verified');
  });
});
