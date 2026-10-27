/**
 * Form security checks.
 *
 * Forms are read structurally only. Field *values* are never captured by the
 * scanner, no form is ever submitted, and no action URL is ever requested.
 * What a form is *for* is inferred from field types, markup identifiers, and
 * the action path — never from anything a visitor would type into it.
 */

import { AnalyzedPage, CheckContext, CheckOutcome, PageForm, SecurityCheck, SecurityFinding } from '../../types';
import { FORM_KIND_LABELS, describeForm, isSensitiveForm } from '../analysis/forms';
import { createFinding, notApplicable, passed, sanitizeUrlForEvidence } from '../findings';
import { isLoopbackHost, parseUrl } from '../url';

/** Loopback submission targets are secure contexts and are not flagged. */
function isLoopbackAction(action: string | null): boolean {
  if (!action) return false;
  const parsed = parseUrl(action);
  return parsed ? isLoopbackHost(parsed.hostname) : false;
}

/**
 * Password fields whose submission or hosting page is plaintext HTTP.
 *
 * Two distinct cases are reported:
 *
 * - The action itself is `http://` — the credential travels in cleartext.
 * - The action is HTTPS but the page is HTTP — the credential is encrypted,
 *   but an on-path attacker can rewrite the form before it is submitted, so
 *   the HTTPS action provides much weaker protection than it appears to.
 */
export const passwordFormHttpCheck: SecurityCheck = {
  id: 'password-form-http',
  category: 'forms-and-input',
  name: 'Password form transport',
  description:
    'Finds password fields that submit over plaintext HTTP or sit on a page delivered over plaintext HTTP.',
  severity: 'critical',
  scoreWeight: 40,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let passwordFormsSeen = 0;

    for (const page of context.pages) {
      const passwordForms = page.forms.filter((form) => form.hasPasswordField);
      if (passwordForms.length === 0) continue;

      passwordFormsSeen += passwordForms.length;

      const insecureAction = passwordForms.filter(
        (form) => form.actionProtocol === 'http:' && !isLoopbackAction(form.action)
      );

      const securePageInsecureContext = passwordForms.filter(
        (form) =>
          form.actionProtocol === 'https:' && page.protocol === 'http:' && !isLoopbackAction(page.url)
      );

      if (insecureAction.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'fail',
            severity: 'critical',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Password submitted over plaintext HTTP',
            summary: `${insecureAction.length} password ${insecureAction.length === 1 ? 'form submits' : 'forms submit'} to an http:// endpoint.`,
            explanation:
              'The credential is sent without encryption, so anyone on the network path — a shared network, a compromised router, a transparent proxy — can read it directly. Browsers also warn the visitor that the login is not secure.',
            recommendation:
              'Serve the page over HTTPS and point the form action at an https:// endpoint on the same origin. Treat any credential already submitted this way as exposed and rotate it.',
            affectedPages: [page.url],
            aggregationKey: 'http-action',
            occurrences: insecureAction.length,
            evidence: insecureAction.slice(0, 3).map((form) => ({
              label: `${form.method.toUpperCase()} action`,
              value: sanitizeUrlForEvidence(form.action),
              pageUrl: page.url
            }))
          })
        );
      }

      if (securePageInsecureContext.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'fail',
            severity: 'high',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Password form hosted on a plaintext HTTP page',
            summary: `${securePageInsecureContext.length} password ${securePageInsecureContext.length === 1 ? 'form posts' : 'forms post'} to HTTPS from a page delivered over HTTP.`,
            explanation:
              'An HTTPS action does not protect a credential entered on an HTTP page: the page itself arrived unauthenticated, so an on-path attacker can rewrite the form action or inject a script that reads the field before it is ever submitted.',
            recommendation:
              'Serve the page containing the password field over HTTPS as well, and redirect HTTP requests for it to HTTPS.',
            affectedPages: [page.url],
            aggregationKey: 'http-page',
            occurrences: securePageInsecureContext.length,
            evidence: [
              { label: 'Page scheme', value: 'http:', pageUrl: page.url },
              {
                label: 'Password forms on this page',
                value: String(securePageInsecureContext.length),
                pageUrl: page.url
              }
            ]
          })
        );
      }

      const secureForms = passwordForms.filter(
        (form) =>
          (form.actionProtocol === 'https:' && page.protocol === 'https:') ||
          isLoopbackAction(form.action) ||
          isLoopbackAction(page.url)
      );

      if (secureForms.length === passwordForms.length) {
        findings.push(
          passed(this, {
            summary: `${secureForms.length} password ${secureForms.length === 1 ? 'form submits' : 'forms submit'} over an encrypted transport.`,
            explanation:
              'Every password field on this page sits on a secure page and submits to a secure endpoint, so the credential is encrypted in transit and the form itself was delivered authentically.',
            affectedPages: [page.url],
            evidence: secureForms.slice(0, 3).map((form) => ({
              label: `${form.method.toUpperCase()} action`,
              value: sanitizeUrlForEvidence(form.action),
              pageUrl: page.url
            }))
          })
        );
      }
    }

    if (passwordFormsSeen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No password field was found in the markup of the pages analyzed. A login form on a page that was not reached, or one rendered later by script, would not appear here.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Sensitive forms without a password field                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sensitive forms that `password-form-http` does not already cover.
 *
 * A payment form, or a sign-in flow that posts an emailed code rather than a
 * password, carries data that deserves the same transport guarantees as a
 * credential. Password forms are deliberately excluded so the two checks never
 * put two cards about the same form in front of the user.
 */
function sensitiveNonPasswordForms(page: AnalyzedPage): PageForm[] {
  return page.forms.filter((form) => isSensitiveForm(form) && !form.hasPasswordField);
}

export const sensitiveFormTransportCheck: SecurityCheck = {
  id: 'sensitive-form-transport',
  category: 'forms-and-input',
  name: 'Sensitive form transport',
  description:
    'Finds payment and identity forms, other than password forms, that submit over plaintext HTTP.',
  severity: 'high',
  scoreWeight: 20,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let seen = 0;

    for (const page of context.pages) {
      const forms = sensitiveNonPasswordForms(page);
      if (forms.length === 0) continue;
      seen += forms.length;

      const insecureAction = forms.filter(
        (form) => form.actionProtocol === 'http:' && !isLoopbackAction(form.action)
      );
      const insecurePage = forms.filter(
        (form) =>
          form.actionProtocol !== 'http:' &&
          page.protocol === 'http:' &&
          !isLoopbackAction(page.url)
      );

      if (insecureAction.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'fail',
            severity: 'high',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Sensitive form submits over plaintext HTTP',
            summary: `${insecureAction.length} ${insecureAction.length === 1 ? 'form' : 'forms'} carrying payment or identity data ${insecureAction.length === 1 ? 'submits' : 'submit'} to an http:// endpoint.`,
            explanation:
              'Everything the visitor enters travels unencrypted and can be read or altered by anyone on the network path. No field value was read to reach this conclusion — the form was classified from its field types and markup identifiers, so confirm the classification is right before acting on the severity.',
            recommendation:
              'Point the action at an https:// endpoint on your own origin and serve the containing page over HTTPS.',
            affectedPages: [page.url],
            aggregationKey: 'http-action',
            occurrences: insecureAction.length,
            evidence: insecureAction.slice(0, 3).map((form) => ({
              label: describeForm(form),
              value: sanitizeUrlForEvidence(form.action),
              pageUrl: page.url
            }))
          })
        );
      }

      if (insecurePage.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'fail',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Sensitive form hosted on a plaintext HTTP page',
            summary: `${insecurePage.length} sensitive ${insecurePage.length === 1 ? 'form sits' : 'forms sit'} on a page delivered over HTTP.`,
            explanation:
              'The page arrived unauthenticated, so an on-path attacker can rewrite the action or inject script that reads the fields before submission. A secure action does not repair an insecure page.',
            recommendation: 'Serve the page over HTTPS and redirect HTTP requests for it.',
            affectedPages: [page.url],
            aggregationKey: 'http-page',
            occurrences: insecurePage.length
          })
        );
      }
    }

    if (seen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No payment or identity form other than a password form was found in the markup analyzed. Password forms are assessed separately.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    if (findings.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: `${seen} sensitive ${seen === 1 ? 'form submits' : 'forms submit'} over an encrypted transport.`,
            explanation:
              'Every payment or identity form found sits on a secure page and submits to a secure endpoint. Where the form posts to another origin, that is reported separately.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Cross-origin submission                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sensitive forms that post to a different origin.
 *
 * Often entirely legitimate — a hosted payment page, a federated sign-in, a
 * marketing platform. The point is that the receiving origin is outside your
 * control while the form around it is inside it, so this is reported as
 * something to confirm rather than as a defect.
 */
export const crossOriginFormActionCheck: SecurityCheck = {
  id: 'sensitive-form-cross-origin-action',
  category: 'forms-and-input',
  name: 'Cross-origin form submission',
  description: 'Reports sensitive forms whose action posts to a different origin.',
  severity: 'medium',
  scoreWeight: 10,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let sensitiveSeen = 0;

    for (const page of context.pages) {
      const sensitive = page.forms.filter(isSensitiveForm);
      sensitiveSeen += sensitive.length;

      const crossOrigin = sensitive.filter((form) => form.actionIsCrossOrigin);
      if (crossOrigin.length === 0) continue;

      const insecure = crossOrigin.filter((form) => form.actionProtocol === 'http:');

      findings.push(
        createFinding(this, {
          status: 'warning',
          severity: insecure.length > 0 ? 'high' : 'low',
          observation: insecure.length > 0 ? 'verified-observation' : 'potential-concern',
          confidence: 'high',
          source: 'html',
          title: 'Sensitive form posts to a different origin',
          summary: `${crossOrigin.length} sensitive ${crossOrigin.length === 1 ? 'form posts' : 'forms post'} to an external origin${insecure.length > 0 ? `, ${insecure.length} of ${insecure.length === 1 ? 'them' : 'which'} over plaintext HTTP` : ''}.`,
          explanation:
            'The data goes to an origin you do not control, and the receiving party sees every field the visitor filled in. For a hosted payment page or a federated sign-in that is exactly the intended design. It is reported because a cross-origin action is also what a form-hijacking injection looks like, and because the destination inherits your visitors\' trust without appearing in your own security review.',
          recommendation:
            'Confirm each destination is a provider you intended to use, pin it in a CSP form-action directive so an injected form cannot post elsewhere, and prefer a provider-hosted iframe or redirect over posting your own fields to a third party.',
          affectedPages: [page.url],
          aggregationKey: insecure.length > 0 ? 'cross-origin-http' : 'cross-origin',
          occurrences: crossOrigin.length,
          evidence: crossOrigin.slice(0, 3).map((form) => ({
            label: describeForm(form),
            value: sanitizeUrlForEvidence(form.action),
            pageUrl: page.url
          }))
        })
      );
    }

    if (sensitiveSeen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No form carrying credentials, identity, or payment data was found in the markup analyzed, so there is no sensitive submission destination to assess.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    if (findings.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: `${sensitiveSeen} sensitive ${sensitiveSeen === 1 ? 'form submits' : 'forms submit'} to this site's own origin.`,
            explanation:
              'No credential, identity, or payment form posts its fields to an origin outside this site, so no third party receives them directly.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Structural form observations                                               */
/* -------------------------------------------------------------------------- */

/** True when a form opens its response in a new or foreign browsing context. */
function hasUnusualTarget(form: PageForm): boolean {
  if (!form.target) return false;
  return form.target !== '_self';
}

export const formObservationsCheck: SecurityCheck = {
  id: 'form-observations',
  category: 'forms-and-input',
  name: 'Form configuration observations',
  description:
    'Notes autocomplete declarations and unusual submission targets on sensitive forms, without reading any field value.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let formsSeen = 0;

    for (const page of context.pages) {
      const sensitive = page.forms.filter(isSensitiveForm);
      if (sensitive.length === 0) continue;
      formsSeen += sensitive.length;

      // autocomplete="off" on a credential form is the pattern worth naming:
      // it was once advice, and current guidance is the opposite, because it
      // pushes people towards weaker passwords they can retype.
      const suppressed = sensitive.filter(
        (form) =>
          (form.autocomplete ?? '').toLowerCase() === 'off' ||
          form.fieldAutocomplete.some((token) => token === 'off')
      );

      const unusualTarget = sensitive.filter(hasUnusualTarget);

      const getMethod = sensitive.filter((form) => form.method === 'get');

      if (suppressed.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'info',
            observation: 'best-practice',
            confidence: 'high',
            source: 'html',
            title: 'Sensitive form disables autocomplete',
            summary: `${suppressed.length} sensitive ${suppressed.length === 1 ? 'form declares' : 'forms declare'} autocomplete="off".`,
            explanation:
              'Browsers largely ignore autocomplete="off" on credential fields now, so this rarely has the effect it was added for. Where it does take effect it works against security rather than for it: a visitor who cannot use a password manager picks a password they can type from memory. It is worth a look rather than a fix in itself.',
            recommendation:
              'Replace autocomplete="off" with the specific tokens — current-password, new-password, one-time-code, cc-number — so password managers and the browser fill the right field. Keep it only on a field that genuinely must never be stored, such as a one-time code typed on a shared device.',
            affectedPages: [page.url],
            aggregationKey: 'autocomplete-off',
            occurrences: suppressed.length,
            evidence: suppressed.slice(0, 3).map((form) => ({
              label: FORM_KIND_LABELS[form.kind],
              value: form.autocomplete ?? form.fieldAutocomplete.join(' '),
              pageUrl: page.url
            }))
          })
        );
      }

      if (unusualTarget.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'potential-concern',
            confidence: 'medium',
            source: 'html',
            title: 'Sensitive form submits into another browsing context',
            summary: `${unusualTarget.length} sensitive ${unusualTarget.length === 1 ? 'form targets' : 'forms target'} a context other than the current one.`,
            explanation:
              'A form target sends the response — and therefore whatever the server sets along with it — into a different window or frame. For a credential or payment flow that is unusual, and a target naming a frame means the response renders inside a document that may not be yours. This is an observation; a deliberate popup checkout is a legitimate reason for it.',
            recommendation:
              'Submit sensitive forms into the current context. If a separate window is genuinely required, confirm the receiving context is same-origin and that nothing in the response leaks into a third-party frame.',
            affectedPages: [page.url],
            aggregationKey: 'unusual-target',
            occurrences: unusualTarget.length,
            evidence: unusualTarget.slice(0, 3).map((form) => ({
              label: `${FORM_KIND_LABELS[form.kind]} target`,
              value: form.target ?? '',
              pageUrl: page.url
            }))
          })
        );
      }

      if (getMethod.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Sensitive form submits with GET',
            summary: `${getMethod.length} sensitive ${getMethod.length === 1 ? 'form uses' : 'forms use'} the GET method.`,
            explanation:
              'A GET submission puts every field into the URL, where it lands in browser history, in server and proxy access logs, and in the Referer header sent to the next site the visitor visits. For a credential, a card number, or an identity document that is a durable leak rather than a transient one.',
            recommendation:
              'Use POST for any form carrying credentials, payment, or personal data, and never place such a value in a query string.',
            affectedPages: [page.url],
            aggregationKey: 'get-method',
            occurrences: getMethod.length,
            evidence: getMethod.slice(0, 3).map((form) => ({
              label: FORM_KIND_LABELS[form.kind],
              value: sanitizeUrlForEvidence(form.action),
              pageUrl: page.url
            }))
          })
        );
      }
    }

    if (formsSeen === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No form carrying credentials, identity, or payment data was found in the markup analyzed, so there is no form configuration to report on.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    if (findings.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: `${formsSeen} sensitive ${formsSeen === 1 ? 'form is' : 'forms are'} configured conventionally.`,
            explanation:
              'Each sensitive form submits with POST into the current browsing context and does not disable autocomplete. No field value was read in reaching this conclusion.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};
