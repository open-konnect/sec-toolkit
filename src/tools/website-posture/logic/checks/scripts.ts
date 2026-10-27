/**
 * Script and DOM-hygiene checks.
 *
 * Every check in this file reports an **indicator**. The engine can see that a
 * page's inline script mentions `innerHTML` or `postMessage`; it cannot see
 * whether the value flowing into that call is attacker-controlled, and it
 * never executes the script to find out. So nothing here is phrased as a
 * confirmed injection, an XSS, or a vulnerability — the honest claim is
 * "dangerous DOM API usage detected; manual review recommended".
 *
 * Only *inline* script is analyzed. External script bodies are never
 * downloaded, so a page that keeps its logic in bundles will show few
 * indicators — which is a limit of the method, not a sign of safety.
 */

import { AnalyzedPage, CheckContext, CheckOutcome, SecurityCheck, SecurityFinding } from '../../types';
import {
  DANGEROUS_DOM_PATTERNS,
  DYNAMIC_SCRIPT_PATTERNS,
  findIndicator,
  hasIndicator
} from '../analysis/indicators';
import { createFinding, notApplicable, passed } from '../findings';

/** Catalogue ids, so a check and its catalogue cannot drift apart. */
const DANGEROUS_IDS = new Set(DANGEROUS_DOM_PATTERNS.map((entry) => entry.id));
const DYNAMIC_IDS = new Set(DYNAMIC_SCRIPT_PATTERNS.map((entry) => entry.id));

/** Formats indicators for evidence: label and count only, never matched text. */
function indicatorEvidence(page: AnalyzedPage, ids: ReadonlySet<string>) {
  return page.scriptIndicators
    .filter((indicator) => ids.has(indicator.id))
    .slice(0, 5)
    .map((indicator) => ({
      label: indicator.label,
      value: `${indicator.occurrences} occurrence${indicator.occurrences === 1 ? '' : 's'} in inline script`,
      pageUrl: page.url
    }));
}

/** True when any page in the run had inline script to analyze. */
function anyInlineScript(pages: readonly AnalyzedPage[]): boolean {
  return pages.some((page) => page.inlineScriptCount > 0);
}

/* -------------------------------------------------------------------------- */
/* Dangerous DOM APIs                                                         */
/* -------------------------------------------------------------------------- */

export const dangerousDomApiCheck: SecurityCheck = {
  id: 'dangerous-dom-api-usage',
  category: 'script-security',
  name: 'Dangerous DOM API usage',
  description:
    'Reports inline script that builds markup or code from strings, such as innerHTML, document.write, eval, or new Function.',
  severity: 'low',
  scoreWeight: 8,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];

    for (const page of context.pages) {
      const matched = page.scriptIndicators.filter((indicator) => DANGEROUS_IDS.has(indicator.id));

      if (matched.length === 0) continue;

      // eval and new Function turn a string into executable code; the HTML
      // sinks turn a string into markup. Both deserve review, but the code
      // sinks are the stronger signal, so they are reported separately.
      const codeSinks = matched.filter(
        (indicator) =>
          indicator.id === 'eval' ||
          indicator.id === 'new-function' ||
          indicator.id === 'timer-string-argument'
      );
      const markupSinks = matched.filter((indicator) => !codeSinks.includes(indicator));

      if (codeSinks.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'potential-concern',
            confidence: 'low',
            source: 'html',
            title: 'Inline script evaluates strings as code',
            summary: `Inline script uses ${codeSinks.map((indicator) => indicator.label).join(', ')}. Manual review recommended.`,
            explanation:
              'These APIs compile a string into running code. That is only a vulnerability if the string can be influenced by an attacker — through a URL parameter, a stored value, a postMessage payload — and that cannot be determined by reading the markup. This is a pointer for a human reviewer, not a detected flaw.',
            recommendation:
              'Trace what flows into each call. Replace eval and new Function with a parser, a lookup table, or JSON.parse where possible, and pass a function rather than a string to setTimeout and setInterval.',
            affectedPages: [page.url],
            aggregationKey: 'code-evaluation',
            occurrences: codeSinks.reduce((total, indicator) => total + indicator.occurrences, 0),
            evidence: indicatorEvidence(page, new Set(codeSinks.map((indicator) => indicator.id)))
          })
        );
      }

      if (markupSinks.length > 0) {
        findings.push(
          createFinding(this, {
            status: 'info',
            observation: 'potential-concern',
            confidence: 'low',
            source: 'html',
            title: 'Inline script writes markup from strings',
            summary: `Inline script uses ${markupSinks.map((indicator) => indicator.label).join(', ')}. Manual review recommended.`,
            explanation:
              'Assigning to innerHTML or calling document.write parses the assigned string as HTML, so any attacker-controlled part of it becomes markup. These APIs are extremely common in ordinary, safe code, which is why this is reported as an observation: it tells a reviewer where to look, and nothing more.',
            recommendation:
              'Prefer textContent, createElement, or a framework binding for untrusted values. Where HTML really must be assembled, sanitize it with a maintained library or use the Trusted Types API.',
            affectedPages: [page.url],
            aggregationKey: 'markup-sinks',
            occurrences: markupSinks.reduce((total, indicator) => total + indicator.occurrences, 0),
            evidence: indicatorEvidence(page, new Set(markupSinks.map((indicator) => indicator.id)))
          })
        );
      }
    }

    if (findings.length > 0) return { findings };

    if (!anyInlineScript(context.pages)) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No inline script was present in the markup analyzed. External script files are never downloaded by this assessment, so code kept in bundles was not examined.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return {
      findings: [
        passed(this, {
          summary: 'No dangerous DOM or code-evaluation API was seen in the inline script analyzed.',
          explanation:
            'None of the string-to-code or string-to-markup APIs this check looks for appeared in the inline script on the pages analyzed. External scripts were not downloaded, so this covers inline code only.',
          affectedPages: context.pages.map((page) => page.url),
          confidence: 'medium'
        })
      ]
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Inline event handlers                                                      */
/* -------------------------------------------------------------------------- */

export const inlineEventHandlerCheck: SecurityCheck = {
  id: 'inline-event-handlers',
  category: 'script-security',
  name: 'Inline event handlers',
  description: 'Counts inline on* handler attributes, which a strict CSP cannot allow.',
  severity: 'low',
  scoreWeight: 5,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let handlersSeen = 0;

    for (const page of context.pages) {
      const total = page.inlineEventHandlers.reduce((sum, handler) => sum + handler.count, 0);
      if (total === 0) continue;
      handlersSeen += total;

      findings.push(
        createFinding(this, {
          status: 'info',
          observation: 'best-practice',
          confidence: 'high',
          source: 'html',
          title: 'Page uses inline event handler attributes',
          summary: `${total} inline on* handler attribute${total === 1 ? '' : 's'} across ${page.inlineEventHandlers.length} element and handler combination${page.inlineEventHandlers.length === 1 ? '' : 's'}.`,
          explanation:
            "An inline handler is inline script, so a Content-Security-Policy that omits 'unsafe-inline' blocks it — and a nonce cannot be applied to an attribute. Inline handlers are therefore the usual thing that prevents a site from adopting a strict CSP. They are not themselves a weakness, and the handler code was never read by this assessment.",
          recommendation:
            'Move handlers into an external script attached with addEventListener. That lets script-src drop \'unsafe-inline\' without breaking the page.',
          affectedPages: [page.url],
          aggregationKey: 'present',
          occurrences: total,
          evidence: page.inlineEventHandlers.slice(0, 5).map((handler) => ({
            label: `<${handler.element} ${handler.attribute}>`,
            value: `${handler.count} occurrence${handler.count === 1 ? '' : 's'}`,
            pageUrl: page.url
          }))
        })
      );
    }

    if (handlersSeen === 0) {
      return {
        findings: [
          passed(this, {
            summary: 'No inline event handler attributes were found.',
            explanation:
              "The markup analyzed attaches no handlers through on* attributes, so inline handlers are not an obstacle to a script-src that omits 'unsafe-inline'.",
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* postMessage                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cross-document messaging hygiene.
 *
 * Two distinct concerns, reported separately: sending to `'*'` leaks the
 * message to whatever document happens to be in the target window, while
 * receiving without an origin comparison accepts messages from anyone. The
 * presence of an origin comparison anywhere in the same inline script is
 * treated as mitigating, because flagging a listener that *does* validate its
 * sender would be a false positive.
 */
export const postMessageCheck: SecurityCheck = {
  id: 'postmessage-origin-handling',
  category: 'script-security',
  name: 'Cross-document message handling',
  description:
    'Reports postMessage calls with a wildcard target origin and message listeners with no visible origin check.',
  severity: 'low',
  scoreWeight: 8,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const findings: SecurityFinding[] = [];
    let messagingSeen = false;

    for (const page of context.pages) {
      const wildcard = findIndicator(page.scriptIndicators, 'post-message-wildcard-origin');
      const listener = findIndicator(page.scriptIndicators, 'message-listener');
      const originCheck = hasIndicator(page.scriptIndicators, 'message-origin-check');

      if (!wildcard && !listener && !hasIndicator(page.scriptIndicators, 'post-message')) continue;
      messagingSeen = true;

      if (wildcard) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'potential-concern',
            confidence: 'medium',
            source: 'html',
            title: "postMessage uses a wildcard target origin",
            summary: `${wildcard.occurrences} postMessage call${wildcard.occurrences === 1 ? '' : 's'} pass${wildcard.occurrences === 1 ? 'es' : ''} "*" as the target origin.`,
            explanation:
              'With "*" the browser delivers the message to whatever document currently occupies the target window, even if it is not the one you intended — a frame that navigated, or a popup an attacker redirected. Whether that matters depends on what the message contains, which this assessment cannot see.',
            recommendation:
              'Pass the exact expected origin as the second argument to postMessage instead of "*", and avoid putting tokens or personal data in cross-document messages.',
            affectedPages: [page.url],
            aggregationKey: 'wildcard-target',
            occurrences: wildcard.occurrences,
            evidence: [
              { label: 'postMessage with "*"', value: String(wildcard.occurrences), pageUrl: page.url }
            ]
          })
        );
      }

      if (listener && !originCheck) {
        findings.push(
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'potential-concern',
            confidence: 'low',
            source: 'html',
            title: 'Message listener with no visible origin check',
            summary:
              'Inline script registers a message listener and no comparison against event.origin was seen in the same script.',
            explanation:
              'Any document that can get a reference to this window — an embedding page, a popup opener, an embedded frame — can send it a message. A listener that acts on the payload without checking event.origin will act on an attacker\'s message too. The check may well exist in an external script this assessment did not read, so this is a review pointer rather than a defect.',
            recommendation:
              'Compare event.origin against an explicit allowlist at the top of every message handler, and validate the payload shape before using it.',
            affectedPages: [page.url],
            aggregationKey: 'listener-without-origin-check',
            occurrences: listener.occurrences,
            evidence: [
              { label: "addEventListener('message')", value: String(listener.occurrences), pageUrl: page.url }
            ]
          })
        );
      }

      if (listener && originCheck) {
        findings.push(
          passed(this, {
            summary: 'Message listeners are accompanied by an origin comparison.',
            explanation:
              'Inline script that listens for messages also compares event.origin, which is the control that keeps an unexpected sender from being trusted. Whether the comparison is correct and complete was not verified.',
            affectedPages: [page.url],
            aggregationKey: 'origin-check-present',
            confidence: 'medium'
          })
        );
      }
    }

    if (!messagingSeen) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No cross-document messaging was seen in the inline script analyzed. Messaging in an external script file would not appear here, since external scripts are never downloaded.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Dynamic script loading                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Runtime script injection.
 *
 * Purely informational, and weighted at zero: nearly every tag manager,
 * analytics snippet, and module bundle loads code this way. It is recorded
 * because it explains why a passive scan under-reports a page's real script
 * surface — code added at runtime is invisible to markup analysis.
 */
export const dynamicScriptLoadingCheck: SecurityCheck = {
  id: 'dynamic-script-loading',
  category: 'script-security',
  name: 'Runtime script loading',
  description: 'Notes inline script that loads further script at runtime.',
  severity: 'informational',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const pages = context.pages.filter((page) =>
      page.scriptIndicators.some((indicator) => DYNAMIC_IDS.has(indicator.id))
    );

    if (pages.length === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No runtime script loading was seen in the inline script analyzed, so no additional invisible script surface was identified.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    const page = pages[0];

    return {
      findings: [
        createFinding(this, {
          status: 'info',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'html',
          title: 'Script is loaded at runtime',
          summary: `${pages.length} page${pages.length === 1 ? '' : 's'} load${pages.length === 1 ? 's' : ''} further script at runtime rather than declaring it in markup.`,
          explanation:
            'Dynamically injected script is normal — tag managers, module loaders, and lazy-loaded bundles all work this way. It does mean the resource counts and third-party domains in this report are a floor rather than a total: whatever these calls fetch was never seen, so neither its origin nor its integrity could be assessed.',
          recommendation:
            'For a complete picture of what actually executes, review the Network panel of your browser devtools on a real page load, or enable CSP reporting and read the violation reports.',
          affectedPages: pages.map((entry) => entry.url),
          aggregationKey: 'present',
          occurrences: pages.length,
          evidence: page.scriptIndicators
            .filter((indicator) => DYNAMIC_IDS.has(indicator.id))
            .slice(0, 4)
            .map((indicator) => ({
              label: indicator.label,
              value: `${indicator.occurrences} occurrence${indicator.occurrences === 1 ? '' : 's'}`,
              pageUrl: page.url
            }))
        })
      ]
    };
  }
};
