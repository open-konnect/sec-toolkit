/**
 * Check execution engine.
 *
 * Runs checks one at a time and converts every outcome — including a thrown
 * error — into a `CheckExecutionRecord`. Failure is isolated per check by
 * design: one broken check must never abort an assessment, and the record it
 * leaves behind lowers coverage rather than inventing a finding.
 */

import {
  CheckContext,
  CheckExecutionRecord,
  CheckExecutionStatus,
  SecurityCheck,
  SecurityFinding
} from '../types';
import { CAPABILITY_REASONS, missingCapabilities } from './checkRegistry';
import { createFinding, unableToVerify } from './findings';

export interface RunChecksOptions {
  /** Called after each check so the UI can show progress. */
  onCheckComplete?: (record: CheckExecutionRecord, completed: number, total: number) => void;
  signal?: AbortSignal;
  /** Injected for deterministic durations in tests. */
  clock?: () => number;
}

export async function runChecks(
  context: CheckContext,
  checks: readonly SecurityCheck[],
  options: RunChecksOptions = {}
): Promise<CheckExecutionRecord[]> {
  const clock = options.clock ?? (() => Date.now());
  const records: CheckExecutionRecord[] = [];

  for (const check of checks) {
    if (options.signal?.aborted) break;

    const startedAt = clock();

    // Capability gating happens here rather than inside each check, so no
    // check body can mistake an observation boundary for a weakness.
    const missing = missingCapabilities(check, context.capabilities);
    if (missing.length > 0) {
      records.push({
        checkId: check.id,
        checkName: check.name,
        category: check.category,
        status: 'unable-to-verify',
        missingCapabilities: missing,
        findings: [
          unableToVerify(check, {
            reason: missing.map((capability) => CAPABILITY_REASONS[capability]).join(' '),
            affectedPages: [context.target.url]
          })
        ],
        durationMs: clock() - startedAt
      });
      options.onCheckComplete?.(records[records.length - 1], records.length, checks.length);
      continue;
    }

    try {
      const outcome = await check.execute(context);
      const findings = Array.isArray(outcome?.findings) ? outcome.findings : [];

      records.push({
        checkId: check.id,
        checkName: check.name,
        category: check.category,
        status: deriveStatus(findings),
        findings,
        durationMs: clock() - startedAt
      });
    } catch (error) {
      records.push({
        checkId: check.id,
        checkName: check.name,
        category: check.category,
        status: 'error',
        error: safeCheckError(error),
        findings: [errorFinding(check, error)],
        durationMs: clock() - startedAt
      });
    }

    options.onCheckComplete?.(records[records.length - 1], records.length, checks.length);
  }

  return records;
}

/**
 * Derives a check's execution status from the findings it produced.
 *
 * A check that returned any actionable verdict counts as completed, even if
 * some pages were individually unverifiable — partial credit is more accurate
 * than discarding the verdicts that were reached.
 */
export function deriveStatus(findings: readonly SecurityFinding[]): CheckExecutionStatus {
  if (findings.length === 0) return 'not-applicable';

  const hasVerdict = findings.some(
    (finding) =>
      finding.status === 'pass' ||
      finding.status === 'warning' ||
      finding.status === 'fail' ||
      finding.status === 'info'
  );
  if (hasVerdict) return 'completed';

  if (findings.some((finding) => finding.status === 'unable-to-verify')) {
    return 'unable-to-verify';
  }

  return 'not-applicable';
}

/**
 * A check crashed. The finding records the failure without claiming anything
 * about the target, and `informational` severity keeps it out of the score.
 */
function errorFinding(check: SecurityCheck, error: unknown): SecurityFinding {
  return createFinding(check, {
    status: 'unable-to-verify',
    observation: 'unable-to-verify',
    confidence: 'high',
    source: 'derived',
    title: `${check.name} — check failed to run`,
    summary: 'This check did not complete, so it produced no verdict.',
    explanation: `${safeCheckError(error)} The rest of the assessment continued normally. This says nothing about the target.`,
    recommendation: 'Re-run the assessment. If the check keeps failing, please report it.',
    aggregationKey: 'check-error'
  });
}

/** Keeps error text free of any target-derived content. */
function safeCheckError(error: unknown): string {
  if (error instanceof Error) {
    return `The check threw ${error.name || 'an error'} while running.`;
  }
  return 'The check threw a non-error value while running.';
}
