/**
 * Bounded, same-origin page discovery.
 *
 * This is a breadth-first reader, not a crawler in the aggressive sense. It
 * only ever issues GET requests for same-origin HTML documents that the target
 * already links to, under hard caps on page count, depth, concurrency, and
 * per-page time.
 *
 * It never:
 * - leaves the target origin,
 * - submits a form or follows a non-GET action,
 * - sends credentials or attempts to authenticate,
 * - varies or fuzzes a parameter,
 * - downloads binary assets,
 * - executes anything it reads.
 *
 * Every failure is isolated: one unreachable page, one malformed URL, or one
 * unparseable document reduces coverage and never aborts the assessment. The
 * assessment remains useful when only the entry page can be read.
 */

import {
  AnalyzedPage,
  AssessmentTarget,
  DiscoveryOptions,
  DiscoveryReport,
  PageExtractor,
  PageFetchFailure,
  PageFetcher,
  SkipReason,
  SkippedUrl
} from '../types';
import { buildAnalyzedPage } from './page';
import {
  isSameOrigin,
  looksLikeBinaryResource,
  looksStateChanging,
  normalizeUrl,
  parseUrl,
  urlDedupeKey
} from './url';

/** Defaults analyze the entry page only; breadth is opt-in. */
export const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
  maxPages: 1,
  maxDepth: 0,
  perPageTimeoutMs: 10_000,
  concurrency: 3,
  totalTimeoutMs: 60_000
};

/** Hard ceilings the UI cannot exceed, so a run always terminates. */
export const DISCOVERY_LIMITS = {
  maxPages: 25,
  maxDepth: 3,
  maxConcurrency: 6,
  maxTimeoutMs: 30_000,
  minTimeoutMs: 1_000,
  maxTotalTimeoutMs: 180_000,
  minTotalTimeoutMs: 5_000,
  /** Cap on the reported skip list, which is for explanation only. */
  maxSkippedRecorded: 200
} as const;

export interface DiscoveryInput {
  target: AssessmentTarget;
  fetcher: PageFetcher;
  extractor: PageExtractor;
  options?: Partial<DiscoveryOptions>;
  signal?: AbortSignal;
  /** Injected for deterministic tests. */
  now?: () => Date;
  onPage?: (page: AnalyzedPage, analyzed: number) => void;
}

export interface DiscoveryResult {
  pages: AnalyzedPage[];
  report: DiscoveryReport;
}

/** Clamps caller options into the range the engine guarantees to terminate in. */
export function resolveDiscoveryOptions(
  options: Partial<DiscoveryOptions> | undefined,
  fetcherCanDiscover: boolean
): DiscoveryOptions {
  const requested = { ...DEFAULT_DISCOVERY_OPTIONS, ...(options ?? {}) };

  // A transport that cannot reach linked pages is pinned to the entry page
  // rather than being asked for fetches it will only fail.
  const maxPages = fetcherCanDiscover
    ? clamp(Math.floor(requested.maxPages), 1, DISCOVERY_LIMITS.maxPages)
    : 1;
  const maxDepth = fetcherCanDiscover
    ? clamp(Math.floor(requested.maxDepth), 0, DISCOVERY_LIMITS.maxDepth)
    : 0;

  return {
    maxPages,
    maxDepth,
    perPageTimeoutMs: clamp(
      Math.floor(requested.perPageTimeoutMs),
      DISCOVERY_LIMITS.minTimeoutMs,
      DISCOVERY_LIMITS.maxTimeoutMs
    ),
    concurrency: clamp(Math.floor(requested.concurrency), 1, DISCOVERY_LIMITS.maxConcurrency),
    totalTimeoutMs: clamp(
      Math.floor(requested.totalTimeoutMs),
      DISCOVERY_LIMITS.minTotalTimeoutMs,
      DISCOVERY_LIMITS.maxTotalTimeoutMs
    )
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

interface QueueItem {
  url: string;
  depth: number;
}

export async function discoverPages(input: DiscoveryInput): Promise<DiscoveryResult> {
  const { target, fetcher } = input;
  const now = input.now ?? (() => new Date());
  const options = resolveDiscoveryOptions(input.options, fetcher.capabilities.canDiscoverLinkedPages);

  // One controller serves both the caller's cancellation and the total time
  // budget, so every in-flight fetch stops the same way for either reason.
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.totalTimeoutMs);
  const signal = controller.signal;

  const pages: AnalyzedPage[] = [];
  const skipped: SkippedUrl[] = [];
  const failures: PageFetchFailure[] = [];

  /** Deduplication keys for every URL already queued, fetched, or rejected. */
  const seen = new Set<string>();
  /** Keys of pages actually analyzed, so redirects converging on one page count once. */
  const analyzedKeys = new Set<string>();
  const queue: QueueItem[] = [];

  /**
   * The origin links are followed within. It starts as the target and moves
   * to the entry page's final origin, so `http://example.com` redirecting to
   * `https://www.example.com` is crawled on the origin it actually landed on.
   */
  let scopeUrl = target.url;

  let attempted = 0;
  let limitReached = false;
  let cancelled = false;

  const entryKey = urlDedupeKey(target.url);
  if (entryKey) seen.add(entryKey);
  queue.push({ url: target.url, depth: 0 });

  const recordSkip = (url: string, reason: SkipReason) => {
    if (skipped.length < DISCOVERY_LIMITS.maxSkippedRecorded) {
      skipped.push({ url, reason });
    }
  };

  try {
    while (queue.length > 0) {
      if (signal.aborted) {
        cancelled = !timedOut;
        break;
      }
      if (attempted >= options.maxPages) {
        limitReached = true;
        for (const item of queue) recordSkip(item.url, 'page-limit');
        break;
      }

      const budget = Math.min(options.concurrency, options.maxPages - attempted);
      const batch = queue.splice(0, budget);
      attempted += batch.length;

      const settled = await Promise.all(
        batch.map((item) =>
          fetchAndAnalyze(item, input, signal, options.perPageTimeoutMs, now, scopeUrl)
        )
      );

      for (const outcome of settled) {
        if (outcome.failure) {
          failures.push(outcome.failure);
          continue;
        }
        if (!outcome.page) continue;

        const page = outcome.page;

        // The post-redirect URL is marked seen too, so a redirect chain is not
        // walked a second time from its destination.
        const finalKey = urlDedupeKey(page.url);
        if (finalKey) {
          if (analyzedKeys.has(finalKey)) {
            // Two different URLs redirected to the same page. Analyzing it
            // twice would double every finding for no new information.
            recordSkip(page.url, 'duplicate');
            continue;
          }
          analyzedKeys.add(finalKey);
          seen.add(finalKey);
        }

        if (page.depth === 0) scopeUrl = page.url;

        pages.push(page);
        input.onPage?.(page, pages.length);

        if (page.depth >= options.maxDepth) {
          if (page.links.some((link) => link.isNavigable && link.sameOrigin)) {
            limitReached = true;
          }
          continue;
        }

        enqueueLinks(page, scopeUrl, options, seen, queue, recordSkip);
      }
    }
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', onCallerAbort);
  }

  const report: DiscoveryReport = {
    entryUrl: target.url,
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
    candidates: seen.size,
    analyzed: pages.length,
    attempted,
    skipped,
    failures,
    limitReached,
    cancelled: cancelled || input.signal?.aborted === true,
    timedOut,
    scopeOrigin: safeOrigin(scopeUrl)
  };

  return { pages, report };
}

function safeOrigin(url: string): string {
  const parsed = parseUrl(url);
  return parsed ? parsed.origin : url;
}

interface FetchOutcome {
  page?: AnalyzedPage;
  failure?: PageFetchFailure;
}

/**
 * Fetches and analyzes one page, converting every possible failure into a
 * recorded `PageFetchFailure` instead of a thrown error.
 */
async function fetchAndAnalyze(
  item: QueueItem,
  input: DiscoveryInput,
  signal: AbortSignal,
  timeoutMs: number,
  now: () => Date,
  scopeUrl: string
): Promise<FetchOutcome> {
  const { fetcher, extractor } = input;

  if (signal.aborted) {
    return {
      failure: { url: item.url, depth: item.depth, kind: 'aborted', message: 'Cancelled before the request started.' }
    };
  }

  try {
    const result = await fetcher.fetchPage({ url: item.url, timeoutMs, signal });

    if (!result.ok || result.body === null) {
      return {
        failure: {
          url: item.url,
          depth: item.depth,
          kind: result.error?.kind ?? 'network',
          message: result.error?.message ?? 'The response body could not be read.'
        }
      };
    }

    if (!result.isHtml) {
      return {
        failure: {
          url: item.url,
          depth: item.depth,
          kind: 'unsupported',
          message: `The response is ${result.contentType ?? 'an unknown type'} rather than HTML, so it was not analyzed.`
        }
      };
    }

    const pageUrl = result.finalUrl ?? result.url;

    // A linked page that redirects off the crawl scope is not analyzed: the
    // crawl is same-origin, and a redirect must not widen it. The entry page
    // is exempt because the user chose it and it defines the scope.
    if (item.depth > 0 && !isSameOrigin(pageUrl, scopeUrl)) {
      return {
        failure: {
          url: item.url,
          depth: item.depth,
          kind: 'unsupported',
          message: 'The page redirected to a different origin, so it was not analyzed.'
        }
      };
    }

    const snapshot = extractor.extract(result.body, pageUrl);

    const page = buildAnalyzedPage({
      snapshot,
      url: pageUrl,
      depth: item.depth,
      statusCode: result.status,
      contentType: result.contentType,
      headers: result.headers,
      fetchedAt: now(),
      htmlBytes: result.bytes,
      bodyTruncated: result.truncated
    });

    return { page };
  } catch (error) {
    // Extraction or model building threw on hostile or malformed markup. The
    // page is dropped and the run continues.
    return {
      failure: {
        url: item.url,
        depth: item.depth,
        kind: 'unsupported',
        message: safeErrorMessage(error)
      }
    };
  }
}

function enqueueLinks(
  page: AnalyzedPage,
  scopeUrl: string,
  options: DiscoveryOptions,
  seen: Set<string>,
  queue: QueueItem[],
  recordSkip: (url: string, reason: SkipReason) => void
): void {
  const nextDepth = page.depth + 1;

  for (const link of page.links) {
    if (!link.isNavigable) {
      recordSkip(link.url, 'non-navigable-scheme');
      continue;
    }

    // Same-origin is re-checked against the crawl scope rather than trusting
    // the page's own origin, so a redirect off-origin cannot widen it.
    if (!isSameOrigin(link.url, scopeUrl)) {
      recordSkip(link.url, 'cross-origin');
      continue;
    }

    const parsed = parseUrl(link.url);
    if (!parsed) continue;

    if (looksLikeBinaryResource(parsed)) {
      recordSkip(link.url, 'binary-or-download');
      continue;
    }

    if (looksStateChanging(parsed)) {
      recordSkip(link.url, 'state-changing');
      continue;
    }

    const key = urlDedupeKey(link.url);
    if (!key) continue;
    if (seen.has(key)) {
      // Already queued or visited. Not recorded: on a normal site the same
      // navigation links appear on every page and would swamp the report.
      continue;
    }

    seen.add(key);

    if (nextDepth > options.maxDepth) {
      recordSkip(link.url, 'depth-limit');
      continue;
    }

    const normalized = normalizeUrl(link.url);
    if (normalized) queue.push({ url: normalized, depth: nextDepth });
  }
}

/** Keeps error text free of target content. */
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name) {
    return `Page analysis failed (${error.name}).`;
  }
  return 'Page analysis failed.';
}
