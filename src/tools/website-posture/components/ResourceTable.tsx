import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { AggregatedFinding } from '../types';
import { AssetModel, RESOURCE_OBSERVATION_LABELS } from '../logic/report/assetModel';
import {
  RESOURCE_FILTERS,
  ResourceFilterId,
  countByFilter,
  filterResources,
  paginate
} from '../logic/report/inventoryFilters';
import { findingDomId } from './FindingCard';
import {
  FOCUS_RING,
  ISSUE_LEVEL_LABELS,
  RELATIONSHIP_LABELS,
  RESOURCE_TYPE_LABELS,
  pluralize
} from './presentation';

const PAGE_SIZE = 25;

export function resourceRowId(resourceId: string): string {
  return `inv-${resourceId}`;
}

export interface ResourceTableProps {
  model: AssetModel;
  findingsById: ReadonlyMap<string, AggregatedFinding>;
  selectedResourceId: string | null;
  onShowInMap?: (nodeId: string) => void;
  onShowFinding?: (findingId: string) => void;
  /** Applied from outside, e.g. by a domain's "show resources" button. */
  hostFilter?: string | null;
}

/**
 * Searchable, filterable, paginated list of every resource referenced by the
 * pages that were read. This is the authoritative detail view; the graph is an
 * optional extra on top of it.
 */
export const ResourceTable: React.FC<ResourceTableProps> = ({
  model,
  findingsById,
  selectedResourceId,
  onShowInMap,
  onShowFinding,
  hostFilter = null
}) => {
  const [filter, setFilter] = useState<ResourceFilterId>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (hostFilter) {
      setFilter('all');
      setQuery(hostFilter);
      setPage(1);
    }
  }, [hostFilter]);

  const filterCounts = useMemo(() => countByFilter(model.resources), [model.resources]);
  const rows = useMemo(
    () => filterResources(model.resources, filter, query),
    [model.resources, filter, query]
  );
  const view = paginate(rows, page, PAGE_SIZE);

  // Bring an externally selected resource into view and open its details.
  useEffect(() => {
    if (!selectedResourceId) return;
    const target = model.resources.find((resource) => resource.id === selectedResourceId);
    if (!target) return;
    setFilter('all');
    setQuery('');
    setExpanded((previous) => new Set(previous).add(selectedResourceId));
    const index = model.resources.findIndex((resource) => resource.id === selectedResourceId);
    setPage(Math.floor(index / PAGE_SIZE) + 1);
  }, [selectedResourceId, model.resources]);

  useEffect(() => {
    if (!selectedResourceId || typeof document === 'undefined') return;
    const element = document.getElementById(resourceRowId(selectedResourceId));
    element?.scrollIntoView?.({ block: 'center' });
  }, [selectedResourceId, view.page, filter, query]);

  if (model.resources.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No resources were referenced by the pages that were read, so there is nothing to list.
      </p>
    );
  }

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="resource-search" className="text-xs font-mono text-slate-400">
          Search resources
        </label>
        <input
          id="resource-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="URL, hostname, type or referring page"
          autoComplete="off"
          spellCheck={false}
          className={`w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 ${FOCUS_RING}`}
        />
      </div>

      <div role="group" aria-label="Filter resources" className="flex flex-wrap gap-1.5">
        {RESOURCE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => {
              setFilter(item.id);
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-md border text-xs font-mono ${FOCUS_RING} ${
              filter === item.id
                ? 'bg-slate-800 border-emerald-600 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label} <span className="tabular-nums">({filterCounts[item.id]})</span>
          </button>
        ))}
      </div>

      <p className="text-[11px] font-mono text-slate-500" role="status" aria-live="polite">
        {view.total === 0
          ? 'No resources match.'
          : `Showing ${view.start}–${view.end} of ${view.total} ${pluralize(view.total, 'resource')}`}
      </p>

      {view.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Resources referenced by the pages that were read. Listed from page markup; none were downloaded.
            </caption>
            <thead className="bg-slate-900 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="p-2 w-8">
                  <span className="sr-only">Details</span>
                </th>
                <th scope="col" className="p-2">Resource</th>
                <th scope="col" className="p-2 hidden sm:table-cell">Type</th>
                <th scope="col" className="p-2 hidden md:table-cell">Party</th>
                <th scope="col" className="p-2 hidden md:table-cell">Scheme</th>
                <th scope="col" className="p-2">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {view.items.flatMap((resource) => {
                const isOpen = expanded.has(resource.id);
                const Chevron = isOpen ? ChevronDown : ChevronRight;
                const selected = resource.id === selectedResourceId;
                const flagged = resource.findingIds.length + resource.observations.length;
                const detailsId = `${resourceRowId(resource.id)}-details`;
                const rowsOut = [
                  <tr
                    key={resource.id}
                    id={resourceRowId(resource.id)}
                    className={selected ? 'bg-emerald-950/30' : 'hover:bg-slate-900/50'}
                  >
                    <td className="p-2 align-top">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${resource.url}`}
                        onClick={() => toggle(resource.id)}
                        className={`rounded p-0.5 text-slate-400 hover:text-white ${FOCUS_RING}`}
                      >
                        <Chevron className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="p-2 align-top font-mono text-slate-200 break-all min-w-[12rem]">
                      {resource.url}
                      <span className="sm:hidden block text-[10px] text-slate-500 mt-0.5">
                        {RESOURCE_TYPE_LABELS[resource.type]} · {RELATIONSHIP_LABELS[resource.relationship]}
                      </span>
                    </td>
                    <td className="p-2 align-top hidden sm:table-cell text-slate-300">
                      {RESOURCE_TYPE_LABELS[resource.type]}
                    </td>
                    <td className="p-2 align-top hidden md:table-cell text-slate-300">
                      {RELATIONSHIP_LABELS[resource.relationship]}
                    </td>
                    <td className="p-2 align-top hidden md:table-cell font-mono text-slate-300">
                      {resource.protocol ? resource.protocol.replace(':', '') : '—'}
                    </td>
                    <td className="p-2 align-top whitespace-nowrap">
                      {flagged === 0 ? (
                        <span className="text-slate-500">None</span>
                      ) : (
                        <Badge variant={resource.issueLevel === 'fail' ? 'critical' : resource.issueLevel === 'warning' ? 'medium' : 'info'} size="sm">
                          {flagged} {ISSUE_LEVEL_LABELS[resource.issueLevel] ?? 'noted'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ];
                if (isOpen) {
                  rowsOut.push(
                    <tr key={`${resource.id}-details`} id={detailsId} className="bg-slate-950/60">
                      <td />
                      <td colSpan={5} className="p-3 space-y-3">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <dt className="text-slate-500">Host</dt>
                          <dd className="font-mono text-slate-300 break-all">{resource.host ?? '—'}</dd>
                          <dt className="text-slate-500">References</dt>
                          <dd className="text-slate-300">{resource.referenceCount}</dd>
                          <dt className="text-slate-500">Integrity hash</dt>
                          <dd className="text-slate-300">{resource.integrity}</dd>
                          <dt className="text-slate-500">crossorigin</dt>
                          <dd className="text-slate-300">{resource.crossOrigin}</dd>
                        </dl>
                        {resource.observations.length > 0 && (
                          <ul className="list-disc pl-4 text-[11px] text-amber-300 space-y-0.5">
                            {resource.observations.map((observation) => (
                              <li key={observation}>{RESOURCE_OBSERVATION_LABELS[observation]}</li>
                            ))}
                          </ul>
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            Referenced by
                          </span>
                          <ul className="space-y-0.5">
                            {resource.pageUrls.map((url) => (
                              <li key={url} className="font-mono text-[11px] text-slate-400 break-all">
                                {url}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {resource.findingIds.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                              {resource.findingIds.length} {pluralize(resource.findingIds.length, 'finding')} affect this resource
                            </span>
                            <ul className="space-y-1">
                              {resource.findingIds.map((id) => {
                                const finding = findingsById.get(id);
                                if (!finding) return null;
                                return (
                                  <li key={id}>
                                    <button
                                      type="button"
                                      onClick={() => onShowFinding?.(id)}
                                      aria-label={`Go to finding: ${finding.title}`}
                                      className={`text-left text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ${FOCUS_RING}`}
                                      data-target={findingDomId(id)}
                                    >
                                      {finding.title}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {onShowInMap && (
                          <button
                            type="button"
                            onClick={() => onShowInMap(resource.id)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white hover:border-slate-500 ${FOCUS_RING}`}
                          >
                            <Network className="w-3 h-3" aria-hidden="true" />
                            Show in asset map
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                return rowsOut;
              })}
            </tbody>
          </table>
        </div>
      )}

      {view.pageCount > 1 && (
        <nav aria-label="Resource table pages" className="flex items-center justify-between gap-2 text-xs font-mono">
          <button
            type="button"
            disabled={view.page <= 1}
            onClick={() => setPage(view.page - 1)}
            className={`px-3 py-1.5 rounded border border-slate-700 text-slate-300 disabled:opacity-40 ${FOCUS_RING}`}
          >
            Previous
          </button>
          <span className="text-slate-400">
            Page {view.page} of {view.pageCount}
          </span>
          <button
            type="button"
            disabled={view.page >= view.pageCount}
            onClick={() => setPage(view.page + 1)}
            className={`px-3 py-1.5 rounded border border-slate-700 text-slate-300 disabled:opacity-40 ${FOCUS_RING}`}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
};
