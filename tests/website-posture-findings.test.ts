import { describe, expect, it } from 'vitest';
import {
  aggregateFindings,
  aggregationGroupKey,
  countByStatus,
  MAX_LISTED_PAGES,
  sortFindings
} from '../src/tools/website-posture/logic/aggregation';
import {
  createFinding,
  MAX_EVIDENCE_LENGTH,
  notApplicable,
  passed,
  sanitizeEvidenceValue,
  sanitizeUrlForEvidence,
  unableToVerify
} from '../src/tools/website-posture/logic/findings';
import {
  AggregatedFinding,
  FindingStatus,
  SecurityCheckMeta,
  SecurityFinding
} from '../src/tools/website-posture/types';

const CHECK: SecurityCheckMeta = {
  id: 'csp-unsafe-inline',
  category: 'content-security-policy',
  name: 'CSP allows unsafe-inline',
  severity: 'high'
};

describe('website posture: evidence redaction', () => {
  it('redacts a compact JWT wherever it appears', () => {
    const value = sanitizeEvidenceValue(
      'Authorization header was eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123 on load'
    );

    expect(value).toContain('[redacted-token]');
    expect(value).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts the value of a sensitive key while keeping the key visible', () => {
    expect(sanitizeEvidenceValue('password=hunter2hunter2')).toBe('password=[redacted]');
    expect(sanitizeEvidenceValue('api_key: AKIAsomethinglong')).toBe('api_key: [redacted]');
    expect(sanitizeEvidenceValue('Set-Cookie=sessionvalue123')).toContain('[redacted]');
  });

  it('redacts a long mixed-case token-shaped run', () => {
    const secret = 'aB3'.repeat(20);
    expect(sanitizeEvidenceValue(`integrity ${secret}`)).toBe('integrity [redacted]');
  });

  it('keeps ordinary long strings readable', () => {
    const hash = 'a'.repeat(40);
    expect(sanitizeEvidenceValue(`sha384-${hash}`)).toContain(hash);

    const slug = 'some-very-long-but-harmless-build-asset-filename-chunk'.repeat(1);
    expect(sanitizeEvidenceValue(slug)).toBe(slug);
  });

  it('strips control characters and collapses whitespace', () => {
    expect(sanitizeEvidenceValue('a\u0000b\n\n  c\td')).toBe('a b c d');
  });

  it('caps the value and marks the truncation', () => {
    const value = sanitizeEvidenceValue('x'.repeat(1_000));
    expect(value).toHaveLength(MAX_EVIDENCE_LENGTH);
    expect(value.endsWith('…')).toBe(true);
  });

  it('handles non-string and empty input without throwing', () => {
    expect(sanitizeEvidenceValue(null)).toBe('');
    expect(sanitizeEvidenceValue(undefined)).toBe('');
    expect(sanitizeEvidenceValue(42)).toBe('42');
    expect(sanitizeEvidenceValue({})).toBe('[object Object]');
  });

  it('drops query and fragment contents from a URL but notes a query existed', () => {
    expect(sanitizeUrlForEvidence('https://example.com/reset?token=abc123#x')).toBe(
      'https://example.com/reset?…'
    );
    expect(sanitizeUrlForEvidence('https://example.com/a')).toBe('https://example.com/a');
  });

  it('falls back to plain redaction for an unparseable URL', () => {
    expect(sanitizeUrlForEvidence('not a url')).toBe('not a url');
    expect(sanitizeUrlForEvidence(null)).toBe('');
  });
});

describe('website posture: finding creation', () => {
  it('builds a stable id from check, status, and aggregation key', () => {
    const finding = createFinding(CHECK, {
      status: 'warning',
      observation: 'potential-concern',
      confidence: 'medium',
      source: 'html',
      summary: 's',
      explanation: 'e',
      recommendation: 'r',
      aggregationKey: 'script-src'
    });

    expect(finding.id).toBe('csp-unsafe-inline:warning:script-src');
    expect(finding.checkId).toBe('csp-unsafe-inline');
    expect(finding.category).toBe('content-security-policy');
    expect(finding.title).toBe(CHECK.name);
    expect(finding.aggregationKey).toBe('script-src');
  });

  it('inherits the check severity for a verdict and allows an override', () => {
    const inherited = createFinding(CHECK, {
      status: 'fail',
      observation: 'verified-observation',
      confidence: 'high',
      source: 'html',
      summary: 's',
      explanation: 'e',
      recommendation: 'r'
    });
    expect(inherited.severity).toBe('high');

    const overridden = createFinding(CHECK, {
      status: 'fail',
      observation: 'verified-observation',
      confidence: 'high',
      source: 'html',
      summary: 's',
      explanation: 'e',
      recommendation: 'r',
      severity: 'critical'
    });
    expect(overridden.severity).toBe('critical');
  });

  it('forces informational severity on every non-verdict status', () => {
    const statuses: FindingStatus[] = ['pass', 'info', 'unable-to-verify', 'not-applicable'];

    for (const status of statuses) {
      const finding = createFinding(CHECK, {
        status,
        observation: 'verified-observation',
        confidence: 'high',
        source: 'browser',
        summary: 's',
        explanation: 'e',
        recommendation: 'r',
        // Even an explicit critical severity must not survive.
        severity: 'critical'
      });

      expect(finding.severity, status).toBe('informational');
    }
  });

  it('redacts evidence, drops empties, and deduplicates affected pages', () => {
    const finding = createFinding(CHECK, {
      status: 'warning',
      observation: 'potential-concern',
      confidence: 'low',
      source: 'html',
      summary: 's',
      explanation: 'e',
      recommendation: 'r',
      evidence: [
        { label: 'Policy', value: "script-src 'unsafe-inline'" },
        { label: 'Token', value: 'token=abcdefghijkl' },
        { label: 'Empty', value: '   ' },
        { label: 'Missing', value: null }
      ],
      affectedPages: ['https://example.com/', 'https://example.com/', 'https://example.com/a']
    });

    expect(finding.evidence.map((entry) => entry.label)).toEqual(['Policy', 'Token']);
    expect(finding.evidence[1].value).toBe('token=[redacted]');
    expect(finding.affectedPages).toEqual(['https://example.com/', 'https://example.com/a']);
  });

  it('normalizes the occurrence count to a positive integer', () => {
    const build = (occurrences: number) =>
      createFinding(CHECK, {
        status: 'warning',
        observation: 'potential-concern',
        confidence: 'low',
        source: 'html',
        summary: 's',
        explanation: 'e',
        recommendation: 'r',
        occurrences
      }).occurrences;

    expect(build(0)).toBe(1);
    expect(build(-5)).toBe(1);
    expect(build(3.7)).toBe(3);
  });
});

describe('website posture: unable-to-verify and not-applicable helpers', () => {
  it('describes the limitation without implying a verdict', () => {
    const finding = unableToVerify(CHECK, {
      reason: 'Response headers are not readable because of CORS.'
    });

    expect(finding.status).toBe('unable-to-verify');
    expect(finding.observation).toBe('unable-to-verify');
    expect(finding.severity).toBe('informational');
    expect(finding.aggregationKey).toBe('unverified');
    expect(finding.summary).toMatch(/could not be completed/i);
    // The honesty requirement: never phrased as a weakness of the target.
    expect(`${finding.summary} ${finding.explanation}`).not.toMatch(/insecure|vulnerab|missing/i);
  });

  it('marks an inapplicable precondition without any action', () => {
    const finding = notApplicable(CHECK, { reason: 'The page serves no Content-Security-Policy.' });

    expect(finding.status).toBe('not-applicable');
    expect(finding.severity).toBe('informational');
    expect(finding.recommendation).toMatch(/no action/i);
  });

  it('states a clean result as "no issue detected" rather than "secure"', () => {
    const finding = passed(CHECK, {
      summary: 'No issue detected in this check.',
      explanation: 'The policy contained no unsafe-inline source.'
    });

    expect(finding.status).toBe('pass');
    expect(finding.observation).toBe('verified-observation');
    expect(finding.severity).toBe('informational');
    expect(finding.summary).not.toMatch(/\bsecure\b|no vulnerabilit/i);
  });
});

/** Minimal finding factory for aggregation tests. */
function finding(overrides: Partial<SecurityFinding> & { status?: FindingStatus } = {}) {
  const base = createFinding(CHECK, {
    status: overrides.status ?? 'warning',
    observation: 'potential-concern',
    confidence: 'medium',
    source: 'html',
    summary: 's',
    explanation: 'e',
    recommendation: 'r'
  });

  return { ...base, ...overrides } as SecurityFinding;
}

describe('website posture: finding aggregation', () => {
  it('collapses the same issue across many pages into one item', () => {
    const findings = Array.from({ length: 7 }, (_, index) =>
      finding({
        affectedPages: [`https://example.com/p${index}`],
        evidence: [{ label: 'Policy', value: "script-src 'unsafe-inline'" }]
      })
    );

    const aggregated = aggregateFindings(findings);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].affectedPageCount).toBe(7);
    expect(aggregated[0].occurrences).toBe(7);
    // Identical evidence is shown once, not seven times.
    expect(aggregated[0].evidence).toHaveLength(1);
  });

  it('keeps different statuses of one check as separate honest items', () => {
    const aggregated = aggregateFindings([
      finding({ status: 'warning', affectedPages: ['https://example.com/a'] }),
      finding({ status: 'pass', affectedPages: ['https://example.com/b'] })
    ]);

    expect(aggregated).toHaveLength(2);
    expect(aggregated.map((item) => item.status)).toEqual(['warning', 'pass']);
    expect(aggregated[0].affectedPages).toEqual(['https://example.com/a']);
  });

  it('keeps different aggregation keys of one check separate', () => {
    const a = finding({ aggregationKey: 'script-src', id: 'x:warning:script-src' });
    const b = finding({ aggregationKey: 'style-src', id: 'x:warning:style-src' });

    expect(aggregationGroupKey(a)).not.toBe(aggregationGroupKey(b));
    expect(aggregateFindings([a, b])).toHaveLength(2);
  });

  it('takes the worst severity and strongest confidence of the group', () => {
    const aggregated = aggregateFindings([
      finding({ severity: 'low', confidence: 'low', affectedPages: ['https://example.com/a'] }),
      finding({ severity: 'critical', confidence: 'high', affectedPages: ['https://example.com/b'] }),
      finding({ severity: 'medium', confidence: 'medium', affectedPages: ['https://example.com/c'] })
    ]);

    expect(aggregated[0].severity).toBe('critical');
    expect(aggregated[0].confidence).toBe('high');
  });

  it('caps the listed pages and the evidence sample but reports the true totals', () => {
    const findings = Array.from({ length: MAX_LISTED_PAGES + 5 }, (_, index) =>
      finding({
        affectedPages: [`https://example.com/p${String(index).padStart(3, '0')}`],
        evidence: [{ label: 'Resource', value: `https://cdn.example.net/a${index}.js` }]
      })
    );

    const aggregated = aggregateFindings(findings, { maxListedPages: 3, maxSampledEvidence: 2 });

    expect(aggregated[0].affectedPages).toHaveLength(3);
    expect(aggregated[0].affectedPageCount).toBe(MAX_LISTED_PAGES + 5);
    expect(aggregated[0].affectedPagesTruncated).toBe(true);
    expect(aggregated[0].evidence).toHaveLength(2);
    expect(aggregated[0].evidenceTruncated).toBe(true);
  });

  it('does not mark truncation when everything fits', () => {
    const aggregated = aggregateFindings([
      finding({
        affectedPages: ['https://example.com/a'],
        evidence: [{ label: 'Policy', value: 'default-src self' }]
      })
    ]);

    expect(aggregated[0].affectedPagesTruncated).toBe(false);
    expect(aggregated[0].evidenceTruncated).toBe(false);
  });

  it('handles an empty input', () => {
    expect(aggregateFindings([])).toEqual([]);
  });
});

describe('website posture: report ordering and counts', () => {
  function aggregated(overrides: Partial<AggregatedFinding>): AggregatedFinding {
    return {
      ...finding(),
      affectedPageCount: 1,
      affectedPagesTruncated: false,
      evidenceTruncated: false,
      ...overrides
    } as AggregatedFinding;
  }

  it('orders by status, then severity, then breadth', () => {
    const sorted = sortFindings([
      aggregated({ id: 'e', status: 'pass', severity: 'informational' }),
      aggregated({ id: 'd', status: 'unable-to-verify', severity: 'informational' }),
      aggregated({ id: 'c', status: 'warning', severity: 'medium' }),
      aggregated({ id: 'b', status: 'fail', severity: 'high', affectedPageCount: 1 }),
      aggregated({ id: 'a', status: 'fail', severity: 'high', affectedPageCount: 9 })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('breaks ties deterministically by id', () => {
    const first = sortFindings([
      aggregated({ id: 'z', status: 'fail', severity: 'high' }),
      aggregated({ id: 'a', status: 'fail', severity: 'high' })
    ]);
    const second = sortFindings([
      aggregated({ id: 'a', status: 'fail', severity: 'high' }),
      aggregated({ id: 'z', status: 'fail', severity: 'high' })
    ]);

    expect(first.map((item) => item.id)).toEqual(['a', 'z']);
    expect(second.map((item) => item.id)).toEqual(['a', 'z']);
  });

  it('counts every status, including the ones that are absent', () => {
    const counts = countByStatus([
      aggregated({ id: '1', status: 'fail' }),
      aggregated({ id: '2', status: 'fail' }),
      aggregated({ id: '3', status: 'unable-to-verify' })
    ]);

    expect(counts).toEqual({
      pass: 0,
      warning: 0,
      fail: 2,
      info: 0,
      'unable-to-verify': 1,
      'not-applicable': 0
    });
  });
});
