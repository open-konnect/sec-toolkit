/**
 * Domain model for the Website Security Posture Assessment engine.
 *
 * The engine is deliberately framework-free: nothing in this file or in
 * `logic/` imports React, touches `document`, or reaches for a global `fetch`.
 * Everything the engine needs from the outside world arrives through the
 * `PageFetcher` and `PageExtractor` interfaces. That is what allows a future
 * `ServerPassiveRunner` or `VerifiedActiveRunner` to reuse the same checks,
 * aggregation, scoring, and report UI without a rewrite.
 *
 * Every string that originates from the assessed target is untrusted data. It
 * is normalized, length-capped, and redacted before it reaches a finding, and
 * it is never evaluated, executed, or transmitted anywhere.
 */

/* -------------------------------------------------------------------------- */
/* Target                                                                     */
/* -------------------------------------------------------------------------- */

/** The normalized subject of an assessment. */
export interface AssessmentTarget {
  /** Normalized absolute URL (no fragment, no default port). */
  readonly url: string;
  readonly origin: string;
  readonly hostname: string;
  /** Includes the trailing colon, matching `URL.protocol`. */
  readonly protocol: string;
  /** Empty string when the URL uses the protocol default port. */
  readonly port: string;
  readonly pathname: string;
  /** True for `https:` and for http on a loopback host (a secure context). */
  readonly isSecureContext: boolean;
  /** True for `localhost`, `127.0.0.0/8`, and `[::1]`. */
  readonly isLoopback: boolean;
}

/**
 * How an assessment observed its target.
 *
 * Only `browser-passive` is implemented. The other members exist so that
 * checks, scoring, and the report UI can already be written against the full
 * enum instead of being retrofitted later.
 */
export type AssessmentMode = 'browser-passive' | 'server-passive' | 'verified-active';

/* -------------------------------------------------------------------------- */
/* Findings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The outcome of a single check.
 *
 * `unable-to-verify` and `not-applicable` are explicitly NOT failures. Browser
 * security boundaries routinely prevent reading response headers or
 * cross-origin bodies, and that limitation must never be reported as a
 * weakness of the target.
 */
export type FindingStatus =
  | 'pass'
  | 'warning'
  | 'fail'
  | 'info'
  | 'unable-to-verify'
  | 'not-applicable';

export type Severity = 'informational' | 'low' | 'medium' | 'high' | 'critical';

/** Where the underlying observation came from. */
export type FindingSource = 'browser' | 'html' | 'dom' | 'resource' | 'derived';

export type Confidence = 'low' | 'medium' | 'high';

/**
 * The epistemic class of a finding. This is the distinction that makes the
 * tool a posture assessment rather than a vulnerability scanner.
 *
 * - `verified-observation` — directly observed in data we actually read.
 * - `best-practice`        — a hardening recommendation, not a defect.
 * - `potential-concern`    — suggestive but not conclusive.
 * - `unable-to-verify`     — a browser or protocol boundary blocked the check.
 * - `not-applicable`       — the precondition for the check does not exist.
 */
export type ObservationKind =
  | 'verified-observation'
  | 'best-practice'
  | 'potential-concern'
  | 'unable-to-verify'
  | 'not-applicable';

export type FindingCategory =
  | 'transport'
  | 'content-security-policy'
  | 'resource-integrity'
  | 'response-headers'
  | 'forms-and-input'
  | 'information-disclosure'
  | 'third-party'
  | 'browser-storage'
  | 'script-security'
  | 'framing'
  | 'links-and-navigation'
  | 'service-workers'
  | 'browser-permissions'
  | 'authentication-surface'
  | 'disclosure-process'
  | 'site-metadata'
  | 'correlation';

/** A single redacted, length-capped piece of supporting detail. */
export interface FindingEvidence {
  label: string;
  value: string;
  pageUrl?: string;
}

export interface SecurityFinding {
  /** `checkId` plus an optional discriminator; stable across runs. */
  id: string;
  checkId: string;
  category: FindingCategory;
  title: string;
  status: FindingStatus;
  severity: Severity;
  observation: ObservationKind;
  confidence: Confidence;
  source: FindingSource;
  /** One sentence describing what was observed. */
  summary: string;
  /** Why the observation matters. */
  explanation: string;
  /** What the operator should do next. */
  recommendation: string;
  evidence: FindingEvidence[];
  affectedPages: string[];
  /**
   * Sanitized URLs (origin and path only) of the subresources involved.
   * Matched to the asset inventory by the report layer; absent when the
   * finding is not about specific resources.
   */
  affectedResources?: string[];
  /**
   * Ids of the checks whose observations were combined to produce this
   * finding. Only set on correlation findings.
   */
  correlatedChecks?: string[];
  /** Groups equivalent findings during aggregation. */
  aggregationKey: string;
  /** How many raw observations this finding represents (pre-aggregation: 1). */
  occurrences: number;
}

/** A set of equivalent findings collapsed into one reportable item. */
export interface AggregatedFinding extends SecurityFinding {
  /** Total pages the issue was observed on, even if the list was capped. */
  affectedPageCount: number;
  /** True when `affectedPages` was truncated for display. */
  affectedPagesTruncated: boolean;
  /** Sanitized resource URLs, capped for display. */
  affectedResources: string[];
  /** Total distinct resources involved, even if the list was capped. */
  affectedResourceCount: number;
  affectedResourcesTruncated: boolean;
  /** True when `evidence` holds a capped sample rather than every item. */
  evidenceTruncated: boolean;
  /** Pages analyzed in the run, so "3 of 12" can be stated without guessing. */
  analyzedPageCount: number;
  /** Why the confidence level is what it is, in one plain sentence. */
  confidenceRationale: string;
}

/* -------------------------------------------------------------------------- */
/* Pages and resources                                                       */
/* -------------------------------------------------------------------------- */

export type ResourceType =
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'iframe'
  | 'media'
  | 'embed'
  | 'object'
  | 'manifest'
  | 'preload'
  | 'link'
  | 'other';

/**
 * A subresource referenced by a page.
 *
 * Resources are described from markup only. The engine never downloads a
 * resource in order to inspect it.
 */
export interface NormalizedResource {
  /** Absolute normalized URL, or null when the reference could not be parsed. */
  url: string | null;
  /** The raw attribute value, redacted and capped. */
  rawUrl: string;
  type: ResourceType;
  /** Lowercase tag name the reference was found on. */
  element: string;
  /** Attribute the reference was read from (`src`, `href`, `data`, `srcset`). */
  attribute: string;
  origin: string | null;
  /** Includes the trailing colon; null when unresolvable. */
  protocol: string | null;
  host: string | null;
  sameOrigin: boolean;
  crossOrigin: boolean;
  resolvable: boolean;
  isDataUri: boolean;
  integrity: string | null;
  crossOriginAttr: string | null;
  referrerPolicy: string | null;
  rel: string | null;
  /** The `as` attribute on `<link>`, used to classify preloads. */
  asAttr: string | null;
  sandbox: string | null;
  /** Whitelisted, value-stripped attributes retained for reporting. */
  attributes: Readonly<Record<string, string>>;
}

export interface PageLink {
  /** Absolute normalized URL. */
  url: string;
  rawHref: string;
  sameOrigin: boolean;
  rel: string | null;
  /** The `target` attribute, lowercased; null when absent. */
  target: string | null;
  /** Includes the trailing colon; null when the href could not be parsed. */
  protocol: string | null;
  /** False for mailto/tel/javascript/data and other non-navigable schemes. */
  isNavigable: boolean;
}

/**
 * What a form appears to be for, inferred from structure alone.
 *
 * Inference uses field types, markup identifiers, and the action path. It
 * never reads a field value, and it never submits anything to find out.
 */
export type PageFormKind =
  | 'login'
  | 'registration'
  | 'password-reset'
  | 'payment'
  | 'newsletter'
  | 'search'
  | 'other';

/**
 * A form described structurally.
 *
 * Field *values* are never captured, and no form is ever submitted.
 */
export interface PageForm {
  /** Resolved absolute submission URL, or null when unresolvable. */
  action: string | null;
  rawAction: string | null;
  /** True when the form had no action and therefore posts to the page URL. */
  actionIsImplicit: boolean;
  /** Lowercase; defaults to `get`. */
  method: string;
  actionProtocol: string | null;
  actionIsCrossOrigin: boolean;
  hasPasswordField: boolean;
  hasFileField: boolean;
  /** True when a field asks for payment-card-like data, by field name only. */
  hasPaymentField: boolean;
  /** Structural classification of what the form appears to be for. */
  kind: PageFormKind;
  /** Distinct lowercase input `type` values. Types only, never values. */
  inputTypes: string[];
  fieldCount: number;
  /** The form-level `autocomplete` attribute. */
  autocomplete: string | null;
  /** Distinct `autocomplete` tokens declared on fields; tokens, never values. */
  fieldAutocomplete: string[];
  target: string | null;
}

export interface MetaTag {
  name: string | null;
  property: string | null;
  httpEquiv: string | null;
  content: string;
}

export type TechnologyCategory =
  | 'framework'
  | 'cms'
  | 'ecommerce'
  | 'library'
  | 'cdn'
  | 'hosting'
  | 'web-server'
  | 'analytics'
  | 'tag-manager'
  | 'monitoring';

/** Where a technology signal was observed. */
export type TechnologySignalSource =
  | 'meta'
  | 'response-header'
  | 'resource-url'
  | 'markup'
  | 'inline-script';

/** One piece of evidence for a detected technology. */
export interface TechnologySignal {
  source: TechnologySignalSource;
  /** A short, fixed-vocabulary description. Never matched page text. */
  detail: string;
}

/**
 * A technology the page appears to use.
 *
 * This is an inference from observable markers, not a fingerprint match
 * against a database, and it is never reported with a version unless the
 * version string itself appeared in the evidence.
 */
export interface DetectedTechnology {
  id: string;
  name: string;
  category: TechnologyCategory;
  /** The strongest signal, for display where one line is enough. */
  evidence: string;
  /** Every signal that supported the detection, for the explanation view. */
  signals: TechnologySignal[];
  confidence: Confidence;
  /** Only present when the exact version was observable in the evidence. */
  version?: string;
}

/** A neutral, non-judgemental note about something seen on a page. */
export interface PageObservation {
  id: string;
  label: string;
  detail: string;
}

/** Where an indicator was observed. */
export type IndicatorSource = 'inline-script' | 'markup' | 'inline-handler' | 'resource-url' | 'meta';

/**
 * A named marker derived from page content.
 *
 * An indicator records only that a recognized pattern appeared and how often.
 * The matched text is never retained, so an indicator can never carry a
 * credential, a token, or a fragment of the target's source. An indicator is
 * evidence that something is worth a human look — never proof of a defect.
 */
export interface PageIndicator {
  /** Stable id from a fixed catalogue; part of the finding contract. */
  id: string;
  label: string;
  /** How many times the marker appeared across the page. */
  occurrences: number;
  where: IndicatorSource;
  /** Optional sanitized context, such as a tag name or a path shape. */
  detail?: string;
}

/**
 * An inline event handler attribute, recorded by name only.
 *
 * The attribute's value is target JavaScript, so the scanner never captures
 * it: only the element it sat on and the handler name are kept.
 */
export interface InlineEventHandler {
  /** Lowercase tag name, e.g. `button`. */
  element: string;
  /** Lowercase attribute name, e.g. `onclick`. */
  attribute: string;
  count: number;
}

export type HeaderVisibility = 'readable' | 'cors-restricted' | 'not-fetched' | 'unsupported';

/**
 * Response headers as far as they could legitimately be observed.
 *
 * A cross-origin `fetch` only exposes CORS-safelisted headers, so
 * `visibility` must be consulted before concluding that a header is absent.
 */
export interface ObservedHeaders {
  visibility: HeaderVisibility;
  /** Lowercase header name to value, for headers that were readable. */
  values: Readonly<Record<string, string>>;
  reason?: string;
}

export interface AnalyzedPage {
  /** Normalized absolute URL. */
  url: string;
  origin: string;
  protocol: string;
  /** 0 for the entry page. */
  depth: number;
  fetchedAt: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  /** Resolved `<link rel=canonical>` target, query-stripped. */
  canonicalUrl: string | null;
  /** The meta description, whitespace-collapsed and capped. */
  metaDescription: string | null;
  /** Subresource references on the page, by type. */
  resourceCounts: Record<ResourceType, number>;
  htmlBytes: number;
  /** True when the body or element count hit a safety cap. */
  truncated: boolean;
  headers: ObservedHeaders;
  links: PageLink[];
  resources: NormalizedResource[];
  forms: PageForm[];
  metaTags: MetaTag[];
  /** Distinct cross-origin hosts referenced by the page. */
  externalDomains: string[];
  /** Distinct protocols referenced by the page. */
  protocols: string[];
  inlineScriptCount: number;
  inlineStyleCount: number;
  /** Markers such as `serviceWorker.register`; never the script text itself. */
  serviceWorkerIndicators: string[];
  /** Markers such as `localStorage`; never any stored value. */
  storageIndicators: string[];
  /** Inline `on*` handler attributes, by element and handler name only. */
  inlineEventHandlers: InlineEventHandler[];
  /**
   * Dangerous-DOM-API and dynamic-code markers seen in inline script.
   *
   * These are indicators that a manual review is warranted. They are never
   * proof of an injection vulnerability.
   */
  scriptIndicators: PageIndicator[];
  /** Permission-gated browser APIs referenced in markup or inline script. */
  sensitiveApiIndicators: PageIndicator[];
  /** Source-map and build-metadata references; never any source content. */
  sourceMapIndicators: PageIndicator[];
  /** Development, debug, and internal-environment markers. */
  debugIndicators: PageIndicator[];
  detectedTechnologies: DetectedTechnology[];
  observations: PageObservation[];
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                 */
/* -------------------------------------------------------------------------- */

/** One markup element reduced to the data the engine needs. */
export interface RawElement {
  /** Lowercase tag name. */
  tag: string;
  /** Lowercase attribute names to entity-decoded, capped values. */
  attributes: Readonly<Record<string, string>>;
  /**
   * Raw text, captured only for `<title>` and inline `<script>`.
   *
   * Inline script text is used to derive indicator flags and is then dropped;
   * it is never persisted onto an `AnalyzedPage`.
   */
  text?: string;
  /** Index into `RawPageSnapshot.formCount` for fields inside a form. */
  formIndex?: number;
}

export interface RawPageSnapshot {
  url: string;
  elements: RawElement[];
  title: string | null;
  htmlBytes: number;
  /** True when a safety cap stopped extraction early. */
  truncated: boolean;
  formCount: number;
  /**
   * Fixed-vocabulary framework markers (`attr:ng-version`, `id:__next`, ...).
   * Optional so custom extractors need not provide them. Never page text.
   */
  markers?: string[];
}

/**
 * Turns markup into a flat, inert snapshot.
 *
 * Implementations must not execute, evaluate, or network-resolve anything in
 * the supplied markup.
 */
export interface PageExtractor {
  readonly id: string;
  extract(html: string, pageUrl: string): RawPageSnapshot;
}

/* -------------------------------------------------------------------------- */
/* Fetching                                                                   */
/* -------------------------------------------------------------------------- */

export type FetchErrorKind =
  | 'cors'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'http-error'
  | 'too-large'
  | 'invalid-url'
  | 'unsupported';

export interface PageFetchError {
  kind: FetchErrorKind;
  /** Sanitized; never includes response content. */
  message: string;
}

export interface PageFetchRequest {
  url: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Set for probes where only existence matters, so the body is discarded. */
  discardBody?: boolean;
  /**
   * Lowers the transport's body cap for this request.
   *
   * Used for well-known text files, which are read only to be parsed into a
   * bounded summary. It can never raise the transport's own ceiling.
   */
  maxBytes?: number;
}

export interface PageFetchResult {
  ok: boolean;
  /** The requested URL. */
  url: string;
  /** The URL after redirects, when observable. */
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  /** Body text, or null when unreadable or intentionally discarded. */
  body: string | null;
  isHtml: boolean;
  bytes: number;
  truncated: boolean;
  redirected: boolean;
  headers: ObservedHeaders;
  error?: PageFetchError;
}

/**
 * What a transport can legitimately observe.
 *
 * These are declared by the transport and then narrowed at runtime by the
 * runner, because a capability can be present in principle and still be
 * unavailable for a particular target (a CORS-blocked body, for example).
 */
export interface FetcherCapabilities {
  readonly canReadHtmlBody: boolean;
  readonly canReadResponseHeaders: boolean;
  readonly canFollowRedirects: boolean;
  readonly canDiscoverLinkedPages: boolean;
  readonly canProbeWellKnownPaths: boolean;
}

/** A read-only transport for passive observation. */
export interface PageFetcher {
  readonly id: string;
  readonly capabilities: FetcherCapabilities;
  fetchPage(request: PageFetchRequest): Promise<PageFetchResult>;
}

/* -------------------------------------------------------------------------- */
/* Discovery                                                                  */
/* -------------------------------------------------------------------------- */

export interface DiscoveryOptions {
  /** Hard cap on pages fetched, including the entry page. */
  maxPages: number;
  /** 0 analyzes only the entry page. */
  maxDepth: number;
  perPageTimeoutMs: number;
  /** Simultaneous in-flight page fetches. */
  concurrency: number;
  /** Wall-clock budget for the whole discovery phase. */
  totalTimeoutMs: number;
}

export type SkipReason =
  | 'cross-origin'
  | 'non-navigable-scheme'
  | 'binary-or-download'
  | 'duplicate'
  | 'page-limit'
  | 'depth-limit'
  | 'state-changing';

export interface SkippedUrl {
  url: string;
  reason: SkipReason;
}

export interface PageFetchFailure {
  url: string;
  depth: number;
  kind: FetchErrorKind;
  message: string;
}

export interface DiscoveryReport {
  entryUrl: string;
  maxPages: number;
  maxDepth: number;
  /** Distinct same-origin candidates found. */
  candidates: number;
  /** Pages successfully fetched and analyzed. */
  analyzed: number;
  /** Pages attempted, including failures. */
  attempted: number;
  skipped: SkippedUrl[];
  failures: PageFetchFailure[];
  /** True when `maxPages` or `maxDepth` stopped further discovery. */
  limitReached: boolean;
  cancelled: boolean;
  /** True when the total discovery budget ran out. */
  timedOut: boolean;
  /** The origin links were followed within (the entry page's final origin). */
  scopeOrigin: string;
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * An observation capability a check depends on.
 *
 * When a required capability is unavailable the engine records the check as
 * `unable-to-verify` without running it, so a check body never has to repeat
 * that boilerplate and can never mistake a boundary for a weakness.
 */
export type CheckCapability =
  | 'html-body'
  | 'response-headers'
  | 'linked-pages'
  | 'well-known-probe';

/**
 * Field-level summary of a `security.txt` (RFC 9116).
 *
 * Only structural facts are kept. Contact addresses, policy URLs, and key
 * fingerprints are counted and validated in place; their values are not
 * retained, because a security.txt routinely names individuals.
 */
export interface SecurityTxtSummary {
  kind: 'security-txt';
  /** Lowercase field names seen, with how many times each appeared. */
  fields: Array<{ name: string; count: number }>;
  /** True when the file is wrapped in a PGP signature block. */
  signed: boolean;
  /** Lines that were neither blank, a comment, nor a `Field: value` pair. */
  malformedLines: number;
  /** True when at least one Contact value is a usable URI or mailto. */
  contactUsable: boolean;
  /** True when `Expires` parsed as a timestamp. */
  expiresValid: boolean;
  /** True when a valid `Expires` is in the past relative to the run clock. */
  expired: boolean;
  /** True when a Canonical value matched the probed origin; null when absent. */
  canonicalMatchesOrigin: boolean | null;
}

/**
 * Structural summary of a `robots.txt`.
 *
 * robots.txt is a crawler directive file, not an access control. Paths named
 * in it are recorded as observations only and are never reported as a
 * weakness.
 */
export interface RobotsTxtSummary {
  kind: 'robots-txt';
  userAgentGroups: number;
  allowRules: number;
  disallowRules: number;
  /** Absolute sitemap URLs declared, capped. */
  sitemaps: string[];
  /** Disallowed path patterns, capped and sanitized. */
  disallowedPaths: string[];
  /** Disallowed paths whose names read like administrative areas. */
  administrativeLookingPaths: string[];
  malformedLines: number;
  /** True when every crawler is disallowed from the whole site. */
  blocksEverything: boolean;
}

/** Structural summary of a sitemap, read without following any URL in it. */
export interface SitemapSummary {
  kind: 'sitemap';
  format: 'urlset' | 'sitemapindex' | 'text' | 'unknown';
  urlCount: number;
  crossOriginUrlCount: number;
  /** False when the document did not look like a sitemap at all. */
  wellFormed: boolean;
  /** True when the body hit the probe byte cap, so counts are a lower bound. */
  truncated: boolean;
  /** Listed paths whose names read like administrative areas. */
  administrativeLookingPaths: string[];
}

/**
 * A parsed, bounded summary of a well-known text file.
 *
 * The raw body is parsed and discarded inside the runner; only these
 * structural facts reach a check or a report.
 */
export type WellKnownSummary = SecurityTxtSummary | RobotsTxtSummary | SitemapSummary;

/** Result of probing a fixed, well-known path. */
export interface WellKnownProbe {
  path: string;
  url: string;
  /** False when a browser boundary prevented any conclusion. */
  observable: boolean;
  /** null when `observable` is false. */
  found: boolean | null;
  status: number | null;
  contentType: string | null;
  /** Byte length only; probe bodies are never retained. */
  bytes: number;
  /** Bounded structural summary, when the file was readable and understood. */
  summary?: WellKnownSummary;
  reason?: string;
}

/** Everything a check is allowed to look at. */
export interface CheckContext {
  target: AssessmentTarget;
  mode: AssessmentMode;
  /** Pages that were successfully analyzed; may be empty. */
  pages: readonly AnalyzedPage[];
  /** The entry page, or null when it could not be read. */
  primaryPage: AnalyzedPage | null;
  /** Capabilities already narrowed to this run. */
  capabilities: FetcherCapabilities;
  wellKnown: readonly WellKnownProbe[];
  /** Injected for deterministic tests. */
  now: () => Date;
}

export interface CheckOutcome {
  findings: SecurityFinding[];
}

/** The identity fields a finding builder needs from its check. */
export interface SecurityCheckMeta {
  id: string;
  category: FindingCategory;
  name: string;
  severity: Severity;
}

export interface SecurityCheck extends SecurityCheckMeta {
  description: string;
  /**
   * Maximum score weight this check can contribute.
   *
   * Only counted when the check actually completes, which is what keeps the
   * score relative to the work that was really performed. Use 0 for purely
   * informational checks.
   */
  scoreWeight: number;
  /** Modes this check is valid for. */
  modes: readonly AssessmentMode[];
  requires?: readonly CheckCapability[];
  execute(context: CheckContext): CheckOutcome | Promise<CheckOutcome>;
}

export type CheckExecutionStatus = 'completed' | 'unable-to-verify' | 'not-applicable' | 'error';

export interface CheckExecutionRecord {
  checkId: string;
  checkName: string;
  category: FindingCategory;
  status: CheckExecutionStatus;
  findings: SecurityFinding[];
  /** Sanitized failure message when `status` is `error`. */
  error?: string;
  /** Capabilities that were missing when `status` is `unable-to-verify`. */
  missingCapabilities?: CheckCapability[];
  durationMs: number;
}

/* -------------------------------------------------------------------------- */
/* Scoring and coverage                                                      */
/* -------------------------------------------------------------------------- */

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreContribution {
  checkId: string;
  findingId: string;
  status: FindingStatus;
  severity: Severity;
  confidence: Confidence;
  observation: ObservationKind;
  affectedPageCount: number;
  /** Penalty actually applied, rounded to two decimals. */
  penalty: number;
}

export interface AssessmentScore {
  /**
   * 0-100, or null when no scoreable check completed.
   *
   * A null score is reported as "not scored" rather than as a perfect or a
   * failing result.
   */
  value: number | null;
  grade: ScoreGrade | null;
  /** Total weight of the checks that completed. */
  availableWeight: number;
  /** Weighted penalty from warning and fail findings. */
  appliedPenalty: number;
  scoredChecks: string[];
  contributions: ScoreContribution[];
  /** The same findings viewed as two maturity dimensions. */
  dimensions: MaturityDimensions;
}

export type MaturityDimensionId = 'technical-security' | 'security-hygiene';

/**
 * A score over the subset of checks belonging to one maturity dimension.
 *
 * Technical Security reflects observed weaknesses; Security Hygiene reflects
 * hardening, disclosure, and housekeeping practice. The headline score is
 * unchanged, and these are exposed for a future UI.
 */
export interface MaturityDimension {
  id: MaturityDimensionId;
  label: string;
  value: number | null;
  grade: ScoreGrade | null;
  availableWeight: number;
  appliedPenalty: number;
  scoredChecks: string[];
  /** Checks assigned to this dimension, whether or not they completed. */
  checkCount: number;
}

export interface MaturityDimensions {
  technical: MaturityDimension;
  hygiene: MaturityDimension;
}

export interface AssessmentCoverage {
  /** Share of applicable checks that produced a verdict, 0-100. */
  percent: number;
  totalChecks: number;
  performed: number;
  unableToVerify: number;
  notApplicable: number;
  errored: number;
  pagesAnalyzed: number;
  pagesAttempted: number;
  /** Distinct same-origin pages found, whether or not they were fetched. */
  pagesDiscovered: number;
  /** Pages that were attempted but could not be retrieved or read. */
  pagesInaccessible: number;
  /** Discovered URLs deliberately not fetched (limits, binaries, duplicates). */
  pagesSkipped: number;
  /** Plain-language reasons coverage is below 100%. */
  limitations: string[];
  /** What "no issue observed" and "could not verify" each mean in this run. */
  explanation: string;
}

/* -------------------------------------------------------------------------- */
/* Assessment result                                                          */
/* -------------------------------------------------------------------------- */

export type AssessmentStage = 'target' | 'fetch' | 'extract' | 'check' | 'aggregate' | 'score';

export interface AssessmentError {
  stage: AssessmentStage;
  kind: string;
  /** Sanitized; never includes target page content. */
  message: string;
  checkId?: string;
  url?: string;
}

export type ThirdPartyKind = 'cdn' | 'analytics' | 'payment' | 'tag-manager' | 'social' | 'other';

/**
 * How a referenced host relates to the page that references it.
 *
 * - `first-party`: the same origin as the page.
 * - `same-site`:   a different origin under the same registrable domain, such
 *                  as a `cdn.` subdomain. Cross-origin, but the same operator
 *                  in almost every case.
 * - `third-party`: a different registrable domain.
 */
export type PartyRelationship = 'first-party' | 'same-site' | 'third-party';

export interface ThirdPartyDomain {
  host: string;
  kind: ThirdPartyKind;
  relationship: PartyRelationship;
  resourceCount: number;
  pageCount: number;
  byType: Partial<Record<ResourceType, number>>;
}

export interface ThirdPartySurface {
  totalResources: number;
  firstPartyResources: number;
  sameSiteResources: number;
  thirdPartyResources: number;
  /** Cross-origin resources: same-site plus third-party. */
  externalResources: number;
  externalActiveResources: number;
  externalScripts: number;
  externalStylesheets: number;
  externalFrames: number;
  externalImages: number;
  externalFonts: number;
  externalMedia: number;
  /** Distinct cross-origin hostnames, sorted. */
  domains: string[];
  thirdPartyDomains: string[];
  sameSiteDomains: string[];
  /** Distinct cross-origin hostnames grouped by what they appear to be. */
  byKind: Record<ThirdPartyKind, string[]>;
  /** Forms that appear to collect payment-card data, plus payment hosts. */
  paymentFormCount: number;
  /** Per-host detail, most-referenced first, capped. */
  details: ThirdPartyDomain[];
}

/** Normalized, value-free metadata for one analyzed page. */
export interface PageInventoryEntry {
  url: string;
  depth: number;
  title: string | null;
  canonicalUrl: string | null;
  metaDescription: string | null;
  statusCode: number | null;
  counts: {
    links: number;
    sameOriginLinks: number;
    forms: number;
    passwordForms: number;
    scripts: number;
    inlineScripts: number;
    styles: number;
    images: number;
    fonts: number;
    iframes: number;
    media: number;
    objects: number;
    embeds: number;
  };
  externalDomains: string[];
  protocols: string[];
  technologies: string[];
  /** Ids of the page's neutral observations (`meta-csp`, `base-href`, ...). */
  observations: string[];
}

export interface AssessmentInventory {
  pageCount: number;
  resourceCount: number;
  resourcesByType: Record<ResourceType, number>;
  externalDomains: string[];
  protocols: string[];
  formCount: number;
  passwordFormCount: number;
  inlineScriptCount: number;
  detectedTechnologies: DetectedTechnology[];
  thirdParty: ThirdPartySurface;
}

export interface SecurityAssessment {
  target: AssessmentTarget;
  mode: AssessmentMode;
  /** Identifier of the runner that produced this result. */
  runnerId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  score: AssessmentScore;
  coverage: AssessmentCoverage;
  /** Report-ready, aggregated findings sorted most actionable first. */
  findings: AggregatedFinding[];
  /** Finding count before aggregation, for transparency. */
  rawFindingCount: number;
  pages: AnalyzedPage[];
  /** One value-free metadata entry per analyzed page. */
  pageInventory: PageInventoryEntry[];
  inventory: AssessmentInventory;
  checksPerformed: string[];
  checksUnableToVerify: string[];
  checksNotApplicable: string[];
  checksErrored: string[];
  checkRecords: CheckExecutionRecord[];
  discovery: DiscoveryReport;
  wellKnown: WellKnownProbe[];
  capabilities: FetcherCapabilities;
  errors: AssessmentError[];
}

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

export type AssessmentPhase =
  | 'starting'
  | 'discovering'
  | 'probing'
  | 'checking'
  | 'aggregating'
  | 'complete';

export interface AssessmentProgress {
  phase: AssessmentPhase;
  message: string;
  pagesAnalyzed: number;
  checksCompleted: number;
  totalChecks: number;
}

export interface AssessmentRunInput {
  target: AssessmentTarget;
  discovery?: Partial<DiscoveryOptions>;
  /** Overrides the registry selection; used by tests. */
  checks?: readonly SecurityCheck[];
  signal?: AbortSignal;
  onProgress?: (progress: AssessmentProgress) => void;
}

/**
 * A strategy for observing a target.
 *
 * `BrowserPassiveRunner` is the only implementation today. A future
 * `ServerPassiveRunner` or `VerifiedActiveRunner` satisfies this same
 * interface and reuses the check registry, aggregation, scoring, and UI.
 */
export interface AssessmentRunner {
  readonly id: string;
  readonly mode: AssessmentMode;
  readonly capabilities: FetcherCapabilities;
  run(input: AssessmentRunInput): Promise<SecurityAssessment>;
}
