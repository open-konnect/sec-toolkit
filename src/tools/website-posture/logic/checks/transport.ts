/**
 * Transport-security checks: `https-available` and `mixed-content`.
 */

import { CheckContext, CheckOutcome, SecurityCheck, SecurityFinding } from '../../types';
import {
  createFinding,
  notApplicable,
  passed,
  sanitizeUrlForEvidence,
  unableToVerify
} from '../findings';
import { isActiveResource } from '../resource';

/**
 * Whether the assessed URL is served over HTTPS.
 *
 * Declares no capability requirement: the answer comes from the target URL
 * itself, so this check still produces a verdict when every page read is
 * blocked by CORS. That is what keeps an otherwise fully blocked assessment
 * from having zero coverage.
 */
export const httpsAvailableCheck: SecurityCheck = {
  id: 'https-available',
  category: 'transport',
  name: 'HTTPS transport',
  description: 'Confirms the assessed URL is served over HTTPS rather than plaintext HTTP.',
  severity: 'high',
  scoreWeight: 25,
  modes: ['browser-passive'],

  execute(context: CheckContext): CheckOutcome {
    const { target } = context;

    if (target.protocol === 'https:') {
      return {
        findings: [
          passed(this, {
            summary: 'The assessed URL is served over HTTPS.',
            explanation:
              'Traffic to this URL is encrypted and authenticated in transit, which prevents passive interception and on-path tampering. Whether the site also redirects plaintext HTTP requests, and whether it sends Strict-Transport-Security, could not be checked from the browser and is reported separately.',
            affectedPages: [target.url],
            evidence: [{ label: 'Scheme', value: 'https:' }]
          })
        ]
      };
    }

    if (target.protocol === 'http:' && target.isLoopback) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'The target is a loopback address. Browsers already treat loopback origins as secure contexts, so plaintext HTTP here is not a transport weakness.',
            affectedPages: [target.url]
          })
        ]
      };
    }

    if (target.protocol === 'http:') {
      return {
        findings: [
          createFinding(this, {
            status: 'fail',
            severity: 'high',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'browser',
            title: 'Assessed over plaintext HTTP',
            summary: 'The assessed URL uses http:// rather than https://.',
            explanation:
              'Plaintext HTTP is readable and modifiable by anyone on the network path, which means any credential, session cookie, or page content sent over it can be captured or altered. The page is also not a secure context, so browser features that require one are unavailable.',
            recommendation:
              'Serve the site over HTTPS with a valid certificate, redirect HTTP requests to HTTPS, and then add a Strict-Transport-Security response header. Whether such a redirect already exists could not be verified from the browser.',
            affectedPages: [target.url],
            evidence: [{ label: 'Scheme', value: 'http:' }]
          })
        ]
      };
    }

    return {
      findings: [
        notApplicable(this, {
          reason: `The target uses the "${target.protocol}" scheme, which this check does not evaluate.`,
          affectedPages: [target.url]
        })
      ]
    };
  }
};

/**
 * Insecure subresources on an HTTPS page.
 *
 * Active mixed content (script, stylesheet, iframe, object, embed) is reported
 * separately from passive mixed content (images, media, fonts), because
 * browsers block the former outright and the security impact is far higher.
 */
export const mixedContentCheck: SecurityCheck = {
  id: 'mixed-content',
  category: 'transport',
  name: 'Mixed content',
  description:
    'Finds subresources referenced over plaintext HTTP from a page served over HTTPS.',
  severity: 'high',
  scoreWeight: 25,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    const securePages = context.pages.filter((page) => page.protocol === 'https:');

    if (securePages.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No page served over HTTPS was analyzed. Mixed content only exists on a secure page, so there is nothing for this check to evaluate.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    for (const page of securePages) {
      const insecure = page.resources.filter((resource) => resource.protocol === 'http:');

      if (insecure.length === 0) {
        findings.push(
          passed(this, {
            summary: 'Every subresource on this page is referenced over HTTPS.',
            explanation:
              'No subresource on this page is loaded over plaintext HTTP, so the page does not downgrade any part of its own transport security. Only resources declared in the HTML were examined; resources injected later by scripts were not.',
            affectedPages: [page.url]
          })
        );
        continue;
      }

      const active = insecure.filter(isActiveResource);
      const passive = insecure.filter((resource) => !isActiveResource(resource));

      if (active.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'fail',
            severity: 'high',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Active mixed content',
            summary: `${active.length} executable or style subresource${active.length === 1 ? '' : 's'} on an HTTPS page ${active.length === 1 ? 'is' : 'are'} referenced over plaintext HTTP.`,
            explanation:
              'A script, stylesheet, iframe, object, or embed loaded over HTTP can be replaced by anyone on the network path, giving them code execution in the context of the secure page. Modern browsers block these requests outright, so the affected functionality is also likely broken.',
            recommendation:
              'Change each reference to https:// — or to a protocol-relative or root-relative path — and confirm the origin serving it supports HTTPS.',
            affectedPages: [page.url],
            aggregationKey: 'active',
            affectedResources: active.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: active.length,
            evidence: active.slice(0, 3).map((resource) => ({
              label: `${resource.element}[${resource.attribute}]`,
              value: sanitizeUrlForEvidence(resource.url ?? resource.rawUrl),
              pageUrl: page.url
            }))
          })
        );
      }

      if (passive.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'html',
            title: 'Passive mixed content',
            summary: `${passive.length} image, media, or font reference${passive.length === 1 ? '' : 's'} on an HTTPS page use${passive.length === 1 ? 's' : ''} plaintext HTTP.`,
            explanation:
              'Passive mixed content does not grant code execution, but it is still interceptable and modifiable in transit, it leaks which assets a visitor loads, and browsers downgrade the page security indicator or block the request entirely.',
            recommendation: 'Update each reference to https:// and verify the asset is available over TLS.',
            affectedPages: [page.url],
            aggregationKey: 'passive',
            affectedResources: passive.map((resource) => resource.url ?? resource.rawUrl),
            occurrences: passive.length,
            evidence: passive.slice(0, 3).map((resource) => ({
              label: `${resource.element}[${resource.attribute}]`,
              value: sanitizeUrlForEvidence(resource.url ?? resource.rawUrl),
              pageUrl: page.url
            }))
          })
        );
      }
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* HTTP to HTTPS upgrade                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whether a plaintext request was upgraded to HTTPS.
 *
 * This is deliberately narrow about what it can know. The engine issues one
 * request for the entry URL and uses the post-redirect URL as the page URL, so
 * when the target was typed as `http://` and the page came back as `https://`,
 * an upgrade was genuinely observed. The reverse case is *not* observable: for
 * an `https://` target the engine never issues a plaintext request — a second
 * request to a different scheme is not something a passive assessment should
 * manufacture, and a browser on an HTTPS page would block it as mixed content
 * anyway. So the answer there is `unable-to-verify`, which is the honest one.
 */
export const httpUpgradeCheck: SecurityCheck = {
  id: 'http-to-https-upgrade',
  category: 'transport',
  name: 'HTTP to HTTPS upgrade',
  description:
    'Reports whether a plaintext request for the target was redirected to HTTPS, where that was observable.',
  severity: 'medium',
  scoreWeight: 10,
  modes: ['browser-passive'],

  execute(context: CheckContext): CheckOutcome {
    const { target, primaryPage } = context;

    if (target.protocol === 'http:' && target.isLoopback) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'The target is a loopback address, which browsers already treat as a secure context. An upgrade to HTTPS is not expected there.',
            affectedPages: [target.url]
          })
        ]
      };
    }

    if (target.protocol === 'http:') {
      if (!primaryPage) {
        return {
          findings: [
            unableToVerify(this, {
              reason:
                'The plaintext request for the target could not be read, so whether it redirects to HTTPS could not be determined.',
              recommendation: `Run \`curl -sI ${target.url}\` and look for a 301 or 308 to an https:// location.`,
              affectedPages: [target.url]
            })
          ]
        };
      }

      if (primaryPage.protocol === 'https:') {
        return {
          findings: [
            passed(this, {
              summary: 'A plaintext request for the target was redirected to HTTPS.',
              explanation:
                'The request was made to http:// and the page that came back was served from https://, so the site upgrades plaintext requests. The redirect itself still travels in the clear, which is why Strict-Transport-Security matters as well: it removes the plaintext request from the second visit onwards. The status codes in the redirect chain were not inspected.',
              affectedPages: [primaryPage.url],
              evidence: [
                { label: 'Requested', value: target.url },
                { label: 'Served from', value: primaryPage.origin }
              ]
            })
          ]
        };
      }

      return {
        findings: [
          createFinding(this, {
            status: 'fail',
            severity: 'medium',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'browser',
            title: 'Plaintext request was not upgraded to HTTPS',
            summary: 'A request to the http:// target returned a page still served over http://.',
            explanation:
              'Nothing redirected the plaintext request, so a visitor who types the hostname or follows an old link stays on an unencrypted connection for the whole session. Everything in it — page content, cookies, anything submitted — is readable and modifiable on the network path.',
            recommendation:
              'Redirect every HTTP request to the same path on HTTPS with a 301 or 308, then add Strict-Transport-Security so later visits never make the plaintext request at all.',
            affectedPages: [primaryPage.url],
            aggregationKey: 'no-upgrade',
            evidence: [
              { label: 'Requested', value: target.url },
              { label: 'Served from', value: primaryPage.origin }
            ]
          })
        ]
      };
    }

    if (target.protocol === 'https:') {
      return {
        findings: [
          unableToVerify(this, {
            reason:
              'The target was assessed over HTTPS, and this assessment does not issue a second request over plaintext HTTP to find out what would happen — a browser on a secure page blocks such a request as mixed content, and manufacturing one is outside what a passive assessment does. Whether http:// requests are redirected therefore could not be determined, and no conclusion either way should be drawn from this.',
            recommendation: `Run \`curl -sI http://${new URL(target.url).host}\` yourself and confirm it answers with a 301 or 308 to the https:// equivalent.`,
            affectedPages: [target.url],
            aggregationKey: 'https-target'
          })
        ]
      };
    }

    return {
      findings: [
        notApplicable(this, {
          reason: `The target uses the "${target.protocol}" scheme, so an HTTP-to-HTTPS upgrade does not apply.`,
          affectedPages: [target.url]
        })
      ]
    };
  }
};
