/**
 * Information disclosure and the disclosure process.
 *
 * Two different things share this file. `security.txt` is about how a site
 * *receives* reports, and is a process observation. The rest — technology
 * fingerprints, debug markers, source-map references — is about what a site
 * *reveals* about itself.
 *
 * Disclosure is a weak signal by nature. Knowing the framework a site runs
 * does not get an attacker in; it only tells them which exploits to try first.
 * So these findings stay low-severity and are worded as what was observed, not
 * as what could be done with it. Where evidence supports only a guess, the
 * confidence says so rather than the text asserting a version.
 */

import {
  CheckContext,
  CheckOutcome,
  PageIndicator,
  SecurityCheck,
  SecurityFinding,
  SecurityTxtSummary
} from '../../types';
import { MARKUP_INDICATORS } from '../analysis/indicators';
import {
  REQUIRED_SECURITY_TXT_FIELDS,
  hasSecurityTxtField
} from '../analysis/wellKnown';
import { createFinding, notApplicable, passed, unableToVerify } from '../findings';

/** The fixed path the runner probes; nothing else is requested. */
export const SECURITY_TXT_PATH = '/.well-known/security.txt';

/** A version-looking number, used to decide how specific a claim may be. */
const VERSION_PATTERN = /\d+\.\d+/;

/** Merges indicators from several pages, summing occurrences. */
function mergeAcrossPages(lists: readonly (readonly PageIndicator[])[]): PageIndicator[] {
  const merged = new Map<string, PageIndicator>();
  for (const list of lists) {
    for (const indicator of list) {
      const existing = merged.get(indicator.id);
      if (existing) {
        existing.occurrences += indicator.occurrences;
        if (!existing.detail && indicator.detail) existing.detail = indicator.detail;
      } else {
        merged.set(indicator.id, { ...indicator });
      }
    }
  }
  return [...merged.values()].sort(
    (a, b) => b.occurrences - a.occurrences || a.id.localeCompare(b.id)
  );
}

/* -------------------------------------------------------------------------- */
/* security.txt                                                               */
/* -------------------------------------------------------------------------- */

/** Describes what a parsed security.txt is missing or has got wrong. */
function securityTxtProblems(summary: SecurityTxtSummary): string[] {
  const problems: string[] = [];

  for (const field of REQUIRED_SECURITY_TXT_FIELDS) {
    if (!hasSecurityTxtField(summary, field)) {
      problems.push(`the required ${field === 'contact' ? 'Contact' : 'Expires'} field is absent`);
    }
  }

  if (hasSecurityTxtField(summary, 'contact') && !summary.contactUsable) {
    problems.push('no Contact value is a usable mailto:, tel:, or https: URI');
  }
  if (hasSecurityTxtField(summary, 'expires') && !summary.expiresValid) {
    problems.push('the Expires value is not a parsable timestamp');
  }
  if (summary.expired) {
    problems.push('the Expires date has passed, so the file is formally stale');
  }
  if (summary.canonicalMatchesOrigin === false) {
    problems.push('the Canonical URL does not match the origin the file was served from');
  }
  if (summary.malformedLines > 0) {
    problems.push(
      `${summary.malformedLines} line${summary.malformedLines === 1 ? '' : 's'} did not parse as a field`
    );
  }

  return problems;
}

/**
 * Whether the target publishes a usable `security.txt` (RFC 9116).
 *
 * This is a disclosure-process observation, not a technical weakness, so it is
 * low severity and carries little weight. Cross-origin probing is usually
 * blocked by CORS, in which case the honest answer is `unable-to-verify`
 * rather than "missing".
 */
export const securityTxtCheck: SecurityCheck = {
  id: 'security-txt-missing',
  category: 'disclosure-process',
  name: 'security.txt disclosure policy',
  description:
    'Checks whether the target publishes a valid /.well-known/security.txt describing how to report a vulnerability.',
  severity: 'low',
  scoreWeight: 5,
  modes: ['browser-passive'],
  requires: ['well-known-probe'],

  execute(context: CheckContext): CheckOutcome {
    const probe = context.wellKnown.find((entry) => entry.path === SECURITY_TXT_PATH);

    if (!probe || !probe.observable || probe.found === null) {
      return {
        findings: [
          unableToVerify(this, {
            reason:
              probe?.reason ??
              'The browser could not read a response from /.well-known/security.txt. A cross-origin request for it is blocked unless the target sends CORS headers, so its presence can be neither confirmed nor ruled out.',
            affectedPages: [context.target.url],
            recommendation: `Open ${context.target.origin}${SECURITY_TXT_PATH} directly in a browser tab to check it yourself.`
          })
        ]
      };
    }

    if (!probe.found) {
      return {
        findings: [
          createFinding(this, {
            status: 'warning',
            severity: 'low',
            observation: 'best-practice',
            confidence: 'medium',
            source: 'browser',
            title: 'No security.txt published',
            summary: `A request for ${SECURITY_TXT_PATH} did not return a file.`,
            explanation:
              'Without a published disclosure contact, someone who finds a vulnerability has to guess where to send it, which delays or discourages the report. This is a process gap rather than a technical weakness, and it does not make the site more attackable.',
            recommendation:
              'Publish a security.txt at /.well-known/security.txt with at least Contact and Expires fields, as described in RFC 9116.',
            affectedPages: [context.target.url],
            aggregationKey: 'missing',
            evidence: [
              { label: 'Path', value: SECURITY_TXT_PATH },
              { label: 'Status', value: probe.status === null ? 'no response' : String(probe.status) }
            ]
          })
        ]
      };
    }

    const summary = probe.summary?.kind === 'security-txt' ? probe.summary : undefined;

    if (!summary) {
      return {
        findings: [
          passed(this, {
            summary: 'The target publishes a security.txt file.',
            explanation:
              'A security.txt at the well-known location gives researchers an unambiguous route to report a vulnerability, which shortens the time between discovery and a fix. Its contents were not available to parse, so the individual fields were not validated.',
            affectedPages: [context.target.url],
            confidence: 'medium',
            evidence: [{ label: 'Path', value: SECURITY_TXT_PATH }]
          })
        ]
      };
    }

    const problems = securityTxtProblems(summary);
    const fieldNames = summary.fields.map((field) => field.name).join(', ');

    if (problems.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: 'The target publishes a security.txt with the required fields present and valid.',
            explanation:
              'A security.txt at the well-known location gives researchers an unambiguous route to report a vulnerability. Contact and Expires are present, Expires is in the future, and every line parsed as a field. Contact addresses and policy URLs were validated in place and are not reproduced here, because a security.txt routinely names individuals.',
            affectedPages: [context.target.url],
            evidence: [
              { label: 'Fields present', value: fieldNames },
              { label: 'PGP signed', value: summary.signed ? 'yes' : 'no' }
            ]
          })
        ]
      };
    }

    return {
      findings: [
        createFinding(this, {
          status: 'warning',
          severity: 'low',
          observation: 'best-practice',
          confidence: 'high',
          source: 'browser',
          title: 'security.txt is published but incomplete',
          summary: `A security.txt exists at ${SECURITY_TXT_PATH}, but ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} other issue${problems.length > 2 ? 's' : ''})` : ''}.`,
          explanation: `RFC 9116 requires both Contact and Expires, and a parser that cannot read them will treat the file as unusable — which defeats the point of publishing it. Specifically: ${problems.join('; ')}. This is a process gap, not a technical weakness. Field values were validated in place and are not reproduced in this report.`,
          recommendation:
            'Correct the fields listed above and keep Expires no more than a year ahead, refreshing it as part of a recurring task so the file does not quietly go stale.',
          affectedPages: [context.target.url],
          aggregationKey: summary.expired ? 'expired' : 'incomplete',
          occurrences: problems.length,
          evidence: [
            { label: 'Fields present', value: fieldNames || 'none' },
            { label: 'Issues', value: problems.join('; ') }
          ]
        })
      ]
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Technology disclosure                                                      */
/* -------------------------------------------------------------------------- */

export const technologyDisclosureCheck: SecurityCheck = {
  id: 'technology-disclosure',
  category: 'information-disclosure',
  name: 'Technology disclosure',
  description:
    'Reports framework and platform indicators visible in generator meta tags and resource paths.',
  severity: 'low',
  scoreWeight: 4,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const technologies = new Map<string, { name: string; evidence: string; confidence: string }>();

    for (const page of context.pages) {
      for (const technology of page.detectedTechnologies) {
        if (!technologies.has(technology.id)) {
          technologies.set(technology.id, {
            name: technology.name,
            evidence: technology.evidence,
            confidence: technology.confidence
          });
        }
      }
    }

    if (technologies.size === 0) {
      return {
        findings: [
          notApplicable(this, {
            reason:
              'No generator meta tag or recognizable framework path was found in the markup analyzed. This is not a guarantee that the stack is unidentifiable — fingerprinting has many other signals that a passive markup scan does not look at.',
            affectedPages: context.pages.map((page) => page.url)
          })
        ]
      };
    }

    const entries = [...technologies.values()];
    const versioned = entries.filter((entry) => VERSION_PATTERN.test(entry.name));
    const highConfidence = entries.filter((entry) => entry.confidence === 'high');

    return {
      findings: [
        createFinding(this, {
          status: versioned.length > 0 ? 'warning' : 'info',
          severity: 'low',
          observation: versioned.length > 0 ? 'best-practice' : 'verified-observation',
          confidence: highConfidence.length > 0 ? 'high' : 'medium',
          source: 'html',
          title:
            versioned.length > 0
              ? 'Page discloses platform and version information'
              : 'Page discloses platform information',
          summary: `${entries.length} technology indicator${entries.length === 1 ? '' : 's'} ${entries.length === 1 ? 'is' : 'are'} visible in the markup${versioned.length > 0 ? `, ${versioned.length} of which include${versioned.length === 1 ? 's' : ''} a version number` : ''}.`,
          explanation: `Knowing the stack does not grant access, but it does let someone go straight to the known issues for that stack and that version instead of probing blind. ${versioned.length > 0 ? 'A version number is the part worth removing: it turns a guess into a lookup.' : 'No version number was disclosed, which keeps this at the level of general shape rather than a specific target.'} Indicators drawn from resource paths are suggestive rather than conclusive — a path can be proxied, renamed, or copied by an unrelated stack — which is why the confidence on each one is recorded.`,
          recommendation:
            'Remove the generator meta tag and any version string from markup and asset paths. Treat this as cosmetic hardening and not as a substitute for patching: an attacker who cannot read your version will simply try the exploits anyway.',
          affectedPages: context.pages.map((page) => page.url),
          aggregationKey: versioned.length > 0 ? 'version-disclosed' : 'platform-disclosed',
          occurrences: entries.length,
          evidence: entries.slice(0, 6).map((entry) => ({
            label: `${entry.name} (${entry.confidence} confidence)`,
            value: entry.evidence
          }))
        })
      ]
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Debug and environment indicators                                           */
/* -------------------------------------------------------------------------- */

export const debugIndicatorCheck: SecurityCheck = {
  id: 'debug-indicators',
  category: 'information-disclosure',
  name: 'Development and debug indicators',
  description:
    'Reports debugger statements, debug flags, development-environment markers, and internal-looking hostnames.',
  severity: 'medium',
  scoreWeight: 8,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const pages = context.pages.filter((page) => page.debugIndicators.length > 0);

    if (pages.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: 'No development or debug marker was found in the markup analyzed.',
            explanation:
              'None of the debug flags, debugger statements, development-environment markers, or internal-looking hostnames this check looks for appeared. Markers inside an external script file would not have been seen, since external scripts are never downloaded.',
            affectedPages: context.pages.map((page) => page.url),
            confidence: 'medium'
          })
        ]
      };
    }

    const findings: SecurityFinding[] = [];
    const indicators = mergeAcrossPages(pages.map((page) => page.debugIndicators));

    const internalHost = indicators.find(
      (indicator) => indicator.id === MARKUP_INDICATORS.internalHostname.id
    );
    const debugMarkers = indicators.filter(
      (indicator) => indicator.id !== MARKUP_INDICATORS.internalHostname.id
    );

    if (debugMarkers.length > 0) {
      findings.push(
        createFinding(this, {
          status: 'warning',
          severity: 'low',
          observation: 'potential-concern',
          confidence: 'medium',
          source: 'html',
          title: 'Development or debug markers present in production markup',
          summary: `${debugMarkers.map((indicator) => indicator.label).slice(0, 4).join(', ')} appeared in the markup analyzed.`,
          explanation:
            'A debug flag or a development-environment marker left in a production response suggests the build that reached visitors is not the production build. That matters less for the marker itself than for what usually accompanies it: verbose error pages, stack traces, source maps, and relaxed security settings. Nothing here confirms any of those are enabled — this is a prompt to check.',
          recommendation:
            'Confirm the production build strips debug flags and debugger statements, and that error responses in production carry no stack trace or internal path.',
          affectedPages: pages.map((page) => page.url),
          aggregationKey: 'debug-markers',
          occurrences: debugMarkers.reduce((total, indicator) => total + indicator.occurrences, 0),
          evidence: debugMarkers.slice(0, 5).map((indicator) => ({
            label: indicator.label,
            value: `${indicator.occurrences} occurrence${indicator.occurrences === 1 ? '' : 's'}`
          }))
        })
      );
    }

    if (internalHost) {
      findings.push(
        createFinding(this, {
          status: 'warning',
          severity: 'medium',
          observation: 'verified-observation',
          confidence: 'high',
          source: 'html',
          title: 'Internal-looking hostnames referenced in markup',
          summary: `${internalHost.occurrences} referenced hostname${internalHost.occurrences === 1 ? '' : 's'} look${internalHost.occurrences === 1 ? 's' : ''} private or internal.`,
          explanation:
            'A private IP range, a .local or .internal suffix, or a bare internal hostname in a public response describes part of your internal network layout. The reference will not resolve for an ordinary visitor, so the leak is the name itself rather than a working link — but internal naming is exactly the kind of detail that makes a later phishing or lateral-movement attempt credible. It also usually means a staging configuration was deployed to production.',
          recommendation:
            'Replace internal hostnames with public ones in anything served to visitors, and confirm the production configuration is the one that shipped.',
          affectedPages: pages.map((page) => page.url),
          aggregationKey: 'internal-hostnames',
          occurrences: internalHost.occurrences,
          evidence: [
            { label: 'Hostnames', value: internalHost.detail ?? `${internalHost.occurrences} host(s)` }
          ]
        })
      );
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Source maps                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Source-map references.
 *
 * The map files themselves are never requested. They are frequently large, and
 * fetching one would mean pulling the target's original source into this tab —
 * which this assessment has no reason to do and no right to display. So the
 * finding reports that a reference exists and stops there: whether the map is
 * actually reachable is left for the operator to confirm.
 */
export const sourceMapIndicatorCheck: SecurityCheck = {
  id: 'source-map-indicators',
  category: 'information-disclosure',
  name: 'Source map references',
  description:
    'Reports sourceMappingURL comments, .map resource references, and build-path markers, without requesting any map.',
  severity: 'low',
  scoreWeight: 6,
  modes: ['browser-passive'],
  requires: ['html-body'],

  execute(context: CheckContext): CheckOutcome {
    const pages = context.pages.filter((page) => page.sourceMapIndicators.length > 0);

    if (pages.length === 0) {
      return {
        findings: [
          passed(this, {
            summary: 'No source map reference was found in the markup analyzed.',
            explanation:
              'No sourceMappingURL comment, .map resource reference, or build-path marker appeared in the markup or inline script. External script files are never downloaded, so a sourceMappingURL comment at the end of a bundle would not have been seen — this covers inline code and markup references only.',
            affectedPages: context.pages.map((page) => page.url),
            confidence: 'low'
          })
        ]
      };
    }

    const indicators = mergeAcrossPages(pages.map((page) => page.sourceMapIndicators));
    const hasBuildPath = indicators.some(
      (indicator) => indicator.id === 'bundler-internal-path' || indicator.id === 'build-machine-path'
    );

    return {
      findings: [
        createFinding(this, {
          status: 'warning',
          severity: 'low',
          observation: 'potential-concern',
          confidence: 'medium',
          source: 'html',
          title: 'Source map references are present',
          summary: `${indicators.map((indicator) => indicator.label).slice(0, 4).join(', ')} appeared across ${pages.length} page${pages.length === 1 ? '' : 's'}.`,
          explanation: `A published source map reconstructs the original source of a bundle — module layout, comments, internal names, and sometimes paths from the build machine. None of that is a vulnerability in itself, and plenty of teams ship maps deliberately to get readable production stack traces. It does remove the small amount of friction that minification provides when someone is looking for a flaw in your code.${hasBuildPath ? ' A build-machine or bundler path marker also appeared, which can disclose a developer username or an internal directory layout.' : ''} No map file was requested while producing this report, so whether these references actually resolve was not verified, and no source content appears anywhere in it.`,
          recommendation:
            'Decide deliberately whether maps should be public. To keep them private, upload them to your error-tracking service at build time and stop serving them from the web root, or restrict the .map path to authenticated requests. Either way, strip absolute build paths from the output.',
          affectedPages: pages.map((page) => page.url),
          aggregationKey: hasBuildPath ? 'with-build-paths' : 'references-present',
          occurrences: indicators.reduce((total, indicator) => total + indicator.occurrences, 0),
          evidence: indicators.slice(0, 5).map((indicator) => ({
            label: indicator.label,
            value: `${indicator.occurrences} occurrence${indicator.occurrences === 1 ? '' : 's'}`
          }))
        })
      ]
    };
  }
};
