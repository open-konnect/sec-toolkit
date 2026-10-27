/**
 * Pages the assessment tried to read and could not, with a plain reason.
 *
 * "Could not read" is a statement about the transport or the target's
 * availability, never a finding about the site's security.
 */

import { FetchErrorKind, SecurityAssessment } from '../../types';
import { sanitizeUrlForEvidence } from '../findings';
import { parseUrl } from '../url';
import { safeText } from './text';

export interface FetchProblem {
  url: string;
  depth: number;
  kind: FetchErrorKind;
  reason: string;
}

export interface FetchProblemSummary {
  problems: FetchProblem[];
  /** Failures beyond the listed ones. */
  omitted: number;
  /** True when not a single page could be read. */
  nothingRead: boolean;
  /** A different address worth trying, when the entry page failed. */
  suggestion: string | null;
}

const MAX_LISTED = 8;

const REASONS: Record<FetchErrorKind, string> = {
  timeout: 'The site did not respond in time.',
  network: 'The site could not be reached.',
  cors: 'The browser blocked the request (a cross-origin restriction), or the host could not be reached.',
  'http-error': 'The site answered with an error status.',
  'too-large': 'The response was larger than the size limit.',
  'invalid-url': 'The address was not accepted (only public http(s) hostnames can be assessed).',
  aborted: 'The request was cancelled.',
  unsupported: 'Fetching is not available in this mode.'
};

/** `example.com` -> `https://www.example.com/`; null when it does not apply. */
export function suggestWwwVariant(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return null;
  const labels = parsed.hostname.toLowerCase().replace(/\.+$/, '').split('.');
  // Only plain two-label hosts: guessing the registrable domain of
  // example.co.uk without a public-suffix list would suggest nonsense.
  if (labels.length !== 2 || !/^[a-z]{2,}$/.test(labels[1])) return null;
  return `https://www.${labels.join('.')}/`;
}

export function summarizeFetchProblems(assessment: SecurityAssessment): FetchProblemSummary {
  const failures = assessment.discovery?.failures ?? [];
  const problems = failures.slice(0, MAX_LISTED).map((failure) => ({
    url: safeText(sanitizeUrlForEvidence(failure.url), 200),
    depth: failure.depth,
    kind: failure.kind,
    // `unsupported` covers several cases (such as a redirect to another origin),
    // so its own message, which never contains response content, is clearer.
    reason: failure.kind === 'unsupported' ? safeText(failure.message, 200) : REASONS[failure.kind] ?? REASONS.network
  }));
  const nothingRead = assessment.pages.length === 0;
  const entryFailed = failures.some((failure) => failure.depth === 0);
  const retryable = failures.some(
    (failure) => failure.depth === 0 && (failure.kind === 'timeout' || failure.kind === 'network' || failure.kind === 'cors')
  );
  return {
    problems,
    omitted: Math.max(0, failures.length - problems.length),
    nothingRead,
    suggestion: nothingRead && entryFailed && retryable ? suggestWwwVariant(assessment.target.url) : null
  };
}
