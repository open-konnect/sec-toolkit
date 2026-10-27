/**
 * Finding construction and evidence redaction.
 *
 * All evidence passes through `sanitizeEvidenceValue` before it reaches a
 * finding. Target-derived strings are untrusted: they are whitespace-collapsed,
 * stripped of control characters, scrubbed of anything that looks like a
 * credential, and length-capped.
 *
 * Severity is also normalized here rather than being left to each check.
 * A `pass`, `info`, `unable-to-verify`, or `not-applicable` finding is forced
 * to `informational`, which makes "a boundary we could not cross never lowers
 * the score" a property of the data model instead of a convention the scorer
 * has to remember.
 */

import {
  Confidence,
  FindingEvidence,
  FindingStatus,
  ObservationKind,
  SecurityCheckMeta,
  SecurityFinding,
  Severity
} from '../types';
import { parseUrl } from './url';

/** Longest evidence value retained. */
export const MAX_EVIDENCE_LENGTH = 220;

/** Statuses that can never carry a non-informational severity. */
const NON_SCORING_STATUSES: ReadonlySet<FindingStatus> = new Set<FindingStatus>([
  'pass',
  'info',
  'unable-to-verify',
  'not-applicable'
]);

/**
 * Keys whose value is redacted wherever a `key=value` or `key: value` pair
 * appears in evidence.
 */
const SENSITIVE_KEY_PATTERN =
  /\b(pass(?:word|wd)?|pwd|secret|token|auth(?:orization)?|bearer|api[_-]?key|access[_-]?key|private[_-]?key|session(?:[_-]?id)?|cookie|credential|otp|csrf|signature|sig)\b\s*[:=]\s*[^\s&;,"']{2,}/gi;

/** Compact JWS/JWT serialization. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)?/g;

/** A long run of token-shaped characters, examined further in the replacer. */
const OPAQUE_RUN_PATTERN = /[A-Za-z0-9+/_=-]{40,}/g;

/** Control characters are stripped so evidence cannot garble the report. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Decides whether a long character run is secret-shaped.
 *
 * Requiring both letter cases and a digit keeps ordinary content readable —
 * lowercase hex build hashes, long slugs, and dotted paths all stay intact —
 * while catching the mixed-case entropy of an API key or opaque bearer token.
 */
function looksLikeOpaqueSecret(run: string): boolean {
  return /[a-z]/.test(run) && /[A-Z]/.test(run) && /\d/.test(run);
}

/**
 * Redacts and caps one evidence value.
 *
 * Applied to every string that originates from the assessed target.
 */
export function sanitizeEvidenceValue(raw: unknown, maxLength = MAX_EVIDENCE_LENGTH): string {
  if (raw === null || raw === undefined) return '';

  // Bound the input before any pattern work so a pathologically long
  // attribute value cannot turn redaction into a performance problem.
  let value = String(raw)
    .slice(0, maxLength * 4)
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  value = value.replace(JWT_PATTERN, '[redacted-token]');
  value = value.replace(SENSITIVE_KEY_PATTERN, (match) => {
    const separator = match.includes('=') ? '=' : ': ';
    const key = match.split(/\s*[:=]\s*/)[0];
    return `${key}${separator}[redacted]`;
  });
  value = value.replace(OPAQUE_RUN_PATTERN, (run) =>
    looksLikeOpaqueSecret(run) ? '[redacted]' : run
  );

  if (value.length > maxLength) {
    return `${value.slice(0, maxLength - 1)}…`;
  }
  return value;
}

/**
 * Reduces a URL to origin plus path for display.
 *
 * Query strings and fragments are the most likely place for a session token,
 * a reset link, or a signed parameter, so their contents are dropped and only
 * their presence is noted.
 */
export function sanitizeUrlForEvidence(raw: string | null | undefined): string {
  if (!raw) return '';

  const parsed = parseUrl(raw);
  if (!parsed) return sanitizeEvidenceValue(raw);

  const search = parsed.search ? '?…' : '';
  return sanitizeEvidenceValue(`${parsed.origin}${parsed.pathname}${search}`);
}

export interface FindingInit {
  status: FindingStatus;
  observation: ObservationKind;
  confidence: Confidence;
  source: SecurityFinding['source'];
  summary: string;
  explanation: string;
  recommendation: string;
  /** Defaults to the check's declared severity. Ignored for non-scoring statuses. */
  severity?: Severity;
  /** Defaults to the check name. */
  title?: string;
  evidence?: Array<{ label: string; value: unknown; pageUrl?: string }>;
  affectedPages?: readonly string[];
  /** Raw resource URLs involved; sanitized and capped when the finding is built. */
  affectedResources?: ReadonlyArray<string | null | undefined>;
  /**
   * Discriminator for aggregation. Findings sharing a check id, status, and
   * aggregation key collapse into one reported item.
   */
  aggregationKey?: string;
  occurrences?: number;
  /** Ids of the checks whose results this finding combines. */
  correlatedChecks?: readonly string[];
}

/** Most resources a single finding will reference. */
export const MAX_AFFECTED_RESOURCES = 200;

/** Sanitizes, dedupes and caps resource references for a finding. */
function sanitizeResourceRefs(raw: FindingInit['affectedResources']): string[] {
  const refs = new Set<string>();
  for (const url of raw ?? []) {
    const ref = sanitizeUrlForEvidence(url);
    if (ref) refs.add(ref);
    if (refs.size >= MAX_AFFECTED_RESOURCES) break;
  }
  return [...refs];
}

/** Builds a finding with severity normalized and evidence redacted. */
export function createFinding(check: SecurityCheckMeta, init: FindingInit): SecurityFinding {
  const severity = NON_SCORING_STATUSES.has(init.status)
    ? 'informational'
    : (init.severity ?? check.severity);

  const aggregationKey = init.aggregationKey ?? 'default';

  const evidence: FindingEvidence[] = (init.evidence ?? [])
    .map((entry) => ({
      label: entry.label,
      value: sanitizeEvidenceValue(entry.value),
      ...(entry.pageUrl ? { pageUrl: sanitizeUrlForEvidence(entry.pageUrl) } : {})
    }))
    .filter((entry) => entry.value !== '');

  return {
    id: `${check.id}:${init.status}:${aggregationKey}`,
    checkId: check.id,
    category: check.category,
    title: init.title ?? check.name,
    status: init.status,
    severity,
    observation: init.observation,
    confidence: init.confidence,
    source: init.source,
    summary: init.summary,
    explanation: init.explanation,
    recommendation: init.recommendation,
    evidence,
    // Page URLs can carry tokens in the query string, like any other URL.
    affectedPages: [...new Set((init.affectedPages ?? []).map((url) => sanitizeUrlForEvidence(url)))],
    ...(init.affectedResources && init.affectedResources.length > 0
      ? { affectedResources: sanitizeResourceRefs(init.affectedResources) }
      : {}),
    aggregationKey,
    occurrences: Math.max(1, Math.floor(init.occurrences ?? 1)),
    ...(init.correlatedChecks && init.correlatedChecks.length > 0
      ? { correlatedChecks: [...init.correlatedChecks] }
      : {})
  };
}

/**
 * A check could not reach a conclusion.
 *
 * This is never a weakness of the target. Phrasing stays strictly about the
 * limitation and never implies a verdict either way.
 */
export function unableToVerify(
  check: SecurityCheckMeta,
  params: {
    reason: string;
    recommendation?: string;
    affectedPages?: readonly string[];
    evidence?: FindingInit['evidence'];
    aggregationKey?: string;
  }
): SecurityFinding {
  return createFinding(check, {
    status: 'unable-to-verify',
    observation: 'unable-to-verify',
    confidence: 'high',
    source: 'browser',
    title: `${check.name} — not verified`,
    summary: 'This check could not be completed from the browser.',
    explanation: params.reason,
    recommendation:
      params.recommendation ??
      'Re-run this check from a context that can observe the required data, such as a request made from your own server or from the site itself.',
    affectedPages: params.affectedPages,
    evidence: params.evidence,
    aggregationKey: params.aggregationKey ?? 'unverified'
  });
}

/** The precondition for a check does not exist on this target. */
export function notApplicable(
  check: SecurityCheckMeta,
  params: {
    reason: string;
    affectedPages?: readonly string[];
    aggregationKey?: string;
  }
): SecurityFinding {
  return createFinding(check, {
    status: 'not-applicable',
    observation: 'not-applicable',
    confidence: 'high',
    source: 'derived',
    title: `${check.name} — not applicable`,
    summary: 'This check does not apply to what was assessed.',
    explanation: params.reason,
    recommendation: 'No action is needed for this check.',
    affectedPages: params.affectedPages,
    aggregationKey: params.aggregationKey ?? 'not-applicable'
  });
}

/**
 * A check completed and found nothing to report.
 *
 * Wording is deliberately "no issue detected in the checks performed" rather
 * than any claim that the target is secure.
 */
export function passed(
  check: SecurityCheckMeta,
  params: {
    summary: string;
    explanation: string;
    recommendation?: string;
    affectedPages?: readonly string[];
    evidence?: FindingInit['evidence'];
    aggregationKey?: string;
    confidence?: Confidence;
  }
): SecurityFinding {
  return createFinding(check, {
    status: 'pass',
    observation: 'verified-observation',
    confidence: params.confidence ?? 'high',
    source: 'derived',
    summary: params.summary,
    explanation: params.explanation,
    recommendation: params.recommendation ?? 'No change is required based on this check.',
    affectedPages: params.affectedPages,
    evidence: params.evidence,
    aggregationKey: params.aggregationKey ?? 'pass'
  });
}
