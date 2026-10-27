/**
 * Response-header checks.
 *
 * The governing rule for this whole file: **a header we could not read is not
 * a header the site failed to send.** A cross-origin `fetch` exposes only the
 * CORS-safelisted response headers, so any page whose
 * `headers.visibility !== 'readable'` yields `unable-to-verify` and never a
 * "header missing" finding. `createHeaderCheck` exists so that branching is
 * written once instead of being re-derived — and possibly got wrong — in each
 * of the checks below.
 */

import {
  AnalyzedPage,
  CheckContext,
  CheckOutcome,
  FindingCategory,
  SecurityCheck,
  SecurityCheckMeta,
  SecurityFinding,
  Severity
} from '../../types';
import {
  HEADER_UNREADABLE_REASON,
  HSTS_RECOMMENDED_MAX_AGE,
  allowsSharedCaching,
  assessReferrerPolicy,
  parseFrameOptions,
  parseHsts,
  parsePermissionsPolicy,
  partitionByHeaderVisibility,
  readHeader,
  revealsVersion
} from '../analysis/headers';
import { isSensitiveForm } from '../analysis/forms';
import { createFinding, notApplicable, passed, unableToVerify } from '../findings';
import { parseCspDirectives, readPageCsp } from './cspPolicy';

export interface HeaderCheckSpec {
  id: string;
  name: string;
  description: string;
  /** Defaults to `response-headers`. */
  category?: FindingCategory;
  severity: Severity;
  scoreWeight: number;
  /** Header names the check reads, named in the unverifiable explanation. */
  headers: readonly string[];
  /** Runs once per page whose headers were fully observable. */
  evaluate(check: SecurityCheckMeta, page: AnalyzedPage): SecurityFinding[];
}

/**
 * Builds a check that reads response headers.
 *
 * Pages are partitioned by header visibility before `evaluate` is called, so a
 * spec never sees a page it cannot legitimately draw a conclusion about. When
 * some pages were readable and others were not, both results are reported:
 * the verdict for what was seen, plus one `unable-to-verify` covering the rest.
 */
export function createHeaderCheck(spec: HeaderCheckSpec): SecurityCheck {
  const headerList = spec.headers.join(', ');

  const check: SecurityCheck = {
    id: spec.id,
    category: spec.category ?? 'response-headers',
    name: spec.name,
    description: spec.description,
    severity: spec.severity,
    scoreWeight: spec.scoreWeight,
    modes: ['browser-passive'],
    requires: ['response-headers'],

    execute(context: CheckContext): CheckOutcome {
      const { readable, unreadable } = partitionByHeaderVisibility(context.pages);

      if (readable.length === 0) {
        return {
          findings: [
            unableToVerify(check, {
              reason: `${HEADER_UNREADABLE_REASON} Header${spec.headers.length === 1 ? '' : 's'} this check needs: ${headerList}.`,
              affectedPages:
                unreadable.length > 0 ? unreadable.map((page) => page.url) : [context.target.url],
              recommendation: `Inspect the response directly — \`curl -sI ${context.target.url}\`, the Network panel in your browser devtools, or a request made from your own server — to see whether ${headerList} ${spec.headers.length === 1 ? 'is' : 'are'} sent.`
            })
          ]
        };
      }

      const findings: SecurityFinding[] = [];
      for (const page of readable) {
        findings.push(...spec.evaluate(check, page));
      }

      if (unreadable.length > 0) {
        findings.push(
          unableToVerify(check, {
            reason: `${HEADER_UNREADABLE_REASON} ${unreadable.length} of the ${context.pages.length} pages analyzed did not expose their headers, so ${headerList} could not be evaluated for those pages.`,
            affectedPages: unreadable.map((page) => page.url),
            aggregationKey: 'headers-not-exposed'
          })
        );
      }

      return { findings };
    }
  };

  return check;
}

/* -------------------------------------------------------------------------- */
/* Strict-Transport-Security                                                  */
/* -------------------------------------------------------------------------- */

export const hstsCheck = createHeaderCheck({
  id: 'hsts',
  name: 'HTTP Strict Transport Security',
  description:
    'Checks for a Strict-Transport-Security header with a max-age long enough to be useful.',
  category: 'transport',
  severity: 'medium',
  scoreWeight: 12,
  headers: ['Strict-Transport-Security'],

  evaluate(check, page) {
    // A browser ignores HSTS on a plaintext response, by design: honouring it
    // would let an on-path attacker pin a host permanently.
    if (page.protocol !== 'https:') {
      return [
        notApplicable(check, {
          reason:
            'This page was served over plaintext HTTP, and browsers ignore Strict-Transport-Security on a non-HTTPS response. The HTTPS transport check reports the underlying problem.',
          affectedPages: [page.url]
        })
      ];
    }

    const value = readHeader(page, 'strict-transport-security');

    if (!value) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'medium',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'No Strict-Transport-Security header',
          summary: 'The response does not send Strict-Transport-Security.',
          explanation:
            'Without HSTS a visitor\'s first request of the day can still be made over plaintext HTTP — typed into the address bar, or followed from an old link — which an on-path attacker can intercept before any redirect happens. HSTS tells the browser to use HTTPS for this host from then on, closing that window.',
          recommendation:
            'Send Strict-Transport-Security: max-age=31536000; includeSubDomains once every host and subdomain is reachable over HTTPS. Roll it out with a short max-age first, since the policy cannot be withdrawn from browsers that have already cached it.',
          affectedPages: [page.url],
          aggregationKey: 'missing'
        })
      ];
    }

    const policy = parseHsts(value);

    if (policy.maxAge === null) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'Strict-Transport-Security has no usable max-age',
          summary: 'The header is present but no valid max-age directive could be parsed.',
          explanation:
            'max-age is the only required directive. Without it the browser cannot tell how long to remember the policy, so the header has no effect at all.',
          recommendation: 'Add an explicit max-age in seconds, for example max-age=31536000.',
          affectedPages: [page.url],
          aggregationKey: 'no-max-age',
          evidence: [{ label: 'Strict-Transport-Security', value, pageUrl: page.url }]
        })
      ];
    }

    if (policy.maxAge === 0) {
      return [
        createFinding(check, {
          status: 'info',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'Strict-Transport-Security is being withdrawn',
          summary: 'The header sends max-age=0, which clears any previously cached policy.',
          explanation:
            'max-age=0 tells browsers to forget the HSTS policy for this host. That is the correct way to retire HSTS deliberately, so it is reported as an observation rather than a defect — but if it is unintentional, the host currently has no HSTS protection.',
          recommendation:
            'If HSTS is meant to be active, set a positive max-age. If the withdrawal is intentional, no change is needed.',
          affectedPages: [page.url],
          aggregationKey: 'withdrawn',
          evidence: [{ label: 'Strict-Transport-Security', value, pageUrl: page.url }]
        })
      ];
    }

    if (policy.maxAge < HSTS_RECOMMENDED_MAX_AGE) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'Strict-Transport-Security max-age is short',
          summary: `max-age is ${policy.maxAge} seconds, below the six months generally recommended.`,
          explanation:
            'A short max-age means the protection lapses sooner for a visitor who does not return, re-opening the plaintext first-request window. A short value is also the normal, sensible state during a staged rollout.',
          recommendation:
            'Once you are confident in the HTTPS deployment, raise max-age to at least 15552000 (six months), and to 31536000 if you intend to submit the host to the preload list.',
          affectedPages: [page.url],
          aggregationKey: 'short-max-age',
          evidence: [{ label: 'max-age', value: String(policy.maxAge), pageUrl: page.url }]
        })
      ];
    }

    return [
      passed(check, {
        summary: `Strict-Transport-Security is sent with max-age=${policy.maxAge}.`,
        explanation: `The browser will use HTTPS for this host for the next ${Math.round(policy.maxAge / 86400)} days.${policy.includeSubDomains ? ' The policy also covers subdomains.' : ' The policy does not cover subdomains, so a subdomain reachable over HTTP is not protected by it.'}${policy.preload ? ' The preload directive is present; whether the host is actually on a browser preload list could not be checked from here.' : ''}`,
        affectedPages: [page.url],
        evidence: [
          { label: 'max-age', value: String(policy.maxAge), pageUrl: page.url },
          { label: 'includeSubDomains', value: String(policy.includeSubDomains), pageUrl: page.url }
        ]
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* X-Content-Type-Options                                                     */
/* -------------------------------------------------------------------------- */

export const contentTypeOptionsCheck = createHeaderCheck({
  id: 'x-content-type-options',
  name: 'MIME type sniffing protection',
  description: 'Checks for X-Content-Type-Options: nosniff on the response.',
  severity: 'low',
  scoreWeight: 6,
  headers: ['X-Content-Type-Options'],

  evaluate(check, page) {
    const value = readHeader(page, 'x-content-type-options');

    if (!value) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'No X-Content-Type-Options header',
          summary: 'The response does not send X-Content-Type-Options: nosniff.',
          explanation:
            'Without nosniff a browser may guess a response\'s type from its bytes instead of trusting the declared Content-Type. A file an attacker managed to upload can then be interpreted as script or as a stylesheet even though the server labelled it as something inert.',
          recommendation:
            'Send X-Content-Type-Options: nosniff on every response, and make sure each response also carries an accurate Content-Type.',
          affectedPages: [page.url],
          aggregationKey: 'missing'
        })
      ];
    }

    if (value.trim().toLowerCase() !== 'nosniff') {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'X-Content-Type-Options has an unrecognized value',
          summary: 'The header is present but its value is not "nosniff".',
          explanation:
            'nosniff is the only value browsers act on. Any other value is ignored, so the header provides no protection despite being present.',
          recommendation: 'Set the header value to exactly "nosniff".',
          affectedPages: [page.url],
          aggregationKey: 'unrecognized-value',
          evidence: [{ label: 'X-Content-Type-Options', value, pageUrl: page.url }]
        })
      ];
    }

    return [
      passed(check, {
        summary: 'X-Content-Type-Options: nosniff is sent.',
        explanation:
          'The browser will honour the declared Content-Type of this response instead of guessing from its content.',
        affectedPages: [page.url]
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* Clickjacking protection                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Framing restrictions, from either `frame-ancestors` or `X-Frame-Options`.
 *
 * Only a header-delivered CSP is consulted for `frame-ancestors`: browsers
 * ignore the directive when a policy arrives in a `<meta>` tag, so reading it
 * from markup would credit the site with protection it does not have.
 */
export const clickjackingProtectionCheck = createHeaderCheck({
  id: 'clickjacking-protection',
  name: 'Framing restrictions',
  description:
    'Checks whether the response restricts who may embed it, via CSP frame-ancestors or X-Frame-Options.',
  category: 'framing',
  severity: 'medium',
  scoreWeight: 10,
  headers: ['Content-Security-Policy (frame-ancestors)', 'X-Frame-Options'],

  evaluate(check, page) {
    const csp = readPageCsp(page);
    const frameAncestors = csp.enforced
      .filter((source) => source.channel === 'header')
      .map((source) => parseCspDirectives(source.policy).get('frame-ancestors'))
      .find((values): values is string[] => Array.isArray(values));

    const xfo = readHeader(page, 'x-frame-options');
    const stance = xfo ? parseFrameOptions(xfo) : null;

    if (frameAncestors) {
      const permissive = frameAncestors.some((value) => value === '*');

      return [
        permissive
          ? createFinding(check, {
              status: 'warning',
              severity: 'medium',
              observation: 'verified-observation',
              confidence: 'high',
              source: 'browser',
              title: 'frame-ancestors allows any origin',
              summary: 'The policy declares frame-ancestors * , so any site may embed this page.',
              explanation:
                'An attacker-controlled page can embed this one invisibly and trick a visitor into clicking something inside it — the interaction lands on your site, with the visitor\'s session. A wildcard here is occasionally deliberate, for a widget meant to be embedded anywhere, which is why this is reported rather than assumed to be a mistake.',
              recommendation:
                "Restrict frame-ancestors to 'self' plus the specific origins that legitimately embed this page, or to 'none' if it should never be framed.",
              affectedPages: [page.url],
              aggregationKey: 'wildcard-frame-ancestors',
              evidence: [{ label: 'frame-ancestors', value: frameAncestors.join(' '), pageUrl: page.url }]
            })
          : passed(check, {
              summary: 'A CSP frame-ancestors directive restricts who may embed this page.',
              explanation:
                'frame-ancestors is the modern mechanism and supersedes X-Frame-Options. The browser will refuse to render this page inside a frame on an origin the directive does not list.',
              affectedPages: [page.url],
              evidence: [{ label: 'frame-ancestors', value: frameAncestors.join(' '), pageUrl: page.url }]
            })
      ];
    }

    if (stance === 'deny' || stance === 'sameorigin') {
      return [
        passed(check, {
          summary: `X-Frame-Options: ${stance.toUpperCase()} restricts framing of this page.`,
          explanation:
            'X-Frame-Options is honoured by every current browser, so framing is restricted. It is less expressive than CSP frame-ancestors — it cannot name a specific allowed origin — but it is effective for the all-or-same-origin cases.',
          recommendation:
            "Consider adding a CSP frame-ancestors directive as well, which supersedes this header and lets you name individual origins.",
          affectedPages: [page.url],
          evidence: [{ label: 'X-Frame-Options', value: xfo as string, pageUrl: page.url }]
        })
      ];
    }

    if (stance === 'allow-from') {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'medium',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'X-Frame-Options uses the obsolete ALLOW-FROM form',
          summary: 'The header uses ALLOW-FROM, which no current browser implements.',
          explanation:
            'ALLOW-FROM was never widely supported and has been removed. Browsers that do not understand it ignore the whole header, so this page is effectively unprotected against framing despite the header being present.',
          recommendation:
            'Replace it with a CSP frame-ancestors directive naming the origins that may embed this page, and keep X-Frame-Options: SAMEORIGIN only as a fallback.',
          affectedPages: [page.url],
          aggregationKey: 'allow-from',
          evidence: [{ label: 'X-Frame-Options', value: xfo as string, pageUrl: page.url }]
        })
      ];
    }

    if (stance === 'unrecognized') {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'X-Frame-Options has an unrecognized value',
          summary: 'The header is present but its value is neither DENY nor SAMEORIGIN.',
          explanation:
            'A browser that cannot parse the value ignores the header entirely, so the intended framing restriction is not applied.',
          recommendation:
            'Use X-Frame-Options: SAMEORIGIN or DENY, and prefer a CSP frame-ancestors directive for anything more specific.',
          affectedPages: [page.url],
          aggregationKey: 'unrecognized-value',
          evidence: [{ label: 'X-Frame-Options', value: xfo as string, pageUrl: page.url }]
        })
      ];
    }

    return [
      createFinding(check, {
        status: 'warning',
        severity: 'medium',
        observation: 'best-practice',
        confidence: 'high',
        source: 'browser',
        title: 'No framing restriction observed',
        summary: 'Neither a CSP frame-ancestors directive nor X-Frame-Options was sent.',
        explanation:
          'Any site can embed this page in a frame. That becomes a clickjacking risk where the page has state-changing controls — a settings toggle, a purchase button, a form — because a visitor can be induced to interact with it unknowingly. A page with no interactive state carries little risk from framing.',
        recommendation:
          "Add a CSP frame-ancestors directive: 'none' if the page should never be framed, 'self' if only your own pages should embed it, or an explicit origin list for a deliberate embedding partner. Add X-Frame-Options: SAMEORIGIN alongside it for older clients.",
        affectedPages: [page.url],
        aggregationKey: 'missing'
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* Referrer-Policy                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Referrer policy from the response header or a `<meta name="referrer">` tag.
 *
 * Written by hand rather than through `createHeaderCheck` because the meta
 * form is readable from markup alone: a site that sets its policy that way
 * would otherwise be reported as unverifiable when it is plainly observable.
 */
export const referrerPolicyCheck: SecurityCheck = {
  id: 'referrer-policy',
  category: 'response-headers',
  name: 'Referrer policy',
  description:
    'Checks the effective referrer policy, from the response header or a meta referrer tag.',
  severity: 'low',
  scoreWeight: 8,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const header = page.headers.visibility === 'readable' ? readHeader(page, 'referrer-policy') : null;

      const meta = page.metaTags.find((tag) => (tag.name || '').toLowerCase() === 'referrer');
      const metaValue = meta && meta.content.trim() ? meta.content.trim() : null;

      const value = header ?? metaValue;
      const channel = header ? 'response header' : 'meta referrer tag';

      if (!value) {
        if (page.headers.visibility !== 'readable') {
          findings.push(
            unableToVerify(this, {
              reason: `${HEADER_UNREADABLE_REASON} No meta referrer tag was present either, so a header-delivered Referrer-Policy can be neither confirmed nor ruled out.`,
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
            confidence: 'high',
            source: 'browser',
            title: 'No referrer policy declared',
            summary: 'Neither a Referrer-Policy header nor a meta referrer tag was observed.',
            explanation:
              'The browser then applies its own default, which for current browsers is strict-origin-when-cross-origin — a reasonable choice. Declaring the policy explicitly means you are not relying on a default that differs between browsers and versions.',
            recommendation:
              'Send Referrer-Policy: strict-origin-when-cross-origin, or no-referrer if outbound requests should carry no referrer at all.',
            affectedPages: [page.url],
            aggregationKey: 'missing'
          })
        );
        continue;
      }

      const assessment = assessReferrerPolicy(value);

      if (assessment.unrecognized) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'verified-observation',
            confidence: 'medium',
            source: 'browser',
            title: 'Referrer policy value is not recognized',
            summary: `No token in the declared policy is a known referrer policy, so the browser default applies.`,
            explanation:
              'A browser ignores tokens it does not recognize and falls back to its default policy. The declared intent is therefore not in effect.',
            recommendation:
              'Use one of the defined values, such as strict-origin-when-cross-origin, same-origin, or no-referrer.',
            affectedPages: [page.url],
            aggregationKey: 'unrecognized-value',
            evidence: [{ label: `Referrer policy (${channel})`, value, pageUrl: page.url }]
          })
        );
        continue;
      }

      if (assessment.leaksFullUrl) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'browser',
            title: 'Referrer policy sends full URLs to other origins',
            summary: `The effective policy is "${assessment.effective}", which includes the full URL in cross-origin requests.`,
            explanation:
              'The full URL goes to third-party origins in the Referer header — including the path and query string. Where a URL carries a password-reset token, an invitation code, a session identifier, or an internal path, that value is handed to every external resource the page loads.',
            recommendation:
              'Switch to strict-origin-when-cross-origin so only the origin is sent across origins, and avoid putting secrets in URLs regardless of policy.',
            affectedPages: [page.url],
            aggregationKey: 'leaks-full-url',
            evidence: [{ label: `Referrer policy (${channel})`, value, pageUrl: page.url }]
          })
        );
        continue;
      }

      findings.push(
        passed(this, {
          summary: `An explicit referrer policy of "${assessment.effective}" is in effect.`,
          explanation:
            'The policy does not send a full URL to a cross-origin destination, so paths and query strings are not leaked through the Referer header.',
          affectedPages: [page.url],
          evidence: [{ label: `Referrer policy (${channel})`, value, pageUrl: page.url }]
        })
      );
    }

    if (findings.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason: 'No page markup was available, so no referrer policy could be evaluated.',
            affectedPages: [context.target.url]
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Permissions-Policy                                                         */
/* -------------------------------------------------------------------------- */

/** Features whose unrestricted delegation is worth naming in a report. */
const POWERFUL_FEATURES = new Set([
  'camera',
  'microphone',
  'geolocation',
  'display-capture',
  'payment',
  'usb',
  'serial',
  'bluetooth',
  'midi',
  'idle-detection'
]);

export const permissionsPolicyCheck = createHeaderCheck({
  id: 'permissions-policy',
  name: 'Permissions policy',
  description:
    'Checks whether a Permissions-Policy header restricts delegation of powerful browser features.',
  category: 'browser-permissions',
  severity: 'low',
  scoreWeight: 6,
  headers: ['Permissions-Policy'],

  evaluate(check, page) {
    const value = readHeader(page, 'permissions-policy');

    if (!value) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'No Permissions-Policy header',
          summary: 'The response does not send a Permissions-Policy.',
          explanation:
            'Permissions-Policy limits which features — camera, microphone, geolocation, payment handlers — this document and the frames it embeds may request. Without it, an embedded third-party frame can ask the visitor for a permission in the context of your site. Browsers still prompt the user, so this is a hardening gap rather than an exposure.',
          recommendation:
            'Send a Permissions-Policy that disables the features you do not use, for example: Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=().',
          affectedPages: [page.url],
          aggregationKey: 'missing'
        })
      ];
    }

    const features = parsePermissionsPolicy(value);
    const wildcarded = [...features.entries()]
      .filter(([name, allowlist]) => POWERFUL_FEATURES.has(name) && allowlist.includes('*'))
      .map(([name]) => name);

    if (wildcarded.length > 0) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'Permissions-Policy delegates a powerful feature to any origin',
          summary: `${wildcarded.length} powerful feature${wildcarded.length === 1 ? '' : 's'} ${wildcarded.length === 1 ? 'is' : 'are'} allowed for all origins via "*".`,
          explanation:
            'A wildcard allowlist lets any embedded frame request that feature in the context of your site. The visitor is still prompted, so this is an unnecessarily wide delegation rather than a direct exposure — and it may be intentional for an embedded widget that genuinely needs the capability.',
          recommendation:
            "Replace * with 'self' or an explicit origin list for each powerful feature you actually delegate.",
          affectedPages: [page.url],
          aggregationKey: 'wildcard-feature',
          occurrences: wildcarded.length,
          evidence: [{ label: 'Features allowed for *', value: wildcarded.join(', '), pageUrl: page.url }]
        })
      ];
    }

    return [
      passed(check, {
        summary: `A Permissions-Policy is sent, declaring ${features.size} feature${features.size === 1 ? '' : 's'}.`,
        explanation:
          'The policy constrains which browser features this document and its frames may use. Only the features it names are governed; anything unnamed falls back to the browser default.',
        affectedPages: [page.url],
        evidence: [
          { label: 'Declared features', value: [...features.keys()].slice(0, 12).join(', '), pageUrl: page.url }
        ]
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* Cross-origin isolation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * COOP, COEP, and CORP.
 *
 * Only COOP is treated as a general recommendation. COEP and CORP are reported
 * as observations: enabling them breaks legitimate cross-origin embedding, and
 * most sites have no reason to want full cross-origin isolation.
 */
export const crossOriginIsolationCheck = createHeaderCheck({
  id: 'cross-origin-isolation',
  name: 'Cross-origin isolation headers',
  description:
    'Reports Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy, and Cross-Origin-Resource-Policy.',
  severity: 'low',
  scoreWeight: 8,
  headers: [
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Embedder-Policy',
    'Cross-Origin-Resource-Policy'
  ],

  evaluate(check, page) {
    const findings: SecurityFinding[] = [];

    const coop = readHeader(page, 'cross-origin-opener-policy');
    const coep = readHeader(page, 'cross-origin-embedder-policy');
    const corp = readHeader(page, 'cross-origin-resource-policy');

    if (!coop) {
      findings.push(
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'No Cross-Origin-Opener-Policy header',
          summary: 'The response does not send Cross-Origin-Opener-Policy.',
          explanation:
            'Without COOP, a page this one opens — or a page that opened this one — keeps a usable window reference across origins. That reference enables cross-window attacks such as tabnabbing and frame counting. COOP severs the relationship so each document gets its own browsing context group.',
          recommendation:
            'Send Cross-Origin-Opener-Policy: same-origin. If you rely on window.postMessage with a popup you opened, use same-origin-allow-popups instead.',
          affectedPages: [page.url],
          aggregationKey: 'coop-missing'
        })
      );
    } else {
      const normalized = coop.trim().toLowerCase();
      findings.push(
        normalized === 'unsafe-none'
          ? createFinding(check, {
              status: 'info',
              observation: 'verified-observation',
              confidence: 'high',
              source: 'browser',
              title: 'Cross-Origin-Opener-Policy is explicitly disabled',
              summary: 'COOP is set to unsafe-none, which is the same as not setting it.',
              explanation:
                'unsafe-none is the default value and keeps cross-origin window references usable. Setting it explicitly is sometimes needed to override a policy inherited from a reverse proxy or a framework default.',
              recommendation:
                'If the explicit opt-out is not required, use same-origin or same-origin-allow-popups instead.',
              affectedPages: [page.url],
              aggregationKey: 'coop-unsafe-none',
              evidence: [{ label: 'Cross-Origin-Opener-Policy', value: coop, pageUrl: page.url }]
            })
          : passed(check, {
              summary: `Cross-Origin-Opener-Policy is set to ${normalized}.`,
              explanation:
                'Cross-origin documents cannot retain a usable window reference to this page, which removes a class of cross-window attack.',
              affectedPages: [page.url],
              aggregationKey: 'coop-pass',
              evidence: [{ label: 'Cross-Origin-Opener-Policy', value: coop, pageUrl: page.url }]
            })
      );
    }

    findings.push(
      createFinding(check, {
        status: 'info',
        observation: coep || corp ? 'verified-observation' : 'best-practice',
        confidence: 'high',
        source: 'browser',
        title: 'Cross-origin embedding posture',
        summary:
          coep || corp
            ? `Embedding headers observed: ${[coep ? `COEP: ${coep}` : null, corp ? `CORP: ${corp}` : null].filter(Boolean).join('; ')}.`
            : 'Neither Cross-Origin-Embedder-Policy nor Cross-Origin-Resource-Policy was sent.',
        explanation:
          'COEP and CORP control which cross-origin resources this document may load and who may load this document as a resource. Together with COOP they enable cross-origin isolation, which is required for SharedArrayBuffer and high-resolution timers. They also break legitimate third-party embeds, so most sites deliberately go without them — their absence is not a weakness.',
        recommendation:
          'Adopt Cross-Origin-Embedder-Policy: require-corp only if you need cross-origin isolation, and set Cross-Origin-Resource-Policy: same-origin on responses that should never be embedded by another site.',
        affectedPages: [page.url],
        aggregationKey: 'embedding-posture'
      })
    );

    return findings;
  }
});

/* -------------------------------------------------------------------------- */
/* Access-Control-Allow-Origin                                                */
/* -------------------------------------------------------------------------- */

export const corsPolicyCheck = createHeaderCheck({
  id: 'cors-allow-origin',
  name: 'CORS allow-origin policy',
  description:
    'Reports the Access-Control-Allow-Origin header sent with the document response.',
  severity: 'medium',
  scoreWeight: 10,
  headers: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],

  evaluate(check, page) {
    const acao = readHeader(page, 'access-control-allow-origin');
    const credentials = (readHeader(page, 'access-control-allow-credentials') ?? '')
      .trim()
      .toLowerCase() === 'true';

    if (!acao) {
      return [
        notApplicable(check, {
          reason:
            'This response sends no Access-Control-Allow-Origin header, so it is not readable cross-origin by script and there is no sharing policy to evaluate. Only the document response was examined; an API endpoint on the same site may have a different policy.',
          affectedPages: [page.url]
        })
      ];
    }

    const normalized = acao.trim();

    if (normalized === '*' && credentials) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'medium',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'Wildcard CORS origin combined with credentials',
          summary: 'The response sends Access-Control-Allow-Origin: * together with Access-Control-Allow-Credentials: true.',
          explanation:
            'Browsers reject this combination outright, so credentialed cross-origin reads do not actually succeed. It matters because it signals an intent to share credentialed responses with any origin — and a configuration that reflects the request origin instead of using "*" would make exactly that sharing work. The same configuration applied to an authenticated endpoint would expose private data to any site a visitor opens.',
          recommendation:
            'Decide which origins genuinely need credentialed access, echo only those exact origins, add Vary: Origin, and never pair a wildcard with Access-Control-Allow-Credentials.',
          affectedPages: [page.url],
          aggregationKey: 'wildcard-with-credentials',
          evidence: [
            { label: 'Access-Control-Allow-Origin', value: acao, pageUrl: page.url },
            { label: 'Access-Control-Allow-Credentials', value: 'true', pageUrl: page.url }
          ]
        })
      ];
    }

    if (normalized === '*') {
      return [
        createFinding(check, {
          status: 'info',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'browser',
          title: 'Response is readable by any origin',
          summary: 'The response sends Access-Control-Allow-Origin: *.',
          explanation:
            'Any site can read this response with script. For a public page that is intentional and harmless — it is how public APIs and CDN assets work. It would only be a problem if the response contained data specific to the visitor, and whether that is the case cannot be determined from the outside.',
          recommendation:
            'Confirm that no response served with a wildcard allow-origin contains per-user data. For anything personalized, echo specific origins instead.',
          affectedPages: [page.url],
          aggregationKey: 'wildcard',
          evidence: [{ label: 'Access-Control-Allow-Origin', value: acao, pageUrl: page.url }]
        })
      ];
    }

    if (normalized.toLowerCase() === 'null') {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'potential-concern',
          confidence: 'medium',
          source: 'browser',
          title: 'CORS policy allows the null origin',
          summary: 'Access-Control-Allow-Origin is set to "null".',
          explanation:
            'The null origin is sent by sandboxed iframes, documents loaded from a file:// URL, and some redirect chains — contexts an attacker can often create. Allowing it grants read access to a origin that cannot be attributed to anyone.',
          recommendation: 'Remove "null" from the allowed origins and echo only real, expected origins.',
          affectedPages: [page.url],
          aggregationKey: 'null-origin',
          evidence: [{ label: 'Access-Control-Allow-Origin', value: acao, pageUrl: page.url }]
        })
      ];
    }

    return [
      passed(check, {
        summary: 'The response shares itself with a specific origin rather than with any origin.',
        explanation:
          'Access-Control-Allow-Origin names a single origin, so cross-origin script reads are limited to it. Whether that origin should have access is a decision only you can confirm. If the value is echoed from the request, make sure Vary: Origin is also sent so a cache cannot serve one origin\'s response to another.',
        affectedPages: [page.url],
        evidence: [{ label: 'Access-Control-Allow-Origin', value: acao, pageUrl: page.url }]
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* Cache-Control on sensitive pages                                           */
/* -------------------------------------------------------------------------- */

export const sensitiveCacheControlCheck = createHeaderCheck({
  id: 'cache-control-sensitive',
  name: 'Caching of sensitive pages',
  description:
    'Checks whether pages carrying a credential or payment form prevent shared and stored caching.',
  severity: 'low',
  scoreWeight: 6,
  headers: ['Cache-Control'],

  evaluate(check, page) {
    const sensitiveForms = page.forms.filter(isSensitiveForm);

    if (sensitiveForms.length === 0) {
      return [
        notApplicable(check, {
          reason:
            'This page carries no credential or payment form, so it is not treated as a sensitive response for caching purposes.',
          affectedPages: [page.url]
        })
      ];
    }

    const cacheControl = readHeader(page, 'cache-control');

    if (!allowsSharedCaching(cacheControl)) {
      return [
        passed(check, {
          summary: 'The sensitive page declares a restrictive Cache-Control.',
          explanation:
            'The response marks itself as private or no-store, so a shared proxy or CDN will not retain it and serve it to another visitor.',
          affectedPages: [page.url],
          evidence: [{ label: 'Cache-Control', value: cacheControl as string, pageUrl: page.url }]
        })
      ];
    }

    return [
      createFinding(check, {
        status: 'warning',
        severity: 'low',
        observation: 'best-practice',
        confidence: 'medium',
        source: 'browser',
        title: 'Sensitive page is cacheable by a shared cache',
        summary: `A page containing a ${sensitiveForms.length === 1 ? 'credential or payment form' : 'credential or payment form'} does not declare no-store or private.`,
        explanation:
          'A CDN, a corporate proxy, or the browser\'s own disk cache may retain this response. Where the page is personalized, a cached copy can be served to a different visitor or recovered from a shared machine later. Whether this particular page is personalized cannot be determined from the outside, which is why this is a hardening recommendation.',
        recommendation:
          'Send Cache-Control: no-store on authenticated and credential-bearing responses, and Cache-Control: private, no-cache at minimum for anything personalized.',
        affectedPages: [page.url],
        aggregationKey: 'cacheable',
        evidence: [
          { label: 'Cache-Control', value: cacheControl ?? 'not sent', pageUrl: page.url },
          { label: 'Sensitive forms on page', value: String(sensitiveForms.length), pageUrl: page.url }
        ]
      })
    ];
  }
});

/* -------------------------------------------------------------------------- */
/* Server and framework headers                                               */
/* -------------------------------------------------------------------------- */

export const serverHeaderDisclosureCheck = createHeaderCheck({
  id: 'server-header-disclosure',
  name: 'Server and framework headers',
  description: 'Reports Server and X-Powered-By headers that name a product or version.',
  category: 'information-disclosure',
  severity: 'low',
  scoreWeight: 4,
  headers: ['Server', 'X-Powered-By'],

  evaluate(check, page) {
    const server = readHeader(page, 'server');
    const poweredBy = readHeader(page, 'x-powered-by');

    const present = [
      server ? { name: 'Server', value: server } : null,
      poweredBy ? { name: 'X-Powered-By', value: poweredBy } : null
    ].filter((entry): entry is { name: string; value: string } => entry !== null);

    if (present.length === 0) {
      return [
        passed(check, {
          summary: 'No Server or X-Powered-By header was sent.',
          explanation:
            'The response does not advertise the server product or application framework, so an attacker gets no free hint about which known issues might apply. Other responses on the site may still send these headers.',
          affectedPages: [page.url]
        })
      ];
    }

    const versioned = present.filter((entry) => revealsVersion(entry.value));

    if (versioned.length > 0) {
      return [
        createFinding(check, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'Response headers disclose a product version',
          summary: `${versioned.map((entry) => entry.name).join(' and ')} include${versioned.length === 1 ? 's' : ''} a version number.`,
          explanation:
            'A precise version tells an attacker exactly which published vulnerabilities to try, turning reconnaissance into a lookup. The version itself is not a vulnerability, and hiding it does not fix an unpatched component — it only removes a convenience.',
          recommendation:
            'Suppress the version in the Server header (for example server_tokens off in nginx) and remove X-Powered-By entirely. Keep patching on the same schedule either way.',
          affectedPages: [page.url],
          aggregationKey: 'version-disclosed',
          occurrences: versioned.length,
          evidence: versioned.map((entry) => ({
            label: entry.name,
            value: entry.value,
            pageUrl: page.url
          }))
        })
      ];
    }

    return [
      createFinding(check, {
        status: 'info',
        observation: 'verified-observation',
        confidence: 'high',
        source: 'browser',
        title: 'Response headers name the server product',
        summary: `${present.map((entry) => entry.name).join(' and ')} identify the software without a version.`,
        explanation:
          'The product name alone narrows an attacker\'s search only slightly, and many deployments cannot remove these headers. No version was disclosed.',
        recommendation:
          'Removing these headers is optional hardening. There is no action required if your platform sets them for you.',
        affectedPages: [page.url],
        aggregationKey: 'product-named',
        evidence: present.map((entry) => ({ label: entry.name, value: entry.value, pageUrl: page.url }))
      })
    ];
  }
});
