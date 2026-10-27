/**
 * Asset and resource model for the report.
 *
 * A flat, deduplicated view of what the crawled pages referenced: pages,
 * resources and the external domains they come from, with stable ids and links
 * to the findings that involve them. It is built purely from the assessment
 * result — nothing is fetched — and describes references found in markup, not
 * files that were downloaded or inspected.
 */

import {
  AggregatedFinding,
  AnalyzedPage,
  PartyRelationship,
  ResourceType,
  SecurityAssessment,
  ThirdPartyKind
} from '../../types';
import { classifyDomain, relationshipOf, sriIsMeaningful } from '../analysis/thirdParty';
import { sanitizeUrlForEvidence } from '../findings';
import { parseUrl } from '../url';
import { safeText, stableId } from './text';

export type ResourceTypeGroup = 'script' | 'stylesheet' | 'image' | 'font' | 'iframe' | 'media' | 'other';

export const RESOURCE_GROUP_LABELS: Record<ResourceTypeGroup, string> = {
  script: 'JavaScript',
  stylesheet: 'CSS',
  image: 'Images',
  font: 'Fonts',
  iframe: 'Iframes',
  media: 'Media',
  other: 'Other'
};

export function typeGroupOf(type: ResourceType): ResourceTypeGroup {
  switch (type) {
    case 'script':
    case 'stylesheet':
    case 'image':
    case 'font':
    case 'iframe':
    case 'media':
      return type;
    default:
      return 'other';
  }
}

export type IntegrityStatus = 'present' | 'missing' | 'not-applicable';
export type CrossOriginStatus = 'not-set' | 'anonymous' | 'use-credentials';
export type IssueLevel = 'none' | 'info' | 'warning' | 'fail';

export type ResourceObservationId =
  | 'plaintext-http'
  | 'no-integrity'
  | 'integrity-without-crossorigin'
  | 'iframe-no-sandbox';

export const RESOURCE_OBSERVATION_LABELS: Record<ResourceObservationId, string> = {
  'plaintext-http': 'Referenced over plaintext HTTP',
  'no-integrity': 'Cross-origin, no integrity hash',
  'integrity-without-crossorigin': 'Integrity hash without crossorigin',
  'iframe-no-sandbox': 'Cross-origin iframe, no sandbox'
};

export interface AssetPage {
  id: string;
  url: string;
  depth: number;
  title: string | null;
  resourceIds: string[];
  /** Ids of other analyzed pages this page links to. */
  linkedPageIds: string[];
  findingIds: string[];
  issueLevel: IssueLevel;
}

export interface AssetResource {
  id: string;
  /** Origin and path only; the query string is never kept. */
  url: string;
  type: ResourceType;
  group: ResourceTypeGroup;
  origin: string | null;
  host: string | null;
  protocol: string | null;
  relationship: PartyRelationship;
  pageIds: string[];
  pageUrls: string[];
  /** Total references across pages. */
  referenceCount: number;
  integrity: IntegrityStatus;
  crossOrigin: CrossOriginStatus;
  observations: ResourceObservationId[];
  findingIds: string[];
  issueLevel: IssueLevel;
  /** Lowercase text the inventory search matches against. */
  searchText: string;
}

export interface AssetDomain {
  id: string;
  host: string;
  relationship: PartyRelationship;
  /** Based only on a built-in list of well-known hostnames; `other` otherwise. */
  kind: ThirdPartyKind;
  resourceIds: string[];
  resourceCount: number;
  byType: Partial<Record<ResourceType, number>>;
  pageIds: string[];
  pageUrls: string[];
  protocols: string[];
  /** Distinct origins (scheme, host, port) seen for this hostname. */
  origins: string[];
  usesHttp: boolean;
  findingIds: string[];
  issueLevel: IssueLevel;
}

export interface AssetStats {
  pagesCrawled: number;
  /** Inline `<script>` blocks across pages; a hint that assets load at runtime. */
  inlineScripts: number;
  resourcesDiscovered: number;
  /** Individual references, before deduplication across pages. */
  resourceReferences: number;
  /** Data URIs, non-web schemes and references that could not be parsed. */
  unresolvedReferences: number;
  javascript: number;
  css: number;
  images: number;
  fonts: number;
  iframes: number;
  media: number;
  objectsAndEmbeds: number;
  other: number;
  firstParty: number;
  sameSite: number;
  thirdParty: number;
  http: number;
  https: number;
  externalDomains: number;
}

export interface AssetModel {
  target: { url: string; host: string };
  pages: AssetPage[];
  resources: AssetResource[];
  domains: AssetDomain[];
  stats: AssetStats;
  /** Findings that reference at least one page, resource or domain. */
  linkedFindingIds: string[];
}

/** Statuses that describe something to look at, as opposed to a clean result. */
const ISSUE_RANK: Record<IssueLevel, number> = { none: 0, info: 1, warning: 2, fail: 3 };

function issueLevelOf(status: AggregatedFinding['status']): IssueLevel {
  if (status === 'fail') return 'fail';
  if (status === 'warning') return 'warning';
  if (status === 'info') return 'info';
  return 'none';
}

function maxLevel(levels: Iterable<IssueLevel>): IssueLevel {
  let best: IssueLevel = 'none';
  for (const level of levels) if (ISSUE_RANK[level] > ISSUE_RANK[best]) best = level;
  return best;
}

/** The key a resource is deduplicated and matched to findings by. */
export function resourceKey(url: string | null | undefined): string {
  return sanitizeUrlForEvidence(url);
}

function crossOriginStatus(value: string | null): CrossOriginStatus {
  if (value === null) return 'not-set';
  return value.trim().toLowerCase() === 'use-credentials' ? 'use-credentials' : 'anonymous';
}

interface ResourceAccumulator {
  id: string;
  url: string;
  type: ResourceType;
  origin: string | null;
  host: string | null;
  protocol: string | null;
  relationship: PartyRelationship;
  pageIds: Set<string>;
  pageUrls: Set<string>;
  references: number;
  everyHasIntegrity: boolean;
  crossOriginAttr: string | null;
  crossOrigin: boolean;
  sriMeaningful: boolean;
  unsandboxedFrame: boolean;
  integrityWithoutCors: boolean;
}

export function buildAssetModel(assessment: SecurityAssessment): AssetModel {
  const pages: AnalyzedPage[] = assessment.pages;
  const targetHost = assessment.target.hostname;

  const pageIdByUrl = new Map<string, string>();
  // Findings name pages by their query-free form. Pages that differ only by
  // query string share that form, so a finding links to all of them.
  const pageIdsBySafeUrl = new Map<string, string[]>();
  const safePageUrl = new Map<string, string>();
  for (const page of pages) {
    const id = stableId('pg', page.url);
    const safe = safeText(sanitizeUrlForEvidence(page.url), 300);
    pageIdByUrl.set(page.url, id);
    safePageUrl.set(page.url, safe);
    pageIdsBySafeUrl.set(safe, [...(pageIdsBySafeUrl.get(safe) ?? []), id]);
  }

  const accumulators = new Map<string, ResourceAccumulator>();
  let references = 0;
  let unresolved = 0;

  for (const page of pages) {
    const pageId = pageIdByUrl.get(page.url) as string;
    const pageHost = parseUrl(page.url)?.hostname.toLowerCase() ?? targetHost;

    for (const resource of page.resources) {
      references += 1;
      // Only web resources are inventoried. data:, javascript:, ftp: and the
      // like are not fetchable page resources and have no meaningful party.
      const webScheme = resource.protocol === 'http:' || resource.protocol === 'https:';
      if (!resource.resolvable || resource.isDataUri || !resource.url || !webScheme) {
        unresolved += 1;
        continue;
      }
      const url = resourceKey(resource.url);
      if (!url) {
        unresolved += 1;
        continue;
      }

      const key = `${resource.type}|${url}`;
      let acc = accumulators.get(key);
      if (!acc) {
        acc = {
          id: stableId('rs', key),
          url: safeText(url, 300),
          type: resource.type,
          origin: resource.origin,
          host: resource.host ? safeText(resource.host.toLowerCase(), 253) : null,
          protocol: resource.protocol,
          relationship: relationshipOf(resource, page.origin, pageHost),
          pageIds: new Set(),
          pageUrls: new Set(),
          references: 0,
          everyHasIntegrity: true,
          crossOriginAttr: resource.crossOriginAttr,
          crossOrigin: resource.crossOrigin,
          sriMeaningful: false,
          unsandboxedFrame: false,
          integrityWithoutCors: false
        };
        accumulators.set(key, acc);
      }

      acc.pageIds.add(pageId);
      acc.pageUrls.add(safePageUrl.get(page.url) as string);
      acc.references += 1;
      if (!resource.integrity) acc.everyHasIntegrity = false;
      if (acc.crossOriginAttr === null && resource.crossOriginAttr !== null) {
        acc.crossOriginAttr = resource.crossOriginAttr;
      }
      if (sriIsMeaningful(resource)) acc.sriMeaningful = true;
      if (resource.integrity && !resource.crossOriginAttr && resource.crossOrigin) {
        acc.integrityWithoutCors = true;
      }
      if (resource.type === 'iframe' && resource.crossOrigin && resource.sandbox === null) {
        acc.unsandboxedFrame = true;
      }
    }
  }

  /* ----- finding links ------------------------------------------------- */

  const resourceIdsByUrl = new Map<string, string[]>();
  for (const acc of accumulators.values()) {
    const list = resourceIdsByUrl.get(acc.url) ?? [];
    list.push(acc.id);
    resourceIdsByUrl.set(acc.url, list);
  }

  const findingsByResource = new Map<string, Set<string>>();
  const findingsByPage = new Map<string, Set<string>>();
  const levelByFinding = new Map<string, IssueLevel>();
  const linkedFindings = new Set<string>();

  const link = (map: Map<string, Set<string>>, id: string, findingId: string) => {
    const set = map.get(id) ?? new Set<string>();
    set.add(findingId);
    map.set(id, set);
  };

  for (const finding of assessment.findings) {
    const level = issueLevelOf(finding.status);
    if (level === 'none') continue;
    levelByFinding.set(finding.id, level);

    for (const ref of finding.affectedResources ?? []) {
      for (const id of resourceIdsByUrl.get(safeText(ref, 300)) ?? []) {
        link(findingsByResource, id, finding.id);
        linkedFindings.add(finding.id);
      }
    }
    for (const pageUrl of finding.affectedPages) {
      for (const pageId of pageIdsBySafeUrl.get(safeText(pageUrl, 300)) ?? []) {
        link(findingsByPage, pageId, finding.id);
        linkedFindings.add(finding.id);
      }
    }
  }

  const levelFor = (ids: Iterable<string> | undefined): IssueLevel =>
    maxLevel([...(ids ?? [])].map((id) => levelByFinding.get(id) ?? 'none'));

  /* ----- resources ----------------------------------------------------- */

  const resources: AssetResource[] = [];
  for (const acc of accumulators.values()) {
    const crossOrigin = crossOriginStatus(acc.crossOriginAttr);
    const integrityApplies =
      acc.crossOrigin && (acc.type === 'script' || acc.type === 'stylesheet');
    const integrity: IntegrityStatus = !integrityApplies
      ? 'not-applicable'
      : acc.everyHasIntegrity
        ? 'present'
        : 'missing';

    const observations: ResourceObservationId[] = [];
    if (acc.protocol === 'http:') observations.push('plaintext-http');
    if (acc.sriMeaningful && !acc.everyHasIntegrity) observations.push('no-integrity');
    if (acc.integrityWithoutCors) observations.push('integrity-without-crossorigin');
    if (acc.unsandboxedFrame) observations.push('iframe-no-sandbox');

    const findingIds = [...(findingsByResource.get(acc.id) ?? [])].sort();
    const pageUrls = [...acc.pageUrls].sort();

    resources.push({
      id: acc.id,
      url: acc.url,
      type: acc.type,
      group: typeGroupOf(acc.type),
      origin: acc.origin,
      host: acc.host,
      protocol: acc.protocol,
      relationship: acc.relationship,
      pageIds: [...acc.pageIds].sort(),
      pageUrls,
      referenceCount: acc.references,
      integrity,
      crossOrigin,
      observations,
      findingIds,
      issueLevel: levelFor(findingIds),
      searchText: [acc.url, acc.host ?? '', acc.type, RESOURCE_GROUP_LABELS[typeGroupOf(acc.type)], acc.relationship, ...pageUrls]
        .join(' ')
        .toLowerCase()
    });
  }
  resources.sort((a, b) => a.url.localeCompare(b.url) || a.type.localeCompare(b.type));

  /* ----- domains ------------------------------------------------------- */

  const domainAcc = new Map<
    string,
    {
      host: string;
      relationship: PartyRelationship;
      resources: AssetResource[];
      pageIds: Set<string>;
      pageUrls: Set<string>;
      protocols: Set<string>;
      origins: Set<string>;
    }
  >();
  for (const resource of resources) {
    if (!resource.host || resource.relationship === 'first-party') continue;
    const entry = domainAcc.get(resource.host) ?? {
      host: resource.host,
      relationship: resource.relationship,
      resources: [],
      pageIds: new Set<string>(),
      pageUrls: new Set<string>(),
      protocols: new Set<string>(),
      origins: new Set<string>()
    };
    entry.resources.push(resource);
    for (const id of resource.pageIds) entry.pageIds.add(id);
    for (const url of resource.pageUrls) entry.pageUrls.add(url);
    if (resource.protocol) entry.protocols.add(resource.protocol.replace(':', ''));
    if (resource.origin) entry.origins.add(safeText(resource.origin, 300));
    domainAcc.set(resource.host, entry);
  }

  const domains: AssetDomain[] = [...domainAcc.values()].map((entry) => {
    const byType: Partial<Record<ResourceType, number>> = {};
    const findingIds = new Set<string>();
    for (const resource of entry.resources) {
      byType[resource.type] = (byType[resource.type] ?? 0) + 1;
      for (const id of resource.findingIds) findingIds.add(id);
    }
    const sortedFindings = [...findingIds].sort();
    return {
      id: stableId('dm', entry.host),
      host: entry.host,
      relationship: entry.relationship,
      kind: classifyDomain(entry.host),
      resourceIds: entry.resources.map((resource) => resource.id),
      resourceCount: entry.resources.length,
      byType,
      pageIds: [...entry.pageIds].sort(),
      pageUrls: [...entry.pageUrls].sort(),
      protocols: [...entry.protocols].sort(),
      origins: [...entry.origins].sort(),
      usesHttp: entry.protocols.has('http'),
      findingIds: sortedFindings,
      issueLevel: levelFor(sortedFindings)
    };
  });
  domains.sort((a, b) => b.resourceCount - a.resourceCount || a.host.localeCompare(b.host));

  /* ----- pages --------------------------------------------------------- */

  const resourceIdsByPage = new Map<string, string[]>();
  for (const resource of resources) {
    for (const pageId of resource.pageIds) {
      const list = resourceIdsByPage.get(pageId) ?? [];
      list.push(resource.id);
      resourceIdsByPage.set(pageId, list);
    }
  }

  const assetPages: AssetPage[] = pages.map((page) => {
    const id = pageIdByUrl.get(page.url) as string;
    const linked = new Set<string>();
    for (const pageLink of page.links) {
      const target = pageIdByUrl.get(pageLink.url);
      if (target && target !== id) linked.add(target);
    }
    const findingIds = [...(findingsByPage.get(id) ?? [])].sort();
    return {
      id,
      url: safePageUrl.get(page.url) as string,
      depth: page.depth,
      title: page.title ? safeText(page.title, 120) : null,
      resourceIds: resourceIdsByPage.get(id) ?? [],
      linkedPageIds: [...linked].sort(),
      findingIds,
      issueLevel: levelFor(findingIds)
    };
  });

  /* ----- stats --------------------------------------------------------- */

  const count = (predicate: (resource: AssetResource) => boolean) =>
    resources.filter(predicate).length;

  const stats: AssetStats = {
    pagesCrawled: pages.length,
    inlineScripts: pages.reduce((sum, page) => sum + page.inlineScriptCount, 0),
    resourcesDiscovered: resources.length,
    resourceReferences: references,
    unresolvedReferences: unresolved,
    javascript: count((r) => r.type === 'script'),
    css: count((r) => r.type === 'stylesheet'),
    images: count((r) => r.type === 'image'),
    fonts: count((r) => r.type === 'font'),
    iframes: count((r) => r.type === 'iframe'),
    media: count((r) => r.type === 'media'),
    objectsAndEmbeds: count((r) => r.type === 'object' || r.type === 'embed'),
    other: count((r) => r.group === 'other' && r.type !== 'object' && r.type !== 'embed'),
    firstParty: count((r) => r.relationship === 'first-party'),
    sameSite: count((r) => r.relationship === 'same-site'),
    thirdParty: count((r) => r.relationship === 'third-party'),
    http: count((r) => r.protocol === 'http:'),
    https: count((r) => r.protocol === 'https:'),
    externalDomains: domains.length
  };

  return {
    target: { url: safeText(sanitizeUrlForEvidence(assessment.target.url), 300), host: safeText(targetHost, 253) },
    pages: assetPages,
    resources,
    domains,
    stats,
    linkedFindingIds: [...linkedFindings].sort()
  };
}

export interface AssetIndex {
  pageById: ReadonlyMap<string, AssetPage>;
  resourceById: ReadonlyMap<string, AssetResource>;
  domainById: ReadonlyMap<string, AssetDomain>;
  domainByHost: ReadonlyMap<string, AssetDomain>;
}

/** Id lookups for the detail views. */
export function indexAssetModel(model: AssetModel): AssetIndex {
  return {
    pageById: new Map(model.pages.map((page) => [page.id, page])),
    resourceById: new Map(model.resources.map((resource) => [resource.id, resource])),
    domainById: new Map(model.domains.map((domain) => [domain.id, domain])),
    domainByHost: new Map(model.domains.map((domain) => [domain.host, domain]))
  };
}
