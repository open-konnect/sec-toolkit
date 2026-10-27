/**
 * Authentication surface inventory.
 *
 * No credential is ever submitted, no account is ever enumerated, and no
 * authentication is ever attempted. Everything here comes from the structure
 * of forms and from link paths, which means the inventory is a best effort:
 * a sign-in flow rendered entirely by script, or one living behind a route
 * this assessment did not visit, will not appear.
 *
 * An authentication surface is not a weakness. It is recorded because it tells
 * a reviewer which pages carry the highest consequence if anything else in
 * this report turns out to matter.
 */

import {
  AnalyzedPage,
  CheckContext,
  CheckOutcome,
  PageFormKind,
  SecurityCheck
} from '../../types';
import { FORM_KIND_LABELS } from '../analysis/forms';
import { createFinding, notApplicable } from '../findings';

/** Form kinds that indicate a credential flow. */
const AUTH_FORM_KINDS: ReadonlySet<PageFormKind> = new Set<PageFormKind>([
  'login',
  'registration',
  'password-reset'
]);

/**
 * Path markers for federated sign-in and second-factor flows.
 *
 * Matched against link paths only. A match says a route of that shape is
 * linked from the markup — not that the flow works, nor that it is configured
 * correctly.
 */
const FLOW_PATTERNS: readonly { id: string; label: string; pattern: RegExp }[] = [
  { id: 'oauth', label: 'OAuth or OpenID Connect route', pattern: /\/(?:oauth2?|openid|connect\/authorize|authorize)\b/i },
  { id: 'federated', label: 'federated identity provider route', pattern: /\/(?:auth|login)\/(?:google|github|facebook|apple|microsoft|okta|azure|saml|sso)\b/i },
  { id: 'saml', label: 'SAML route', pattern: /\/(?:saml|sso)\b/i },
  { id: 'mfa', label: 'multi-factor or one-time-code route', pattern: /\/(?:mfa|2fa|two-factor|otp|verify-(?:code|otp)|challenge)\b/i },
  { id: 'logout', label: 'sign-out route', pattern: /\/(?:logout|signout|sign-out|log-out)\b/i },
  { id: 'account', label: 'account or profile route', pattern: /\/(?:account|profile|settings\/security)\b/i }
];

interface Surface {
  /** Form kind to the pages it was seen on. */
  forms: Map<PageFormKind, Set<string>>;
  passwordFieldPages: Set<string>;
  /** Flow id to the pages linking to it. */
  flows: Map<string, Set<string>>;
}

function collectSurface(pages: readonly AnalyzedPage[]): Surface {
  const forms = new Map<PageFormKind, Set<string>>();
  const passwordFieldPages = new Set<string>();
  const flows = new Map<string, Set<string>>();

  const note = (map: Map<string, Set<string>>, key: string, url: string): void => {
    const bucket = map.get(key) ?? new Set<string>();
    bucket.add(url);
    map.set(key, bucket);
  };

  for (const page of pages) {
    for (const form of page.forms) {
      if (form.hasPasswordField) passwordFieldPages.add(page.url);
      if (!AUTH_FORM_KINDS.has(form.kind)) continue;
      const bucket = forms.get(form.kind) ?? new Set<string>();
      bucket.add(page.url);
      forms.set(form.kind, bucket);
    }

    for (const link of page.links) {
      if (!link.isNavigable) continue;
      // Compare the path only. A query string can carry a token or a
      // redirect target, and neither belongs in this report.
      let path: string;
      try {
        path = new URL(link.url).pathname;
      } catch {
        continue;
      }
      for (const flow of FLOW_PATTERNS) {
        if (flow.pattern.test(path)) note(flows, flow.id, page.url);
      }
    }
  }

  return { forms, passwordFieldPages, flows };
}

export const authenticationSurfaceCheck: SecurityCheck = {
  id: 'authentication-surface',
  category: 'authentication-surface',
  name: 'Authentication surface',
  description:
    'Inventories sign-in, registration, password reset, federated identity, and second-factor routes visible in markup.',
  severity: 'informational',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const surface = collectSurface(context.pages);
    const allPages = context.pages.map((page) => page.url);

    if (surface.forms.size === 0 && surface.flows.size === 0 && surface.passwordFieldPages.size === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No sign-in, registration, password reset, or federated identity surface was visible in the markup analyzed. A flow rendered by script, or one on a page this assessment did not reach, would not appear here. No authentication was attempted.',
            affectedPages: allPages
          })
        ]
      };
    }

    const formKinds = [...surface.forms.keys()];
    const flowIds = [...surface.flows.keys()];
    const flowLabels = FLOW_PATTERNS.filter((flow) => surface.flows.has(flow.id)).map(
      (flow) => flow.label
    );
    const affected = new Set<string>();
    for (const urls of surface.forms.values()) for (const url of urls) affected.add(url);
    for (const url of surface.passwordFieldPages) affected.add(url);
    for (const urls of surface.flows.values()) for (const url of urls) affected.add(url);

    const described = [
      ...formKinds.map((kind) => FORM_KIND_LABELS[kind]),
      ...(surface.passwordFieldPages.size > 0 && formKinds.length === 0 ? ['form with a password field'] : [])
    ];

    const hasMfaRoute = surface.flows.has('mfa');

    return {
      findings: [
        createFinding(this, {
          status: 'info',
          observation: 'verified-observation',
          confidence: 'medium',
          source: 'html',
          title: 'Authentication surface identified',
          summary: `${described.length > 0 ? described.join(', ') : 'Authentication routes'} found across ${affected.size} page${affected.size === 1 ? '' : 's'}${flowLabels.length > 0 ? `, plus ${flowLabels.length} identity-related route shape${flowLabels.length === 1 ? '' : 's'}` : ''}.`,
          explanation:
            `These are the pages where a credential is handled, which makes them the pages where transport, framing, and script findings elsewhere in this report matter most. ${hasMfaRoute ? 'A route whose path suggests a second factor is linked, which is a positive signal but not a verification that multi-factor authentication is enforced.' : 'No route whose path suggests a second factor was linked from the markup analyzed, which does not mean multi-factor authentication is absent — it may be presented only after a successful password step, which this assessment never performs.'} Nothing here was exercised: no credential was submitted and no account was probed.`,
          recommendation:
            'Confirm every credential form posts over HTTPS to your own origin, that session cookies are HttpOnly, Secure, and SameSite, that rate limiting and lockout apply to sign-in and reset, and that a second factor is available. Review these specific pages against the transport and framing findings in this report first.',
          affectedPages: [...affected],
          aggregationKey: 'inventory',
          occurrences: affected.size,
          evidence: [
            ...formKinds.map((kind) => ({
              label: FORM_KIND_LABELS[kind],
              value: `${surface.forms.get(kind)?.size ?? 0} page(s)`
            })),
            ...(surface.passwordFieldPages.size > 0
              ? [
                  {
                    label: 'Pages with a password field',
                    value: String(surface.passwordFieldPages.size)
                  }
                ]
              : []),
            ...(flowIds.length > 0 ? [{ label: 'Route shapes linked', value: flowLabels.join(', ') }] : [])
          ]
        })
      ]
    };
  }
};
