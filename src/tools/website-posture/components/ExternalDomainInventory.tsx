import React, { useMemo, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { AssetModel } from '../logic/report/assetModel';
import { filterDomains, paginate } from '../logic/report/inventoryFilters';
import {
  DOMAIN_KIND_LABELS,
  FOCUS_RING,
  RELATIONSHIP_LABELS,
  RESOURCE_TYPE_LABELS,
  pluralize
} from './presentation';

const PAGE_SIZE = 15;

export interface ExternalDomainInventoryProps {
  model: AssetModel;
  onShowResources?: (host: string) => void;
  onShowInMap?: (nodeId: string) => void;
}

/**
 * Hostnames other than the target's own that pages reference. The kind label
 * comes from a small built-in hostname list; nothing is inferred about what a
 * domain actually does with a request.
 */
export const ExternalDomainInventory: React.FC<ExternalDomainInventoryProps> = ({
  model,
  onShowResources,
  onShowInMap
}) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => filterDomains(model.domains, query), [model.domains, query]);
  const view = paginate(rows, page, PAGE_SIZE);

  if (model.domains.length === 0) {
    return <p className="text-sm text-slate-400">No resources from other hostnames were referenced.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="domain-search" className="text-xs font-mono text-slate-400">
          Search domains
        </label>
        <input
          id="domain-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          autoComplete="off"
          spellCheck={false}
          className={`w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 focus:border-emerald-500 ${FOCUS_RING}`}
        />
      </div>

      <p className="text-[11px] font-mono text-slate-500" role="status" aria-live="polite">
        {view.total === 0 ? 'No domains match.' : `Showing ${view.start}–${view.end} of ${view.total} ${pluralize(view.total, 'domain')}`}
      </p>

      {view.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">External hostnames referenced by the pages that were read</caption>
            <thead className="bg-slate-900 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="p-2">Hostname</th>
                <th scope="col" className="p-2">Party</th>
                <th scope="col" className="p-2">Resources</th>
                <th scope="col" className="p-2 hidden md:table-cell">Pages</th>
                <th scope="col" className="p-2 hidden sm:table-cell">Scheme</th>
                <th scope="col" className="p-2">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {view.items.map((domain) => (
                <tr key={domain.id} className="align-top hover:bg-slate-900/50">
                  <th scope="row" className="p-2 font-mono font-normal text-slate-200 break-all">
                    {domain.host}
                    <span className="block text-[10px] text-slate-500">{DOMAIN_KIND_LABELS[domain.kind]}</span>
                    {domain.origins.length > 1 && (
                      <span className="block text-[10px] text-slate-500 break-all">
                        {domain.origins.length} origins: {domain.origins.join(', ')}
                      </span>
                    )}
                  </th>
                  <td className="p-2 text-slate-300">{RELATIONSHIP_LABELS[domain.relationship]}</td>
                  <td className="p-2 text-slate-300">
                    <span className="tabular-nums">{domain.resourceCount}</span>
                    <span className="block text-[10px] text-slate-500">
                      {Object.entries(domain.byType)
                        .map(([type, count]) => `${count} ${RESOURCE_TYPE_LABELS[type as keyof typeof RESOURCE_TYPE_LABELS]}`)
                        .join(', ')}
                    </span>
                  </td>
                  <td className="p-2 hidden md:table-cell tabular-nums text-slate-300">{domain.pageIds.length}</td>
                  <td className="p-2 hidden sm:table-cell">
                    {domain.usesHttp ? (
                      <Badge variant="medium" size="sm">
                        <span aria-hidden="true">! </span>HTTP used
                      </Badge>
                    ) : (
                      <span className="font-mono text-slate-300">{domain.protocols.join(', ') || '—'}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="tabular-nums text-slate-300">{domain.findingIds.length}</span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {onShowResources && (
                        <button
                          type="button"
                          onClick={() => onShowResources(domain.host)}
                          aria-label={`Show resources from ${domain.host}`}
                          className={`px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white ${FOCUS_RING}`}
                        >
                          Resources
                        </button>
                      )}
                      {onShowInMap && (
                        <button
                          type="button"
                          onClick={() => onShowInMap(domain.id)}
                          aria-label={`Show ${domain.host} in the asset map`}
                          className={`px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white ${FOCUS_RING}`}
                        >
                          Map
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.pageCount > 1 && (
        <nav aria-label="Domain table pages" className="flex items-center justify-between gap-2 text-xs font-mono">
          <button type="button" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)} className={`px-3 py-1.5 rounded border border-slate-700 text-slate-300 disabled:opacity-40 ${FOCUS_RING}`}>
            Previous
          </button>
          <span className="text-slate-400">Page {view.page} of {view.pageCount}</span>
          <button type="button" disabled={view.page >= view.pageCount} onClick={() => setPage(view.page + 1)} className={`px-3 py-1.5 rounded border border-slate-700 text-slate-300 disabled:opacity-40 ${FOCUS_RING}`}>
            Next
          </button>
        </nav>
      )}
    </div>
  );
};
