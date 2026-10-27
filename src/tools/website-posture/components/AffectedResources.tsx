import React, { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { AggregatedFinding } from '../types';
import { FOCUS_RING, pluralize } from './presentation';

const INITIAL_VISIBLE = 6;

export interface AffectedResourcesProps {
  finding: AggregatedFinding;
  /** Resource URL (as the finding stores it) to inventory ids. */
  resourceIdsByUrl: ReadonlyMap<string, readonly string[]>;
  onShowResource?: (resourceId: string) => void;
}

/**
 * Resources a finding refers to, each linking back to the inventory.
 * URLs are rendered as plain text and are origin plus path only.
 */
export const AffectedResources: React.FC<AffectedResourcesProps> = ({
  finding,
  resourceIdsByUrl,
  onShowResource
}) => {
  const [showAll, setShowAll] = useState(false);
  if (finding.affectedResources.length === 0) return null;

  const visible = showAll
    ? finding.affectedResources
    : finding.affectedResources.slice(0, INITIAL_VISIBLE);
  const hidden = finding.affectedResources.length - visible.length;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
        Affected {pluralize(finding.affectedResourceCount, 'resource')} ({finding.affectedResourceCount})
      </span>
      <ul className="space-y-1">
        {visible.map((url) => {
          const ids = resourceIdsByUrl.get(url) ?? [];
          return (
            <li key={url} className="flex items-start gap-2">
              <span className="font-mono text-[11px] text-slate-300 break-all flex-1 min-w-0">{url}</span>
              {ids.length > 0 && onShowResource && (
                <button
                  type="button"
                  onClick={() => onShowResource(ids[0])}
                  aria-label={`Show ${url} in the asset inventory`}
                  className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white hover:border-slate-500 ${FOCUS_RING}`}
                >
                  <Crosshair className="w-3 h-3" aria-hidden="true" />
                  Inventory
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ${FOCUS_RING}`}
        >
          Show {hidden} more
        </button>
      )}
      {finding.affectedResourcesTruncated && showAll && (
        <p className="text-[11px] text-slate-500">
          The list is capped for display; the count above is complete.
        </p>
      )}
    </div>
  );
};
