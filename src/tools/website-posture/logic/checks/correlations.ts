/**
 * Cross-check correlations.
 *
 * A correlation reads two or more facts the engine already holds and reports
 * where they combine into something a single check cannot say. Rules:
 *
 * - No new evidence is gathered. Every input is a page-model field.
 * - A correlation carries `scoreWeight` 0 (except the storage one) so the
 *   weaknesses it combines, which the underlying checks already score, are not
 *   penalised twice.
 * - Each reports `pass` or `not-applicable` when the combination is absent, and
 *   `unable-to-verify` when a precondition could not be observed — never a
 *   guess.
 * - Wording distinguishes a verified combination from a hardening suggestion.
 *   Nothing here is a vulnerability claim.
 */

import {
  AnalyzedPage,
  CheckContext,
  CheckOutcome,
  NormalizedResource,
  PageForm,
  PageFormKind,
  PageLink,
  SecurityCheck,
  SecurityFinding
} from '../../types';
import { classifyDomain, relationshipOf, sriIsMeaningful } from '../analysis/thirdParty';
import { createFinding, notApplicable, passed, sanitizeUrlForEvidence, unableToVerify } from '../findings';
import { parseUrl } from '../url';
import {
  effectiveDirective,
  hasKeyword,
  hasNonceOrHash,
  hasStrictDynamic,
  parseCspDirectives,
  readPageCsp
} from './cspPolicy';

const AUTH_FORM_KINDS: ReadonlySet<PageFormKind> = new Set<PageFormKind>([
  'login',
  'registration',
  'password-reset'
]);

function isAuthForm(form: PageForm): boolean {
  return form.hasPasswordField || AUTH_FORM_KINDS.has(form.kind);
}

/** A page where a credential or card number is plausibly entered. */
function hasSensitiveForm(page: AnalyzedPage): boolean {
  return page.forms.some((form) => isAuthForm(form) || form.hasPaymentField);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Folds per-page results into findings, or one explanatory finding when none. */
function finish(
  check: SecurityCheck,
  context: CheckContext,
  findings: SecurityFinding[],
  empty: { notApplicableReason: string }
): CheckOutcome {
  if (findings.length > 0) return { findings };
  return {
    findings: [
      notApplicable(check, {
        reason: empty.notApplicableReason,
        affectedPages: context.pages.map((page) => page.url)
      })
    ]
  };
}

/* -------------------------------------------------------------------------- */
/* A. HTTPS page + password field + HTTP form action                           */
/* -------------------------------------------------------------------------- */

export const correlationPasswordFormHttpActionCheck: SecurityCheck = {
  id: 'correlation-password-form-http-action',
  category: 'correlation',
  name: 'Password form on HTTPS page posting to HTTP',
  description:
    'Correlates a password field on an HTTPS page with a form action that targets plaintext HTTP.',
  severity: 'high',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      if (page.protocol !== 'https:') continue;
      const passwordForms = page.forms.filter((form) => form.hasPasswordField);
      if (passwordForms.length === 0) continue;

      const downgraded = passwordForms.filter((form) => form.actionProtocol === 'http:');

      if (downgraded.length === 0) {
        findings.push(
          passed(this, {
            summary: 'No password form on this HTTPS page submits to plaintext HTTP.',
            explanation:
              'Every form with a password field declares an https:// (or same-page) action. Only the declared action was read; a script could still change where a form submits.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      findings.push(
        createFinding(this, {
          status: 'fail',
          severity: 'high',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'derived',
          title: 'Password form on an HTTPS page submits over HTTP',
          summary: `${downgraded.length} password ${plural(downgraded.length, 'form', 'forms')} on an HTTPS page declare${downgraded.length === 1 ? 's' : ''} an http:// action.`,
          explanation:
            'The page is delivered securely, but the credentials typed into it are sent to a plaintext URL, where anyone on the network path can read them. The secure page gives users a false assurance. Browsers warn about this pattern, and some block it.',
          recommendation:
            'Change the form action to an https:// URL (or a root-relative path), confirm the receiving endpoint serves TLS, and consider adding form-action to your CSP.',
          affectedPages: [page.url],
          aggregationKey: 'https-page-http-action',
          occurrences: downgraded.length,
          correlatedChecks: ['password-form-http', 'sensitive-form-transport', 'mixed-content'],
          evidence: downgraded.slice(0, 3).map((form) => ({
            label: 'Form action',
            value: sanitizeUrlForEvidence(form.action ?? form.rawAction),
            pageUrl: page.url
          }))
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No HTTPS page with a password field was analyzed, so there is no secure page whose form could downgrade to HTTP.'
    });
  }
};

/* -------------------------------------------------------------------------- */
/* B. HTTPS page + HTTP script                                                */
/* -------------------------------------------------------------------------- */

export const correlationHttpScriptCheck: SecurityCheck = {
  id: 'correlation-http-script',
  category: 'correlation',
  name: 'Plaintext script on an HTTPS page',
  description: 'Correlates an HTTPS page with a script referenced over plaintext HTTP.',
  severity: 'high',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    const securePages = context.pages.filter((page) => page.protocol === 'https:');

    for (const page of securePages) {
      const scripts = page.resources.filter(
        (resource) => resource.type === 'script' && resource.protocol === 'http:'
      );

      if (scripts.length === 0) {
        findings.push(
          passed(this, {
            summary: 'No script on this HTTPS page is referenced over plaintext HTTP.',
            explanation:
              'Only scripts declared in the markup were examined; scripts a script loads later are not visible to a passive scan.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      findings.push(
        createFinding(this, {
          status: 'fail',
          severity: 'high',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'derived',
          title: 'HTTPS page loads a script over plaintext HTTP',
          summary: `${scripts.length} ${plural(scripts.length, 'script is', 'scripts are')} referenced over http:// on an HTTPS page.`,
          explanation:
            'A script fetched over HTTP can be replaced by anyone on the network path, and the replacement runs with full access to the secure page — its DOM, its storage, and anything the visitor types. Modern browsers block this as active mixed content, so the feature is likely broken as well.',
          recommendation:
            'Reference the script over https://, or self-host it. Add upgrade-insecure-requests to your CSP as a safety net while you fix the references.',
          affectedPages: [page.url],
          aggregationKey: 'http-script',
          affectedResources: scripts.map((resource) => resource.url ?? resource.rawUrl),
          occurrences: scripts.length,
          correlatedChecks: ['mixed-content'],
          evidence: scripts.slice(0, 3).map((resource) => ({
            label: `${resource.element}[${resource.attribute}]`,
            value: sanitizeUrlForEvidence(resource.url ?? resource.rawUrl),
            pageUrl: page.url
          }))
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No page served over HTTPS was analyzed, so there is no secure page for a plaintext script to undermine.'
    });
  }
};

/* -------------------------------------------------------------------------- */
/* C + D. CSP allowances versus what the page actually uses                   */
/* -------------------------------------------------------------------------- */

type ScriptStance = 'unverifiable' | 'no-enforced-policy' | 'unrestricted' | 'restricts' | 'permits';

interface ScriptCspState {
  stance: ScriptStance;
  /** True when a header policy could exist that the browser could not show. */
  partialView: boolean;
}

/**
 * Whether the enforced policies let script use `keyword`.
 *
 * Browsers apply every enforced policy, so a keyword is effective only when no
 * policy forbids it. Under CSP Level 2+, a nonce, hash, or `'strict-dynamic'`
 * makes a browser ignore `'unsafe-inline'`, which is honoured here.
 */
function scriptCspState(
  page: AnalyzedPage,
  keyword: "'unsafe-inline'" | "'unsafe-eval'"
): ScriptCspState {
  const info = readPageCsp(page);

  if (info.enforced.length === 0) {
    return { stance: info.headersReadable ? 'no-enforced-policy' : 'unverifiable', partialView: false };
  }

  const stances = info.enforced.map((source): ScriptStance => {
    const effective = effectiveDirective(parseCspDirectives(source.policy), 'script-src');
    if (!effective) return 'unrestricted';
    if (keyword === "'unsafe-inline'" && (hasNonceOrHash(effective.values) || hasStrictDynamic(effective.values))) {
      return 'restricts';
    }
    return hasKeyword(effective.values, keyword) ? 'permits' : 'restricts';
  });

  const partialView = !info.headersReadable;
  if (stances.includes('restricts')) return { stance: 'restricts', partialView };
  if (stances.includes('permits')) return { stance: 'permits', partialView };
  return { stance: 'unrestricted', partialView };
}

const PARTIAL_VIEW_NOTE =
  ' Only a policy delivered in the markup was visible; a stricter header policy that the browser could not show may also apply.';

export const correlationCspUnsafeInlineCheck: SecurityCheck = {
  id: 'correlation-csp-unsafe-inline-usage',
  category: 'correlation',
  name: "CSP 'unsafe-inline' versus inline script use",
  description:
    "Correlates a CSP that allows 'unsafe-inline' scripts with the inline scripts and handlers a page actually contains.",
  severity: 'medium',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    const unverifiable: string[] = [];

    for (const page of context.pages) {
      const state = scriptCspState(page, "'unsafe-inline'");
      if (state.stance === 'unverifiable') {
        unverifiable.push(page.url);
        continue;
      }
      if (state.stance === 'no-enforced-policy' || state.stance === 'unrestricted') continue;

      const handlerCount = page.inlineEventHandlers.reduce((sum, handler) => sum + handler.count, 0);
      const inlineUse = page.inlineScriptCount + handlerCount;

      if (state.stance === 'restricts') {
        findings.push(
          passed(this, {
            summary: "This page's CSP does not rely on 'unsafe-inline' for scripts.",
            explanation:
              'Inline script is either disallowed or limited to nonce, hash, or strict-dynamic sources, so an injected inline script would not run on this basis.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      if (inlineUse > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'potential-concern',
            confidence: state.partialView ? 'medium' : 'high',
            source: 'derived',
            title: "CSP allows 'unsafe-inline' and the page relies on inline script",
            summary: `The CSP permits inline script, and this page contains ${page.inlineScriptCount} inline ${plural(page.inlineScriptCount, 'script', 'scripts')} and ${handlerCount} inline event ${plural(handlerCount, 'handler', 'handlers')}.`,
            explanation: `Inline script is the thing 'unsafe-inline' exists to allow, and it is also the form most injected script takes — so while the policy permits it, it cannot stop an injection from running. The page's own inline code is the reason the allowance is currently needed.${state.partialView ? PARTIAL_VIEW_NOTE : ''}`,
            recommendation:
              "Move inline scripts into external files, or authorise them with per-response nonces or hashes, replace inline on* handlers with addEventListener, then remove 'unsafe-inline' from script-src.",
            affectedPages: [page.url],
            aggregationKey: 'unsafe-inline-in-use',
            occurrences: inlineUse,
            correlatedChecks: ['csp-unsafe-inline', 'inline-event-handlers'],
            evidence: [
              { label: 'Inline scripts', value: String(page.inlineScriptCount), pageUrl: page.url },
              { label: 'Inline event handlers', value: String(handlerCount), pageUrl: page.url }
            ]
          })
        );
      } else {
        findings.push(
          createFinding(this, {
            status: 'info',
            observation: 'best-practice',
            confidence: 'medium',
            source: 'derived',
            title: "CSP allows 'unsafe-inline' but no inline script was observed",
            summary: "The CSP permits inline script, yet this page's markup contains none.",
            explanation: `The allowance may be removable on this page: nothing in the markup needs it. It could still be needed by script a bundle injects at runtime, which a passive scan cannot see.${state.partialView ? PARTIAL_VIEW_NOTE : ''}`,
            recommendation:
              "Try removing 'unsafe-inline' from script-src in report-only mode first and check the violation reports before enforcing.",
            affectedPages: [page.url],
            aggregationKey: 'unsafe-inline-unused',
            correlatedChecks: ['csp-unsafe-inline']
          })
        );
      }
    }

    if (findings.length === 0 && unverifiable.length > 0) {
      return {
        findings: [
          unableToVerify(this, {
            reason:
              'No Content-Security-Policy was visible in the markup and the response headers were not readable from the browser, so whether a policy permits inline script could not be determined.',
            affectedPages: unverifiable
          })
        ]
      };
    }

    return finish(this, context, findings, {
      notApplicableReason:
        "No enforced policy governing script was found on the pages analyzed, so there is no 'unsafe-inline' allowance to correlate with inline script."
    });
  }
};

const DYNAMIC_CODE_INDICATORS = ['eval', 'new-function', 'timer-string-argument'];

export const correlationCspUnsafeEvalCheck: SecurityCheck = {
  id: 'correlation-csp-unsafe-eval-usage',
  category: 'correlation',
  name: "CSP 'unsafe-eval' versus dynamic-code indicators",
  description:
    "Correlates a CSP that allows 'unsafe-eval' with eval-like calls found in the page's inline script.",
  severity: 'medium',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    const unverifiable: string[] = [];

    for (const page of context.pages) {
      const state = scriptCspState(page, "'unsafe-eval'");
      if (state.stance === 'unverifiable') {
        unverifiable.push(page.url);
        continue;
      }
      if (state.stance === 'no-enforced-policy' || state.stance === 'unrestricted') continue;

      const indicators = page.scriptIndicators.filter((indicator) =>
        DYNAMIC_CODE_INDICATORS.includes(indicator.id)
      );

      if (state.stance === 'restricts') {
        findings.push(
          passed(this, {
            summary: "This page's CSP does not allow 'unsafe-eval'.",
            explanation:
              'String-to-code evaluation is blocked by policy on this page, so an injected eval-style call would not run.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      if (indicators.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'potential-concern',
            confidence: 'medium',
            source: 'derived',
            title: "CSP allows 'unsafe-eval' and inline script uses dynamic code",
            summary: `The CSP permits eval, and inline script on this page contains ${indicators.map((i) => i.label).join(', ')}.`,
            explanation: `'unsafe-eval' re-enables turning strings into code, which turns many data-injection bugs into script execution. The matching pattern in this page's own inline script suggests the allowance is in use. A pattern match is not proof of an unsafe call — the argument may never carry untrusted input.${state.partialView ? PARTIAL_VIEW_NOTE : ''}`,
            recommendation:
              "Replace eval, new Function, and string timers with direct code or JSON.parse, then drop 'unsafe-eval' from script-src. If a library requires it, isolate that library or look for a CSP-compatible build.",
            affectedPages: [page.url],
            aggregationKey: 'unsafe-eval-in-use',
            occurrences: indicators.reduce((sum, indicator) => sum + indicator.occurrences, 0),
            correlatedChecks: ['csp-unsafe-eval', 'dangerous-dom-api-usage'],
            evidence: indicators.map((indicator) => ({
              label: indicator.label,
              value: `${indicator.occurrences} in inline script`,
              pageUrl: page.url
            }))
          })
        );
      } else {
        findings.push(
          createFinding(this, {
            status: 'info',
            observation: 'best-practice',
            confidence: 'low',
            source: 'derived',
            title: "CSP allows 'unsafe-eval' with no dynamic-code pattern in inline script",
            summary: "The CSP permits eval; no eval-like call was found in this page's inline script.",
            explanation: `External script files are never downloaded by a passive scan, so a bundle or library on this page may still need the allowance. Absence here is not evidence it is unused.${state.partialView ? PARTIAL_VIEW_NOTE : ''}`,
            recommendation:
              "Test removing 'unsafe-eval' in report-only mode to find out whether anything on the page depends on it.",
            affectedPages: [page.url],
            aggregationKey: 'unsafe-eval-unobserved',
            correlatedChecks: ['csp-unsafe-eval']
          })
        );
      }
    }

    if (findings.length === 0 && unverifiable.length > 0) {
      return {
        findings: [
          unableToVerify(this, {
            reason:
              'No Content-Security-Policy was visible in the markup and the response headers were not readable from the browser, so whether a policy permits eval could not be determined.',
            affectedPages: unverifiable
          })
        ]
      };
    }

    return finish(this, context, findings, {
      notApplicableReason:
        "No enforced policy governing script was found on the pages analyzed, so there is no 'unsafe-eval' allowance to correlate."
    });
  }
};

/* -------------------------------------------------------------------------- */
/* E. External script without SRI                                             */
/* -------------------------------------------------------------------------- */

export const correlationExternalScriptSriCheck: SecurityCheck = {
  id: 'correlation-external-script-sri',
  category: 'correlation',
  name: 'Third-party script without Subresource Integrity',
  description:
    'Correlates third-party script references with the absence of an integrity hash, where a hash is a sensible control.',
  severity: 'low',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const pageHost = parseUrl(page.url)?.hostname.toLowerCase() ?? '';

      // Same-site hosts share an operator, and analytics, tag-manager, and
      // payment scripts are meant to change without notice. A hash is only
      // meaningful for a static script from another party.
      const candidates = page.resources.filter(
        (resource: NormalizedResource) =>
          resource.type === 'script' &&
          sriIsMeaningful(resource) &&
          relationshipOf(resource, page.origin, pageHost) === 'third-party'
      );
      if (candidates.length === 0) continue;

      const unprotected = candidates.filter((resource) => !resource.integrity);

      if (unprotected.length === 0) {
        findings.push(
          passed(this, {
            summary: 'Every third-party script on this page that can be pinned carries an integrity hash.',
            explanation: 'Scripts from analytics, tag-manager, and payment hosts are excluded because they change without notice.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      findings.push(
        createFinding(this, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'medium',
          source: 'derived',
          title: 'Pinnable third-party scripts load without an integrity hash',
          summary: `${unprotected.length} third-party ${plural(unprotected.length, 'script', 'scripts')} from ${new Set(unprotected.map((r) => r.host)).size} ${plural(new Set(unprotected.map((r) => r.host)).size, 'host', 'hosts')} ${plural(unprotected.length, 'has', 'have')} no integrity attribute.`,
          explanation:
            'These are static-looking scripts from another party. If that host or its delivery path were ever altered, the browser would run the altered file with full page access. A hash removes that trust. It is a hardening measure: nothing here suggests any of these hosts has been compromised. Scripts that must update in place (analytics, tag managers, payment SDKs) are not counted.',
          recommendation:
            'Pin a version, add integrity="sha384-…" with crossorigin="anonymous", or self-host the file. Keep the hash in step with version upgrades.',
          affectedPages: [page.url],
          aggregationKey: 'third-party-script-no-sri',
          affectedResources: unprotected.map((resource) => resource.url ?? resource.rawUrl),
          occurrences: unprotected.length,
          correlatedChecks: ['missing-sri', 'third-party-surface'],
          evidence: unprotected.slice(0, 4).map((resource) => ({
            label: `script · ${resource.host ?? 'unknown host'} · ${classifyDomain(resource.host)}`,
            value: sanitizeUrlForEvidence(resource.url),
            pageUrl: page.url
          }))
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No third-party script that could sensibly carry an integrity hash was referenced in the markup analyzed.'
    });
  }
};

/* -------------------------------------------------------------------------- */
/* F. iframe without sandbox                                                  */
/* -------------------------------------------------------------------------- */

export const correlationIframeSandboxCheck: SecurityCheck = {
  id: 'correlation-iframe-sandbox',
  category: 'correlation',
  name: 'Cross-origin iframe without sandbox',
  description:
    'Suggests sandboxing for cross-origin iframes that carry no sandbox attribute, weighted by what else the page does.',
  severity: 'low',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      // Payment providers ship their own isolation and routinely break under a
      // sandbox they were not built for, so they are not asked to add one.
      const frames = page.resources.filter(
        (resource) =>
          resource.type === 'iframe' &&
          resource.crossOrigin &&
          resource.sandbox === null &&
          classifyDomain(resource.host) !== 'payment'
      );
      if (frames.length === 0) continue;

      const sensitive = hasSensitiveForm(page);

      findings.push(
        createFinding(this, {
          status: sensitive ? 'warning' : 'info',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'derived',
          title: sensitive
            ? 'Cross-origin iframe without sandbox on a page that collects credentials or payment data'
            : 'Cross-origin iframe without sandbox',
          summary: `${frames.length} cross-origin ${plural(frames.length, 'iframe has', 'iframes have')} no sandbox attribute${sensitive ? ', and this page contains a sign-in or payment form' : ''}.`,
          explanation: `This is a hardening suggestion, not a vulnerability. An unsandboxed frame keeps every capability the browser grants by default, including scripts, forms, and top-level navigation, so a compromised or malicious embedded document has more room than it needs.${sensitive ? ' It matters more here because the same page handles credentials or card data.' : ''} Some embeds legitimately need broad capabilities, and a sandbox that is too tight breaks them.`,
          recommendation:
            'Add sandbox with only the tokens the embed needs (for example sandbox="allow-scripts allow-same-origin" for a typical widget), and set a restrictive referrerpolicy. Test the embed after tightening.',
          affectedPages: [page.url],
          aggregationKey: sensitive ? 'no-sandbox-sensitive-page' : 'no-sandbox',
          affectedResources: frames.map((resource) => resource.url ?? resource.rawUrl),
          occurrences: frames.length,
          correlatedChecks: ['iframe-security', 'sensitive-form-transport'],
          evidence: frames.slice(0, 3).map((frame) => ({
            label: `iframe · ${frame.host ?? 'unknown host'}`,
            value: sanitizeUrlForEvidence(frame.url ?? frame.rawUrl),
            pageUrl: page.url
          }))
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No cross-origin iframe without a sandbox attribute was found in the markup analyzed.'
    });
  }
};

/* -------------------------------------------------------------------------- */
/* G. target=_blank without noopener                                          */
/* -------------------------------------------------------------------------- */

function opensBlankWithoutNoopener(link: PageLink): boolean {
  if (!link.isNavigable || link.sameOrigin || link.target !== '_blank') return false;
  const tokens = new Set((link.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean));
  return !tokens.has('noopener') && !tokens.has('noreferrer');
}

export const correlationBlankNoopenerCheck: SecurityCheck = {
  id: 'correlation-target-blank-noopener',
  category: 'correlation',
  name: 'target="_blank" without noopener',
  description:
    'Correlates cross-origin target="_blank" links lacking rel="noopener" with whether the page handles credentials.',
  severity: 'low',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const links = page.links.filter(opensBlankWithoutNoopener);
      if (links.length === 0) continue;

      const sensitive = hasSensitiveForm(page);

      findings.push(
        createFinding(this, {
          status: sensitive ? 'warning' : 'info',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'derived',
          title: sensitive
            ? 'target="_blank" links without noopener on a page that collects credentials'
            : 'target="_blank" links without noopener',
          summary: `${links.length} cross-origin ${plural(links.length, 'link opens', 'links open')} a new tab without rel="noopener"${sensitive ? ' on a page with a sign-in or payment form' : ''}.`,
          explanation: `Current browsers already treat target="_blank" as noopener, so the practical risk today is small and confined to older clients. Where it applies, the opened page can navigate this tab to a look-alike sign-in page.${sensitive ? ' That scenario is most relevant on a page where people enter credentials.' : ''}`,
          recommendation: 'Add rel="noopener" (or "noopener noreferrer") to links that use target="_blank".',
          affectedPages: [page.url],
          aggregationKey: sensitive ? 'blank-no-noopener-sensitive-page' : 'blank-no-noopener',
          occurrences: links.length,
          correlatedChecks: ['external-link-hygiene'],
          evidence: links.slice(0, 3).map((link) => ({
            label: 'target="_blank"',
            value: sanitizeUrlForEvidence(link.url),
            pageUrl: page.url
          }))
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No cross-origin link with target="_blank" and no noopener was found in the markup analyzed.'
    });
  }
};

/* -------------------------------------------------------------------------- */
/* H. Authentication indicators + client-accessible storage                   */
/* -------------------------------------------------------------------------- */

/** Storage that script can read; cookies and Cache Storage are excluded. */
const SCRIPT_READABLE_STORAGE = new Set(['localStorage', 'sessionStorage', 'IndexedDB']);

export const correlationAuthStorageCheck: SecurityCheck = {
  id: 'correlation-auth-browser-storage',
  category: 'correlation',
  name: 'Authentication surface alongside browser storage',
  description:
    'Correlates sign-in or session indicators with use of script-readable browser storage on the same page.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const storage = page.storageIndicators.filter((label) => SCRIPT_READABLE_STORAGE.has(label));
      const authForms = page.forms.filter(isAuthForm);
      if (storage.length === 0 || authForms.length === 0) continue;

      findings.push(
        createFinding(this, {
          status: 'warning',
          severity: 'low',
          observation: 'potential-concern',
          confidence: 'medium',
          source: 'derived',
          title: 'Sign-in page also uses client-accessible storage',
          summary: `This page has a sign-in or credential form and its inline script references ${storage.join(', ')}.`,
          explanation:
            'This is a reminder, not evidence of a problem: what the script stores is not visible to this assessment, and storage is normal for preferences and caches. The concern is specific — anything kept in these stores, including a session or access token, is readable by every script on the origin, so one injected or compromised third-party script could take it.',
          recommendation:
            'Do not keep credentials, long-lived tokens, or session identifiers in localStorage, sessionStorage, or IndexedDB. Prefer HttpOnly, Secure, SameSite cookies for sessions, keep tokens short-lived, and clear user data on sign-out.',
          affectedPages: [page.url],
          aggregationKey: 'auth-and-storage',
          occurrences: storage.length,
          correlatedChecks: ['authentication-surface', 'browser-storage-usage'],
          evidence: [
            { label: 'Storage APIs referenced', value: storage.join(', '), pageUrl: page.url },
            { label: 'Credential forms', value: String(authForms.length), pageUrl: page.url }
          ]
        })
      );
    }

    return finish(this, context, findings, {
      notApplicableReason:
        'No page combined a sign-in or credential form with script-readable browser storage in its inline script.'
    });
  }
};

export const CORRELATION_CHECKS: readonly SecurityCheck[] = [
  correlationPasswordFormHttpActionCheck,
  correlationHttpScriptCheck,
  correlationCspUnsafeInlineCheck,
  correlationCspUnsafeEvalCheck,
  correlationExternalScriptSriCheck,
  correlationIframeSandboxCheck,
  correlationBlankNoopenerCheck,
  correlationAuthStorageCheck
];
