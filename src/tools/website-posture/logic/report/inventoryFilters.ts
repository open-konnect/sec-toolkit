/**
 * Filtering, searching and paging for the resource and domain tables.
 * Pure functions over the asset model, so the table component only renders.
 */

import { AssetDomain, AssetResource } from './assetModel';

export type ResourceFilterId =
  | 'all'
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'iframe'
  | 'media'
  | 'other'
  | 'first-party'
  | 'same-site'
  | 'third-party'
  | 'http'
  | 'https'
  | 'has-findings';

export const RESOURCE_FILTERS: ReadonlyArray<{ id: ResourceFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'script', label: 'JavaScript' },
  { id: 'stylesheet', label: 'CSS' },
  { id: 'image', label: 'Images' },
  { id: 'font', label: 'Fonts' },
  { id: 'iframe', label: 'Iframes' },
  { id: 'media', label: 'Media' },
  { id: 'other', label: 'Other' },
  { id: 'first-party', label: 'First-party' },
  { id: 'same-site', label: 'Same-site' },
  { id: 'third-party', label: 'Third-party' },
  { id: 'http', label: 'HTTP' },
  { id: 'https', label: 'HTTPS' },
  { id: 'has-findings', label: 'Has findings' }
];

export function matchesResourceFilter(resource: AssetResource, filter: ResourceFilterId): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'script':
    case 'stylesheet':
    case 'image':
    case 'font':
    case 'iframe':
    case 'media':
    case 'other':
      return resource.group === filter;
    case 'first-party':
    case 'same-site':
    case 'third-party':
      return resource.relationship === filter;
    case 'http':
      return resource.protocol === 'http:';
    case 'https':
      return resource.protocol === 'https:';
    case 'has-findings':
      return resource.findingIds.length > 0 || resource.observations.length > 0;
  }
}

/** Case-insensitive search across URL, host, type and referring pages. */
export function matchesQuery(searchText: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => searchText.includes(term));
}

export function filterResources(
  resources: readonly AssetResource[],
  filter: ResourceFilterId,
  query: string
): AssetResource[] {
  return resources.filter(
    (resource) => matchesResourceFilter(resource, filter) && matchesQuery(resource.searchText, query)
  );
}

/** How many resources each filter would show, for the filter chips. */
export function countByFilter(resources: readonly AssetResource[]): Record<ResourceFilterId, number> {
  const counts = {} as Record<ResourceFilterId, number>;
  for (const { id } of RESOURCE_FILTERS) {
    counts[id] = resources.filter((resource) => matchesResourceFilter(resource, id)).length;
  }
  return counts;
}

export function filterDomains(domains: readonly AssetDomain[], query: string): AssetDomain[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...domains];
  return domains.filter((domain) => {
    const text = `${domain.host} ${domain.kind} ${domain.relationship}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
}

/** 1-based page number; out-of-range values are clamped. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: current,
    pageCount,
    total: items.length,
    start: items.length === 0 ? 0 : start + 1,
    end: start + slice.length
  };
}
