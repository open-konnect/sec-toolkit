/**
 * BrowserPassiveRunner — the only runner implemented in this phase.
 *
 * It owns the pipeline and nothing else:
 *
 *   target → discovery → page/resource inventory → checks → findings
 *          → aggregation → scoring/coverage → SecurityAssessment
 *
 * A future `ServerPassiveRunner` or `VerifiedActiveRunner` implements the same
 * `AssessmentRunner` interface, declares different capabilities, and reuses
 * every stage after discovery unchanged. That is why capability narrowing and
 * well-known probing live here rather than inside the checks.
 *
 * Privacy: analysis results stay in this tab's memory for the lifetime of the
 * run. Nothing is uploaded, persisted, or handed to analytics. With the relay
 * transport the target is fetched server-side by this site's stateless relay,
 * which keeps nothing.
 */

import {
  AnalyzedPage,
  AssessmentCoverage,
  AssessmentError,
  AssessmentInventory,
  AssessmentProgress,
  AssessmentRunInput,
  AssessmentRunner,
  CheckContext,
  FetcherCapabilities,
  PageExtractor,
  PageFetcher,
  SecurityAssessment,
  SecurityCheck,
  SecurityFinding,
  WellKnownProbe,
  WellKnownSummary
} from '../../types';
import { aggregateFindings } from '../aggregation';
import { summarizeThirdPartySurface } from '../analysis/thirdParty';
import { mergeTechnologies } from '../analysis/technology';
import {
  MAX_WELL_KNOWN_BYTES,
  parseRobotsTxt,
  parseSecurityTxt,
  parseSitemap
} from '../analysis/wellKnown';
import { CHECK_REGISTRY } from '../checkRegistry';
import { SECURITY_TXT_PATH } from '../checks/disclosure';
import { ROBOTS_TXT_PATH, SITEMAP_PATH } from '../checks/siteMetadata';
import { DEFAULT_DISCOVERY_OPTIONS, discoverPages, resolveDiscoveryOptions } from '../discovery';
import { runChecks } from '../engine';
import { countResourcesByType, emptyResourceCounts } from '../page';
import { createHtmlScannerExtractor } from '../htmlScanner';
import { buildPageInventory } from '../inventory';
import { COVERAGE_EXPLANATION } from '../scoring';
import { emptyDimensions } from '../maturity';
import { computeCoverage, computeScore } from '../scoring';

/** Fixed paths this runner is willing to probe. Nothing else is requested. */
export const WELL_KNOWN_PATHS: readonly string[] = [
  SECURITY_TXT_PATH,
  ROBOTS_TXT_PATH,
  SITEMAP_PATH
];

const PROBE_TIMEOUT_MS = 6_000;

export interface BrowserPassiveRunnerOptions {
  fetcher: PageFetcher;
  /** Defaults to the inert HTML scanner. */
  extractor?: PageExtractor;
  /** Defaults to the full registry filtered to `browser-passive`. */
  checks?: readonly SecurityCheck[];
  /** Injected for deterministic tests. */
  now?: () => Date;
  clock?: () => number;
}

export function createBrowserPassiveRunner(
  options: BrowserPassiveRunnerOptions
): AssessmentRunner {
  const extractor = options.extractor ?? createHtmlScannerExtractor();
  const now = options.now ?? (() => new Date());
  const clock = options.clock ?? (() => Date.now());

  return {
    id: 'browser-passive-runner',
    mode: 'browser-passive',
    capabilities: options.fetcher.capabilities,

    async run(input: AssessmentRunInput): Promise<SecurityAssessment> {
      const startedAt = now();
      const startedClock = clock();
      const errors: AssessmentError[] = [];

      const checks = (input.checks ?? CHECK_REGISTRY).filter((check) =>
        check.modes.includes('browser-passive')
      );

      const report = (progress: AssessmentProgress) => {
        try {
          input.onProgress?.(progress);
        } catch {
          // A progress callback must never be able to fail a run.
        }
      };

      report({
        phase: 'starting',
        message: 'Normalizing the target URL.',
        pagesAnalyzed: 0,
        checksCompleted: 0,
        totalChecks: checks.length
      });

      /* ---------------------------------------------------------------- */
      /* Discovery                                                        */
      /* ---------------------------------------------------------------- */

      report({
        phase: 'discovering',
        message: 'Retrieving pages.',
        pagesAnalyzed: 0,
        checksCompleted: 0,
        totalChecks: checks.length
      });

      let discovered;
      try {
        discovered = await discoverPages({
          target: input.target,
          fetcher: options.fetcher,
          extractor,
          options: input.discovery,
          signal: input.signal,
          now,
          onPage: (_page, analyzed) =>
            report({
              phase: 'discovering',
              message: `Analyzed ${analyzed} ${analyzed === 1 ? 'page' : 'pages'}.`,
              pagesAnalyzed: analyzed,
              checksCompleted: 0,
              totalChecks: checks.length
            })
        });
      } catch (error) {
        // Discovery itself failing is recoverable: the assessment continues
        // with zero pages, and every markup check reports unable-to-verify.
        errors.push({
          stage: 'fetch',
          kind: 'discovery-failed',
          message: safeMessage(error),
          url: input.target.url
        });

        const resolved = resolveDiscoveryOptions(
          input.discovery,
          options.fetcher.capabilities.canDiscoverLinkedPages
        );

        discovered = {
          pages: [],
          report: {
            entryUrl: input.target.url,
            maxPages: resolved.maxPages,
            maxDepth: resolved.maxDepth,
            candidates: 1,
            analyzed: 0,
            attempted: 0,
            skipped: [],
            failures: [
              {
                url: input.target.url,
                depth: 0,
                kind: 'network' as const,
                message: safeMessage(error)
              }
            ],
            limitReached: false,
            cancelled: input.signal?.aborted === true,
            timedOut: false,
            scopeOrigin: input.target.origin
          }
        };
      }

      const { pages, report: discoveryReport } = discovered;
      const primaryPage = pages.find((page) => page.depth === 0) ?? pages[0] ?? null;

      /* ---------------------------------------------------------------- */
      /* Well-known probes                                                */
      /* ---------------------------------------------------------------- */

      let wellKnown: WellKnownProbe[] = [];

      if (options.fetcher.capabilities.canProbeWellKnownPaths && !input.signal?.aborted) {
        report({
          phase: 'probing',
          message: 'Checking well-known paths.',
          pagesAnalyzed: pages.length,
          checksCompleted: 0,
          totalChecks: checks.length
        });

        wellKnown = await probeWellKnownPaths(options.fetcher, input, errors, now);
      }

      /* ---------------------------------------------------------------- */
      /* Capability narrowing                                             */
      /* ---------------------------------------------------------------- */

      const capabilities = narrowCapabilities(options.fetcher.capabilities, {
        anyPageRead: pages.length > 0,
        headersReadable: primaryPage?.headers.visibility === 'readable',
        anyProbeObservable: wellKnown.some((probe) => probe.observable)
      });

      /* ---------------------------------------------------------------- */
      /* Checks                                                           */
      /* ---------------------------------------------------------------- */

      report({
        phase: 'checking',
        message: `Running ${checks.length} checks.`,
        pagesAnalyzed: pages.length,
        checksCompleted: 0,
        totalChecks: checks.length
      });

      const context: CheckContext = {
        target: input.target,
        mode: 'browser-passive',
        pages,
        primaryPage,
        capabilities,
        wellKnown,
        now
      };

      const records = await runChecks(context, checks, {
        signal: input.signal,
        clock,
        onCheckComplete: (record, completed, total) => {
          if (record.status === 'error' && record.error) {
            errors.push({
              stage: 'check',
              kind: 'check-threw',
              message: record.error,
              checkId: record.checkId
            });
          }
          report({
            phase: 'checking',
            message: `Completed ${completed} of ${total} checks.`,
            pagesAnalyzed: pages.length,
            checksCompleted: completed,
            totalChecks: total
          });
        }
      });

      /* ---------------------------------------------------------------- */
      /* Aggregation, scoring, coverage                                   */
      /* ---------------------------------------------------------------- */

      report({
        phase: 'aggregating',
        message: 'Aggregating findings.',
        pagesAnalyzed: pages.length,
        checksCompleted: records.length,
        totalChecks: checks.length
      });

      const rawFindings: SecurityFinding[] = records.flatMap((record) => record.findings);

      let findings = aggregateFindings(rawFindings, { totalPages: pages.length });
      let coverage: AssessmentCoverage;
      let score;

      try {
        score = computeScore({ findings, records, checks });
      } catch (error) {
        errors.push({ stage: 'score', kind: 'scoring-failed', message: safeMessage(error) });
        score = {
          value: null,
          grade: null,
          availableWeight: 0,
          appliedPenalty: 0,
          scoredChecks: [],
          contributions: [],
          dimensions: emptyDimensions()
        };
      }

      try {
        coverage = computeCoverage({
          records,
          totalChecks: checks.length,
          discovery: discoveryReport
        });
      } catch (error) {
        errors.push({ stage: 'score', kind: 'coverage-failed', message: safeMessage(error) });
        coverage = {
          percent: 0,
          totalChecks: checks.length,
          performed: 0,
          unableToVerify: checks.length,
          notApplicable: 0,
          errored: 0,
          pagesAnalyzed: pages.length,
          pagesAttempted: discoveryReport.attempted,
          pagesDiscovered: discoveryReport.candidates,
          pagesInaccessible: discoveryReport.failures.length,
          pagesSkipped: discoveryReport.skipped.length,
          limitations: ['Coverage could not be calculated for this run.'],
          explanation: COVERAGE_EXPLANATION
        };
        findings = findings.slice();
      }

      const completedAt = now();

      report({
        phase: 'complete',
        message: 'Assessment complete.',
        pagesAnalyzed: pages.length,
        checksCompleted: records.length,
        totalChecks: checks.length
      });

      return {
        target: input.target,
        mode: 'browser-passive',
        runnerId: 'browser-passive-runner',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, clock() - startedClock),
        score,
        coverage,
        findings,
        rawFindingCount: rawFindings.length,
        pages,
        inventory: buildInventory(pages),
        pageInventory: buildPageInventory(pages),
        checksPerformed: records.filter((r) => r.status === 'completed').map((r) => r.checkId),
        checksUnableToVerify: records
          .filter((r) => r.status === 'unable-to-verify')
          .map((r) => r.checkId),
        checksNotApplicable: records
          .filter((r) => r.status === 'not-applicable')
          .map((r) => r.checkId),
        checksErrored: records.filter((r) => r.status === 'error').map((r) => r.checkId),
        checkRecords: records,
        discovery: discoveryReport,
        wellKnown,
        capabilities,
        errors
      };
    }
  };
}

/**
 * Narrows declared capabilities to what this run actually achieved.
 *
 * A transport can advertise that it reads bodies and still have every read
 * blocked by CORS for this particular target. Without this step, markup checks
 * would run against an empty page list and report confident nonsense instead
 * of `unable-to-verify`.
 */
export function narrowCapabilities(
  declared: FetcherCapabilities,
  observed: { anyPageRead: boolean; headersReadable: boolean; anyProbeObservable: boolean }
): FetcherCapabilities {
  return {
    canReadHtmlBody: declared.canReadHtmlBody && observed.anyPageRead,
    canReadResponseHeaders: declared.canReadResponseHeaders && observed.headersReadable,
    canFollowRedirects: declared.canFollowRedirects,
    canDiscoverLinkedPages: declared.canDiscoverLinkedPages,
    canProbeWellKnownPaths: declared.canProbeWellKnownPaths && observed.anyProbeObservable
  };
}

/**
 * Parses a probe body into a bounded structural summary.
 *
 * The body itself is never returned, and the caller drops it as soon as this
 * returns. A `security.txt` routinely names individuals and a sitemap can list
 * thousands of URLs, so only counts, booleans, and a capped list of
 * query-stripped paths survive.
 */
function summarizeProbe(
  path: string,
  body: string,
  context: { origin: string; truncated: boolean; now: () => Date }
): WellKnownSummary | undefined {
  switch (path) {
    case SECURITY_TXT_PATH:
      return parseSecurityTxt(body, { origin: context.origin, now: context.now() });
    case ROBOTS_TXT_PATH:
      return parseRobotsTxt(body, { baseUrl: context.origin });
    case SITEMAP_PATH:
      return parseSitemap(body, { origin: context.origin, truncated: context.truncated });
    default:
      return undefined;
  }
}

/**
 * Requests the fixed well-known paths.
 *
 * Each body is read with a low byte cap, parsed into a bounded summary, and
 * then dropped — the raw text never reaches a check, a finding, or the report.
 */
async function probeWellKnownPaths(
  fetcher: PageFetcher,
  input: AssessmentRunInput,
  errors: AssessmentError[],
  now: () => Date
): Promise<WellKnownProbe[]> {
  const probes: WellKnownProbe[] = [];

  for (const path of WELL_KNOWN_PATHS) {
    const url = `${input.target.origin}${path}`;

    try {
      const result = await fetcher.fetchPage({
        url,
        timeoutMs: PROBE_TIMEOUT_MS,
        signal: input.signal,
        maxBytes: MAX_WELL_KNOWN_BYTES
      });

      if (result.ok) {
        let summary: WellKnownSummary | undefined;

        if (result.body) {
          try {
            summary = summarizeProbe(path, result.body, {
              origin: input.target.origin,
              truncated: result.truncated,
              now
            });
          } catch (error) {
            // A malformed file must never fail the run. The probe still
            // reports that the path exists; it simply carries no summary.
            errors.push({
              stage: 'extract',
              kind: 'probe-parse-failed',
              message: safeMessage(error),
              url
            });
          }
        }

        probes.push({
          path,
          url,
          observable: true,
          found: true,
          status: result.status,
          contentType: result.contentType,
          bytes: result.bytes,
          ...(summary ? { summary } : {})
        });
        continue;
      }

      // A readable 404 is a real answer; a blocked request is not.
      const definitelyAbsent = result.error?.kind === 'http-error' && result.status === 404;

      probes.push({
        path,
        url,
        observable: definitelyAbsent,
        found: definitelyAbsent ? false : null,
        status: result.status,
        contentType: result.contentType,
        bytes: 0,
        reason: definitelyAbsent ? undefined : result.error?.message
      });
    } catch (error) {
      errors.push({ stage: 'fetch', kind: 'probe-failed', message: safeMessage(error), url });
      probes.push({
        path,
        url,
        observable: false,
        found: null,
        status: null,
        contentType: null,
        bytes: 0,
        reason: 'The probe request could not be completed.'
      });
    }
  }

  return probes;
}

function buildInventory(pages: readonly AnalyzedPage[]): AssessmentInventory {
  const externalDomains = new Set<string>();
  const protocols = new Set<string>();

  let formCount = 0;
  let passwordFormCount = 0;
  let inlineScriptCount = 0;
  let resourceCount = 0;

  for (const page of pages) {
    for (const domain of page.externalDomains) externalDomains.add(domain);
    for (const protocol of page.protocols) protocols.add(protocol);

    formCount += page.forms.length;
    passwordFormCount += page.forms.filter((form) => form.hasPasswordField).length;
    inlineScriptCount += page.inlineScriptCount;
    resourceCount += page.resources.length;
  }

  return {
    pageCount: pages.length,
    resourceCount,
    resourcesByType: pages.length > 0 ? countResourcesByType(pages) : emptyResourceCounts(),
    externalDomains: [...externalDomains].sort(),
    protocols: [...protocols].sort(),
    formCount,
    passwordFormCount,
    inlineScriptCount,
    detectedTechnologies: mergeTechnologies(pages.map((page) => page.detectedTechnologies)),
    thirdParty: summarizeThirdPartySurface(pages)
  };
}

/** Keeps runner-level error text free of target content. */
function safeMessage(error: unknown): string {
  if (error instanceof Error) {
    return `The stage failed with ${error.name || 'an error'}.`;
  }
  return 'The stage failed.';
}

/** Default discovery options, re-exported so the UI can show the baseline. */
export { DEFAULT_DISCOVERY_OPTIONS };
