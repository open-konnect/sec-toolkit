/**
 * robots.txt and sitemap observations.
 *
 * Both files are public by design and neither is a security control. The one
 * misconception worth correcting explicitly — and this report does correct it
 * — is the idea that a `Disallow` rule hides anything. It does not: it is a
 * request to well-behaved crawlers, it is world-readable, and it is one of the
 * first places an attacker looks precisely because operators list their
 * interesting paths in it.
 *
 * So nothing here is scored. A path named in robots.txt is reported as an
 * observation about what the site advertises, never as a weakness, and no URL
 * found in either file is ever requested.
 */

import {
  CheckContext,
  CheckOutcome,
  RobotsTxtSummary,
  SecurityCheck,
  SecurityFinding,
  SitemapSummary,
  WellKnownProbe
} from '../../types';
import { createFinding, notApplicable, unableToVerify } from '../findings';

export const ROBOTS_TXT_PATH = '/robots.txt';
export const SITEMAP_PATH = '/sitemap.xml';

/** The probe for a fixed path, or undefined when it was never attempted. */
function probeFor(context: CheckContext, path: string): WellKnownProbe | undefined {
  return context.wellKnown.find((probe) => probe.path === path);
}

function robotsSummary(probe: WellKnownProbe | undefined): RobotsTxtSummary | undefined {
  return probe?.summary?.kind === 'robots-txt' ? probe.summary : undefined;
}

function sitemapSummary(probe: WellKnownProbe | undefined): SitemapSummary | undefined {
  return probe?.summary?.kind === 'sitemap' ? probe.summary : undefined;
}

/** The standard caveat, attached wherever robots.txt content is described. */
const NOT_ACCESS_CONTROL =
  'robots.txt is not an access-control mechanism. It is a publicly readable request to cooperating crawlers, it is ignored by anything that chooses to ignore it, and a path listed in it remains reachable by anyone who types it.';

/* -------------------------------------------------------------------------- */
/* robots.txt                                                                 */
/* -------------------------------------------------------------------------- */

export const robotsTxtCheck: SecurityCheck = {
  id: 'robots-txt',
  category: 'site-metadata',
  name: 'robots.txt',
  description:
    'Reads /robots.txt where accessible and describes its structure, declared sitemaps, and the paths it advertises.',
  severity: 'informational',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['well-known-probe'],

  execute(context: CheckContext): CheckOutcome {
    const probe = probeFor(context, ROBOTS_TXT_PATH);

    if (!probe) {
      return {
        findings: [
          notApplicable(this, {
            reason: 'No robots.txt probe was performed for this run.',
            affectedPages: [context.target.url]
          })
        ]
      };
    }

    if (!probe.observable) {
      return {
        findings: [
          unableToVerify(this, {
            reason: `Could not determine whether ${ROBOTS_TXT_PATH} exists on this origin, because the request could not be completed from the browser. ${probe.reason ?? ''}`.trim(),
            recommendation: `Open ${probe.url} directly, or request it with curl, to see what the file contains.`,
            affectedPages: [probe.url],
            aggregationKey: 'robots-not-observable'
          })
        ]
      };
    }

    if (probe.found === false) {
      return {
        findings: [
          createFinding(this, {
            status: 'info',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'browser',
            title: 'No robots.txt is published',
            summary: `${ROBOTS_TXT_PATH} returned 404, so this origin publishes no crawler directives.`,
            explanation:
              'The absence of robots.txt is not a security weakness. It means crawlers apply their own defaults, and it also means the site is not advertising a list of its own paths. If anything, a missing robots.txt discloses less than a populated one.',
            recommendation:
              'Add robots.txt only if you need to steer crawlers or declare a sitemap. Do not add it to hide anything — use authentication and authorization for that.',
            affectedPages: [probe.url],
            aggregationKey: 'absent'
          })
        ]
      };
    }

    const summary = robotsSummary(probe);

    if (!summary) {
      return {
        findings: [
          createFinding(this, {
            status: 'info',
            observation: 'verified-observation',
            confidence: 'medium',
            source: 'browser',
            title: 'robots.txt is published',
            summary: `${ROBOTS_TXT_PATH} exists on this origin but its contents were not parsed.`,
            explanation: `The file responded successfully, so crawler directives are published here. Its body was not available to parse, so nothing is reported about what it contains. ${NOT_ACCESS_CONTROL}`,
            recommendation: `Review ${probe.url} yourself and confirm every path it names is one you are comfortable advertising publicly.`,
            affectedPages: [probe.url],
            aggregationKey: 'present-unparsed',
            evidence: [{ label: 'Size', value: `${probe.bytes} bytes` }]
          })
        ]
      };
    }

    const findings: SecurityFinding[] = [];

    findings.push(
      createFinding(this, {
        status: 'info',
        observation: 'verified-observation',
        confidence: 'high',
        source: 'browser',
        title: 'robots.txt is published',
        summary: `${ROBOTS_TXT_PATH} declares ${summary.disallowRules} disallow rule${summary.disallowRules === 1 ? '' : 's'} across ${summary.userAgentGroups} user-agent group${summary.userAgentGroups === 1 ? '' : 's'}${summary.sitemaps.length > 0 ? `, and references ${summary.sitemaps.length} sitemap${summary.sitemaps.length === 1 ? '' : 's'}` : ''}.`,
        explanation: `This is an inventory of what the file says, not a judgement about it. ${NOT_ACCESS_CONTROL}${summary.blocksEverything ? ' This file disallows all crawlers from the entire site, which affects search visibility but has no bearing on who can reach the pages.' : ''}${summary.malformedLines > 0 ? ` ${summary.malformedLines} line${summary.malformedLines === 1 ? '' : 's'} did not parse as a directive, which usually means a typo that crawlers will silently ignore.` : ''}`,
        recommendation:
          'Keep robots.txt for crawler guidance only. Any path that must stay private needs authentication and authorization; removing it from robots.txt neither hides nor exposes it.',
        affectedPages: [probe.url],
        aggregationKey: 'present',
        evidence: [
          { label: 'User-agent groups', value: String(summary.userAgentGroups) },
          { label: 'Disallow rules', value: String(summary.disallowRules) },
          { label: 'Allow rules', value: String(summary.allowRules) },
          ...(summary.sitemaps.length > 0
            ? [{ label: 'Sitemaps declared', value: summary.sitemaps.slice(0, 3).join(', ') }]
            : []),
          ...(summary.malformedLines > 0
            ? [{ label: 'Unparsed lines', value: String(summary.malformedLines) }]
            : [])
        ]
      })
    );

    if (summary.administrativeLookingPaths.length > 0) {
      findings.push(
        createFinding(this, {
          status: 'info',
          observation: 'best-practice',
          confidence: 'medium',
          source: 'browser',
          title: 'robots.txt names administrative-looking paths',
          summary: `${summary.administrativeLookingPaths.length} disallowed path${summary.administrativeLookingPaths.length === 1 ? '' : 's'} read like an administrative or internal area.`,
          explanation: `This is not a vulnerability, and it is not evidence that anything is exposed — these paths may well be properly protected, or may not exist at all. It is worth knowing because robots.txt is public and is routinely read by anyone mapping a site, so listing a path here advertises it. ${NOT_ACCESS_CONTROL}`,
          recommendation:
            'Confirm each of these paths requires authentication. Where you only want them out of search results, prefer a noindex response header or meta tag on the pages themselves, or disallow a broader prefix, rather than naming each sensitive path in a public file.',
          affectedPages: [probe.url],
          aggregationKey: 'administrative-paths',
          occurrences: summary.administrativeLookingPaths.length,
          evidence: summary.administrativeLookingPaths.slice(0, 6).map((path) => ({
            label: 'Disallowed path',
            value: path
          }))
        })
      );
    }

    return { findings };
  }
};

/* -------------------------------------------------------------------------- */
/* Sitemap                                                                    */
/* -------------------------------------------------------------------------- */

export const sitemapCheck: SecurityCheck = {
  id: 'sitemap-availability',
  category: 'site-metadata',
  name: 'Sitemap',
  description:
    'Checks whether a sitemap is published at the conventional path or declared in robots.txt, and describes its shape.',
  severity: 'informational',
  scoreWeight: 0,
  modes: ['browser-passive'],
  requires: ['well-known-probe'],

  execute(context: CheckContext): CheckOutcome {
    const probe = probeFor(context, SITEMAP_PATH);
    const declared = robotsSummary(probeFor(context, ROBOTS_TXT_PATH))?.sitemaps ?? [];

    if (!probe) {
      return {
        findings: [
          notApplicable(this, {
            reason: 'No sitemap probe was performed for this run.',
            affectedPages: [context.target.url]
          })
        ]
      };
    }

    if (!probe.observable) {
      return {
        findings: [
          unableToVerify(this, {
            reason: `Could not determine whether ${SITEMAP_PATH} exists on this origin, because the request could not be completed from the browser. ${probe.reason ?? ''}`.trim(),
            recommendation: `Open ${probe.url} directly to see whether a sitemap is published.`,
            affectedPages: [probe.url],
            aggregationKey: 'sitemap-not-observable'
          })
        ]
      };
    }

    if (probe.found === false) {
      return {
        findings: [
          createFinding(this, {
            status: 'info',
            observation: 'verified-observation',
            confidence: 'high',
            source: 'browser',
            title: 'No sitemap at the conventional path',
            summary: `${SITEMAP_PATH} returned 404${declared.length > 0 ? `, though robots.txt declares ${declared.length} sitemap location${declared.length === 1 ? '' : 's'} elsewhere` : ''}.`,
            explanation:
              'A sitemap is a search-engine aid and its absence is not a security weakness. It is noted here only to describe what the origin publishes. Any sitemap declared in robots.txt was not requested by this assessment.',
            recommendation:
              declared.length > 0
                ? 'No action needed. If you publish a sitemap at a non-standard path, confirm it lists only pages you intend to be publicly indexed.'
                : 'No action needed. If you add a sitemap, list only publicly indexable pages in it.',
            affectedPages: [probe.url],
            aggregationKey: 'absent',
            evidence: declared
              .slice(0, 3)
              .map((url) => ({ label: 'Declared in robots.txt', value: url }))
          })
        ]
      };
    }

    const summary = sitemapSummary(probe);

    if (!summary) {
      return {
        findings: [
          createFinding(this, {
            status: 'info',
            observation: 'verified-observation',
            confidence: 'medium',
            source: 'browser',
            title: 'Sitemap is published',
            summary: `${SITEMAP_PATH} exists on this origin but its contents were not parsed.`,
            explanation:
              'The path responded successfully, so a sitemap is published here. Its body was not available to parse, so nothing is reported about which URLs it lists. No URL from it was requested.',
            recommendation:
              'Review the sitemap and confirm it lists only pages you intend search engines — and anyone else reading it — to know about.',
            affectedPages: [probe.url],
            aggregationKey: 'present-unparsed',
            evidence: [{ label: 'Size', value: `${probe.bytes} bytes` }]
          })
        ]
      };
    }

    const findings: SecurityFinding[] = [];

    findings.push(
      createFinding(this, {
        status: 'info',
        observation: 'verified-observation',
        confidence: 'high',
        source: 'browser',
        title: summary.wellFormed ? 'Sitemap is published' : 'Sitemap path responds with unexpected content',
        summary: summary.wellFormed
          ? `${SITEMAP_PATH} is a ${summary.format} listing ${summary.urlCount}${summary.truncated ? '+' : ''} URL${summary.urlCount === 1 ? '' : 's'}.`
          : `${SITEMAP_PATH} returned a successful response that does not parse as a sitemap.`,
        explanation: summary.wellFormed
          ? `A sitemap is a public list of pages the site wants discovered, so it is also a map for anyone enumerating the site — which is normal and expected.${summary.truncated ? ' Only the first portion of the file was read, so the URL count is a lower bound.' : ''}${summary.crossOriginUrlCount > 0 ? ` ${summary.crossOriginUrlCount} of the listed URLs point at another origin, which is unusual and worth confirming.` : ''} No URL in it was requested.`
          : 'Something is served at the sitemap path, but it is neither a urlset, a sitemapindex, nor a plain URL list. This is most often a soft-404 page returned with a 200 status, which matters because a soft 404 makes it impossible for any client — this assessment included — to distinguish a missing resource from a present one.',
        recommendation: summary.wellFormed
          ? 'Confirm the sitemap lists only pages intended for public discovery, and that no staging, preview, or internal URL has leaked into it.'
          : 'Return a real 404 status for paths that do not exist, so that missing resources are distinguishable from present ones.',
        affectedPages: [probe.url],
        aggregationKey: summary.wellFormed ? 'present' : 'malformed',
        evidence: [
          { label: 'Format', value: summary.format },
          { label: 'URLs listed', value: `${summary.urlCount}${summary.truncated ? '+' : ''}` },
          ...(summary.crossOriginUrlCount > 0
            ? [{ label: 'Cross-origin URLs', value: String(summary.crossOriginUrlCount) }]
            : [])
        ]
      })
    );

    if (summary.administrativeLookingPaths.length > 0) {
      findings.push(
        createFinding(this, {
          status: 'info',
          observation: 'best-practice',
          confidence: 'medium',
          source: 'browser',
          title: 'Sitemap lists administrative-looking paths',
          summary: `${summary.administrativeLookingPaths.length} sitemap entr${summary.administrativeLookingPaths.length === 1 ? 'y reads' : 'ies read'} like an administrative or internal area.`,
          explanation:
            'A sitemap asks search engines to index what it lists. An administrative or internal path in that list is usually an accident of a generator walking every route, and it means the path is both advertised and a candidate for appearing in search results. It is not evidence that the path is unprotected — none of these URLs was requested.',
          recommendation:
            'Exclude non-public routes from sitemap generation, and confirm each of these paths requires authentication.',
          affectedPages: [probe.url],
          aggregationKey: 'administrative-paths',
          occurrences: summary.administrativeLookingPaths.length,
          evidence: summary.administrativeLookingPaths.slice(0, 6).map((path) => ({
            label: 'Listed path',
            value: path
          }))
        })
      );
    }

    return { findings };
  }
};
