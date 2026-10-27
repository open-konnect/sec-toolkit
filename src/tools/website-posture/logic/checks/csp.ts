/**
 * Content-Security-Policy checks: `csp-unsafe-inline` and `csp-unsafe-eval`.
 *
 * Both require only `html-body`, not `response-headers`. A policy delivered in
 * a `<meta http-equiv>` tag is readable from the markup alone, so requiring
 * header access would needlessly mark these unverifiable on sites that use a
 * meta policy. When neither channel yields a policy and the headers were not
 * observable, the result is `unable-to-verify` — never a finding.
 */

import { CheckContext, CheckOutcome, SecurityCheck, SecurityFinding } from '../../types';
import { createFinding, notApplicable, passed, unableToVerify } from '../findings';
import {
  PageCspInfo,
  effectiveDirective,
  hasKeyword,
  hasNonceOrHash,
  hasStrictDynamic,
  parseCspDirectives,
  readPageCsp
} from './cspPolicy';

/* -------------------------------------------------------------------------- */
/* Source-list auditing                                                       */
/* -------------------------------------------------------------------------- */

interface SourceAudit {
  /** A bare `*`, which permits every origin. */
  wildcard: boolean;
  /** Scheme-only sources such as `https:` or `data:`. */
  schemes: string[];
  /** Sources that permit a plaintext HTTP load. */
  insecure: string[];
  /** Host patterns with a wildcard label, such as `*.example.com`. */
  broadHosts: string[];
  nonceOrHash: boolean;
  strictDynamic: boolean;
}

/**
 * Classifies a CSP source list.
 *
 * Deliberately separates "wide" from "wrong": a wildcard host in `img-src` is
 * an ordinary choice, while the same pattern in `script-src` widens the code
 * that may execute. The checks below decide what each class means for the
 * directive it appeared in; this function only describes what is there.
 */
function auditSources(values: readonly string[]): SourceAudit {
  const audit: SourceAudit = {
    wildcard: false,
    schemes: [],
    insecure: [],
    broadHosts: [],
    nonceOrHash: hasNonceOrHash(values),
    strictDynamic: hasStrictDynamic(values)
  };

  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const lower = value.toLowerCase();

    if (value === '*') {
      audit.wildcard = true;
      continue;
    }

    if (/^[a-z][a-z0-9+.-]*:$/.test(lower)) {
      audit.schemes.push(lower);
      if (lower === 'http:' || lower === 'ws:') audit.insecure.push(lower);
      continue;
    }

    if (lower.startsWith('http://') || lower.startsWith('ws://')) {
      audit.insecure.push(value);
      continue;
    }

    if (value.startsWith('*.') || value.includes('://*.')) {
      audit.broadHosts.push(value);
    }
  }

  return audit;
}

/** Directives whose source list governs code or network reach. */
const SENSITIVE_DIRECTIVES: ReadonlyArray<{ name: string; label: string; why: string }> = [
  {
    name: 'script-src',
    label: 'script execution',
    why: 'any origin listed here may supply code that runs with full access to the page'
  },
  {
    name: 'connect-src',
    label: 'outbound requests',
    why: 'any origin listed here may receive data the page sends with fetch, XHR, or a WebSocket'
  },
  {
    name: 'frame-src',
    label: 'embedded frames',
    why: 'any origin listed here may be embedded in the page'
  },
  {
    name: 'object-src',
    label: 'plugin content',
    why: 'object and embed content can execute in older plugin contexts'
  }
];

const HEADER_BLIND_REASON =
  'No Content-Security-Policy was found in the markup, and the response headers are not readable from this browser context, so a header-delivered policy cannot be ruled out. A missing policy here is not a finding about the site.';

/** Merges every enforced policy on a page into one directive map per policy. */
function enforcedDirectiveMaps(csp: PageCspInfo): Array<{
  channel: string;
  directives: Map<string, string[]>;
}> {
  return csp.enforced.map((source) => ({
    channel: source.channel,
    directives: parseCspDirectives(source.policy)
  }));
}

/**
 * `'unsafe-inline'` in the directive that governs script execution.
 *
 * Also reports the case where no policy exists at all, because with no CSP in
 * force inline script is unrestricted — which is precisely the condition this
 * check exists to detect.
 */
export const cspUnsafeInlineCheck: SecurityCheck = {
  id: 'csp-unsafe-inline',
  category: 'content-security-policy',
  name: 'CSP inline script restriction',
  description:
    "Checks whether the policy governing script execution permits inline script via 'unsafe-inline'.",
  severity: 'medium',
  scoreWeight: 12,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const csp = readPageCsp(page);

      if (csp.enforced.length === 0) {
        findings.push(
          csp.headersReadable
            ? createFinding(this, {
                status: 'warning',
                severity: 'medium',
                observation: 'best-practice',
                confidence: 'high',
                source: 'derived',
                title: 'No Content-Security-Policy in force',
                summary: 'No enforced Content-Security-Policy was observed, so inline script is unrestricted.',
                explanation:
                  'Without a policy the browser applies no restriction on inline script, so any markup injection that reaches the page can execute. A CSP is a defence-in-depth control: its absence is not itself an exploitable flaw, but it removes a layer that would otherwise contain an injection bug.',
                recommendation:
                  "Introduce a Content-Security-Policy in report-only mode, move inline handlers and inline script into external files or nonce them, then enforce a policy with a script-src that omits 'unsafe-inline'.",
                affectedPages: [page.url],
                aggregationKey: 'no-policy'
              })
            : unableToVerify(this, {
                reason: HEADER_BLIND_REASON,
                affectedPages: [page.url],
                recommendation:
                  'Inspect the response headers directly — with curl, your browser devtools Network panel, or from your own server — to confirm whether a Content-Security-Policy is sent.'
              })
        );
        continue;
      }

      for (const policy of enforcedDirectiveMaps(csp)) {
        const directive = effectiveDirective(policy.directives, 'script-src');

        if (!directive) {
          findings.push(
            createFinding(this, {
              status: 'warning',
              severity: 'medium',
              observation: 'best-practice',
              confidence: 'high',
              source: 'html',
              title: 'CSP does not restrict script sources',
              summary: 'A policy is in force but declares neither script-src nor default-src.',
              explanation:
                'With no script-src and no default-src to fall back to, the policy places no restriction on script execution, including inline script. The other directives still apply, but the policy provides no injection containment.',
              recommendation:
                "Add an explicit script-src (or a default-src that script-src can inherit) that omits 'unsafe-inline', and prefer nonces or hashes for any script that must stay inline.",
              affectedPages: [page.url],
              aggregationKey: 'no-script-directive',
              evidence: [{ label: 'Delivered via', value: policy.channel, pageUrl: page.url }]
            })
          );
          continue;
        }

        if (!hasKeyword(directive.values, "'unsafe-inline'")) {
          findings.push(
            passed(this, {
              summary: `The effective ${directive.name} does not allow inline script.`,
              explanation:
                "The directive governing script execution does not include 'unsafe-inline', so the browser blocks inline script and inline event handlers on this page.",
              affectedPages: [page.url],
              evidence: [
                { label: 'Effective directive', value: directive.name, pageUrl: page.url },
                { label: 'Delivered via', value: policy.channel, pageUrl: page.url }
              ]
            })
          );
          continue;
        }

        const neutralized = hasNonceOrHash(directive.values) || hasStrictDynamic(directive.values);

        findings.push(
          neutralized
            ? createFinding(this, {
                status: 'info',
                observation: 'best-practice',
                confidence: 'high',
                source: 'html',
                title: "CSP keeps 'unsafe-inline' as a legacy fallback",
                summary: `The effective ${directive.name} lists 'unsafe-inline' alongside a nonce, hash, or 'strict-dynamic'.`,
                explanation:
                  "Browsers that support CSP Level 2 or later ignore 'unsafe-inline' when a nonce or hash is also present, so this is the standard backwards-compatibility pattern rather than a live weakness. Only browsers too old to understand nonces fall back to allowing inline script.",
                recommendation:
                  "No change is needed unless you no longer support browsers that predate CSP Level 2, in which case 'unsafe-inline' can be dropped.",
                affectedPages: [page.url],
                aggregationKey: 'unsafe-inline-with-nonce',
                evidence: [{ label: 'Effective directive', value: directive.name, pageUrl: page.url }]
              })
            : createFinding(this, {
                status: 'warning',
                severity: 'medium',
                observation: 'verified-observation',
                confidence: 'high',
                source: 'html',
                title: "CSP allows inline script via 'unsafe-inline'",
                summary: `The effective ${directive.name} includes 'unsafe-inline' with no nonce, hash, or 'strict-dynamic' to override it.`,
                explanation:
                  "'unsafe-inline' permits inline <script> blocks and inline event handlers, which is the main class of payload a cross-site scripting bug delivers. The policy is in force, but it no longer contains script injection.",
                recommendation:
                  "Remove 'unsafe-inline' from script-src and allow the inline script you genuinely need with a per-response nonce or a hash. Roll the change out in report-only mode first.",
                affectedPages: [page.url],
                aggregationKey: 'unsafe-inline',
                evidence: [
                  { label: 'Effective directive', value: directive.name, pageUrl: page.url },
                  { label: 'Delivered via', value: policy.channel, pageUrl: page.url }
                ]
              })
        );
      }
    }

    return { findings };
  }
};

/**
 * `'unsafe-eval'` in the directive that governs script execution.
 *
 * Unlike the inline check, a total absence of CSP is reported as
 * not-applicable here: there is no policy to inspect, and the inline check
 * already reports the missing policy once. Reporting it in both would put two
 * cards about the same fact in front of the user.
 */
export const cspUnsafeEvalCheck: SecurityCheck = {
  id: 'csp-unsafe-eval',
  category: 'content-security-policy',
  name: 'CSP dynamic evaluation restriction',
  description:
    "Checks whether the policy governing script execution permits eval and its relatives via 'unsafe-eval'.",
  severity: 'medium',
  scoreWeight: 12,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const csp = readPageCsp(page);

      if (csp.enforced.length === 0) {
        findings.push(
          csp.headersReadable
            ? notApplicable(this, {
                reason:
                  'No enforced Content-Security-Policy was observed, so there is no policy to inspect for a dynamic-evaluation allowance.',
                affectedPages: [page.url],
                aggregationKey: 'no-policy'
              })
            : unableToVerify(this, {
                reason: HEADER_BLIND_REASON,
                affectedPages: [page.url]
              })
        );
        continue;
      }

      for (const policy of enforcedDirectiveMaps(csp)) {
        const directive = effectiveDirective(policy.directives, 'script-src');

        if (!directive) {
          findings.push(
            notApplicable(this, {
              reason:
                'The policy declares neither script-src nor default-src, so it places no restriction on dynamic evaluation. The missing script restriction is reported by the inline-script check.',
              affectedPages: [page.url],
              aggregationKey: 'no-script-directive'
            })
          );
          continue;
        }

        findings.push(
          hasKeyword(directive.values, "'unsafe-eval'")
            ? createFinding(this, {
                status: 'warning',
                severity: 'medium',
                observation: 'verified-observation',
                confidence: 'high',
                source: 'html',
                title: "CSP allows dynamic evaluation via 'unsafe-eval'",
                summary: `The effective ${directive.name} includes 'unsafe-eval'.`,
                explanation:
                  "'unsafe-eval' re-enables eval, new Function, and string arguments to setTimeout and setInterval. That lets attacker-controlled strings become executable code, which is the route a CSP is otherwise well placed to close.",
                recommendation:
                  "Identify what needs 'unsafe-eval' — it is usually a client-side template compiler, an older framework build, or a bundler development mode — replace it with a precompiled or ahead-of-time build, then drop the keyword.",
                affectedPages: [page.url],
                aggregationKey: 'unsafe-eval',
                evidence: [
                  { label: 'Effective directive', value: directive.name, pageUrl: page.url },
                  { label: 'Delivered via', value: policy.channel, pageUrl: page.url }
                ]
              })
            : passed(this, {
                summary: `The effective ${directive.name} does not allow dynamic evaluation.`,
                explanation:
                  "'unsafe-eval' is absent, so the browser blocks eval, new Function, and string-valued timer callbacks on this page.",
                affectedPages: [page.url],
                evidence: [{ label: 'Effective directive', value: directive.name, pageUrl: page.url }]
              })
        );
      }
    }

    return { findings };
  }
};

/**
 * Overly broad sources in the directives that govern code and network reach.
 *
 * Breadth is reported in proportion to what it permits. A wildcard in
 * `script-src` is a real weakening of the policy; a wildcard subdomain in
 * `frame-src` is a design choice. Neither is presented as a vulnerability,
 * because a CSP is a containment layer and a wide policy is a weaker layer,
 * not an exploitable flaw.
 */
export const cspBroadSourcesCheck: SecurityCheck = {
  id: 'csp-broad-sources',
  category: 'content-security-policy',
  name: 'CSP source breadth',
  description:
    'Reports wildcard, scheme-only, and plaintext-HTTP sources in the CSP directives that govern code and outbound requests.',
  severity: 'medium',
  scoreWeight: 10,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let policiesSeen = 0;

    for (const page of context.pages) {
      const csp = readPageCsp(page);
      if (csp.enforced.length === 0) continue;
      policiesSeen += csp.enforced.length;

      for (const policy of enforcedDirectiveMaps(csp)) {
        const wildcards: string[] = [];
        const insecure: string[] = [];
        const broad: string[] = [];

        for (const directive of SENSITIVE_DIRECTIVES) {
          const effective = effectiveDirective(policy.directives, directive.name);
          if (!effective) continue;

          const audit = auditSources(effective.values);
          // 'strict-dynamic' makes host and wildcard sources inert for script,
          // so reporting breadth there would be actively misleading.
          const neutralized = directive.name === 'script-src' && audit.strictDynamic;

          if (audit.wildcard && !neutralized) {
            wildcards.push(`${effective.name} (${directive.label})`);
          }
          if (audit.insecure.length > 0) {
            insecure.push(`${effective.name}: ${audit.insecure.slice(0, 3).join(' ')}`);
          }
          if (!neutralized && (audit.broadHosts.length > 0 || audit.schemes.includes('https:'))) {
            broad.push(
              `${effective.name}: ${[...audit.broadHosts, ...audit.schemes.filter((scheme) => scheme === 'https:')].slice(0, 3).join(' ')}`
            );
          }
        }

        if (wildcards.length > 0) {
          findings.push(
            createFinding(this, {
              status: 'warning',
              severity: 'medium',
              observation: 'verified-observation',
              confidence: 'high',
              source: 'html',
              title: 'CSP permits every origin for a sensitive directive',
              summary: `${wildcards.length} directive${wildcards.length === 1 ? '' : 's'} governing code or network reach allow${wildcards.length === 1 ? 's' : ''} any origin via "*".`,
              explanation:
                'A bare wildcard removes the restriction the directive exists to impose: the browser will load script, open connections, or embed frames from anywhere. The policy still blocks inline script if it does not allow it, but it no longer limits where code may come from.',
              recommendation:
                "Replace * with the specific origins you load from. For script-src, prefer a per-response nonce plus 'strict-dynamic' over a host allowlist, which is easier to keep correct as dependencies change.",
              affectedPages: [page.url],
              aggregationKey: 'wildcard',
              occurrences: wildcards.length,
              evidence: wildcards.slice(0, 4).map((entry) => ({
                label: 'Wildcard directive',
                value: entry,
                pageUrl: page.url
              }))
            })
          );
        }

        if (insecure.length > 0) {
          findings.push(
            createFinding(this, {
              status: 'warning',
              severity: 'medium',
              observation: 'verified-observation',
              confidence: 'high',
              source: 'html',
              title: 'CSP allows plaintext sources',
              summary: `${insecure.length} directive${insecure.length === 1 ? '' : 's'} permit${insecure.length === 1 ? 's' : ''} a resource to be loaded over http:// or ws://.`,
              explanation:
                'A plaintext source can be substituted by anyone on the network path. Where the directive governs script or connections, that substitution means attacker-supplied code or a redirected data stream. Browsers also block most plaintext subresources on a secure page, so the allowance may simply be dead configuration.',
              recommendation:
                'Remove http: and ws: sources from the policy and serve those dependencies over TLS.',
              affectedPages: [page.url],
              aggregationKey: 'insecure-source',
              occurrences: insecure.length,
              evidence: insecure.slice(0, 4).map((entry) => ({
                label: 'Plaintext source',
                value: entry,
                pageUrl: page.url
              }))
            })
          );
        }

        if (broad.length > 0) {
          findings.push(
            createFinding(this, {
              status: 'info',
              observation: 'best-practice',
              confidence: 'medium',
              source: 'html',
              title: 'CSP uses broad source patterns',
              summary: `${broad.length} directive${broad.length === 1 ? '' : 's'} use${broad.length === 1 ? 's' : ''} a wildcard subdomain or a scheme-wide source.`,
              explanation:
                'A pattern such as *.example.com trusts every current and future host under that domain, and a bare https: trusts every HTTPS origin on the internet. This is a common and often deliberate trade-off — a CDN with rotating hostnames needs it — so it is reported as an observation, not a defect.',
              recommendation:
                'Narrow each pattern to the specific hosts you depend on where that is practical. If a wildcard is required, confirm that every host under it is one you control or trust.',
              affectedPages: [page.url],
              aggregationKey: 'broad-pattern',
              occurrences: broad.length,
              evidence: broad.slice(0, 4).map((entry) => ({
                label: 'Broad source',
                value: entry,
                pageUrl: page.url
              }))
            })
          );
        }

        if (wildcards.length === 0 && insecure.length === 0 && broad.length === 0) {
          findings.push(
            passed(this, {
              summary: 'The sensitive CSP directives list specific sources.',
              explanation:
                'No wildcard, scheme-wide, or plaintext source appears in the directives governing script execution, outbound requests, framing, or plugin content.',
              affectedPages: [page.url],
              evidence: [{ label: 'Delivered via', value: policy.channel, pageUrl: page.url }]
            })
          );
        }
      }
    }

    if (policiesSeen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No enforced Content-Security-Policy was observed, so there is no source list to audit. Whether a policy is missing is reported by the inline-script check.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/**
 * Directives a policy omits that `default-src` cannot cover for it.
 *
 * `object-src`, `base-uri`, and `frame-ancestors` do not inherit usefully:
 * `base-uri` and `frame-ancestors` have no fallback at all, and `object-src`
 * is worth naming explicitly because plugin content bypasses script
 * restrictions in the contexts where it still works.
 */
export const cspMissingDirectivesCheck: SecurityCheck = {
  id: 'csp-missing-directives',
  category: 'content-security-policy',
  name: 'CSP directive coverage',
  description:
    'Checks a policy for object-src, base-uri, and frame-ancestors, none of which default-src can supply.',
  severity: 'low',
  scoreWeight: 8,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let policiesSeen = 0;

    for (const page of context.pages) {
      const csp = readPageCsp(page);
      if (csp.enforced.length === 0) continue;
      policiesSeen += csp.enforced.length;

      for (const policy of enforcedDirectiveMaps(csp)) {
        const missing: string[] = [];

        // object-src falls back to default-src, so it only counts as missing
        // when there is no default-src either.
        if (!policy.directives.has('object-src') && !policy.directives.has('default-src')) {
          missing.push('object-src');
        }
        if (!policy.directives.has('base-uri')) missing.push('base-uri');

        // frame-ancestors is ignored in a meta policy, so a meta-only policy
        // cannot supply it and saying otherwise would be wrong.
        if (policy.channel === 'header' && !policy.directives.has('frame-ancestors')) {
          missing.push('frame-ancestors');
        }

        if (missing.length === 0) {
          findings.push(
            passed(this, {
              summary: 'The policy declares object-src, base-uri, and frame-ancestors.',
              explanation:
                'These three directives have no useful fallback, and all are present, so the policy covers plugin content, base-tag injection, and framing.',
              affectedPages: [page.url],
              evidence: [{ label: 'Delivered via', value: policy.channel, pageUrl: page.url }]
            })
          );
          continue;
        }

        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'best-practice',
            confidence: 'high',
            source: 'html',
            title: 'CSP omits directives that have no fallback',
            summary: `The policy does not declare ${missing.join(', ')}.`,
            explanation:
              "base-uri and frame-ancestors have no fallback, so omitting them leaves those behaviours unrestricted no matter what default-src says. Without base-uri an injected <base> tag can re-point every relative URL on the page; without frame-ancestors the page relies on X-Frame-Options alone for framing control; without object-src plugin content is governed only by default-src. These are missing layers, not active flaws.",
            recommendation:
              "Add object-src 'none'; base-uri 'self'; frame-ancestors 'none' (or 'self') unless the page genuinely needs plugin content, a dynamic base tag, or to be embedded.",
            affectedPages: [page.url],
            aggregationKey: `missing:${missing.join('+')}`,
            occurrences: missing.length,
            evidence: [
              { label: 'Missing directives', value: missing.join(', '), pageUrl: page.url },
              { label: 'Delivered via', value: policy.channel, pageUrl: page.url }
            ]
          })
        );
      }
    }

    if (policiesSeen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No enforced Content-Security-Policy was observed, so there are no directives to audit.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/**
 * Report-only policies.
 *
 * A report-only policy blocks nothing. Running one is the correct way to trial
 * a policy, so its presence is reported as an observation — except where it is
 * the *only* policy, which means the site is measuring a policy it has not yet
 * put into force.
 */
export const cspReportOnlyCheck: SecurityCheck = {
  id: 'csp-report-only',
  category: 'content-security-policy',
  name: 'CSP enforcement mode',
  description: 'Distinguishes an enforced Content-Security-Policy from a report-only one.',
  severity: 'low',
  scoreWeight: 6,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const csp = readPageCsp(page);

      if (csp.enforced.length === 0 && csp.reportOnly.length === 0) {
        findings.push(
          csp.headersReadable
            ? notApplicable(this, {
                reason:
                  'No Content-Security-Policy was observed in either enforcing or report-only form, so there is no enforcement mode to report.',
                affectedPages: [page.url],
                aggregationKey: 'no-policy'
              })
            : unableToVerify(this, { reason: HEADER_BLIND_REASON, affectedPages: [page.url] })
        );
        continue;
      }

      if (csp.enforced.length === 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'best-practice',
            confidence: 'high',
            source: 'browser',
            title: 'Content-Security-Policy is report-only',
            summary: 'A policy is delivered in report-only mode and no enforcing policy was observed.',
            explanation:
              'Content-Security-Policy-Report-Only tells the browser to report violations without blocking anything, so the policy provides no protection yet. This is the normal and recommended first stage of a rollout — the gap is that the rollout has not been completed.',
            recommendation:
              'Review the violation reports, fix or allowlist the legitimate sources they reveal, then move the same policy to the enforcing Content-Security-Policy header.',
            affectedPages: [page.url],
            aggregationKey: 'report-only-only'
          })
        );
        continue;
      }

      findings.push(
        csp.reportOnly.length > 0
          ? createFinding(this, {
              status: 'info',
              observation: 'verified-observation',
              confidence: 'high',
              source: 'browser',
              title: 'Both an enforced and a report-only policy are delivered',
              summary: 'An enforcing policy is in force alongside a report-only policy.',
              explanation:
                'This is the standard pattern for tightening a policy safely: the current policy protects the page while a stricter candidate is measured in report-only mode. Only the enforcing policy is evaluated by the other CSP checks.',
              recommendation:
                'No action is needed. Promote the report-only policy once its violation reports are clean.',
              affectedPages: [page.url],
              aggregationKey: 'both'
            })
          : passed(this, {
              summary: 'The Content-Security-Policy is enforced rather than report-only.',
              explanation:
                'The browser blocks what the policy disallows, so the policy is actually providing containment.',
              affectedPages: [page.url],
              aggregationKey: 'enforced'
            })
      );
    }

    if (findings.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason: 'No page markup was available, so no policy could be examined.',
            affectedPages: [context.target.url]
          })
        ]
      };
    }

    return { findings };
  }
};
