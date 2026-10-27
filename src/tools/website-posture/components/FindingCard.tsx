import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { AggregatedFinding } from '../types';
import { stableId } from '../logic/report/text';
import { AffectedResources } from './AffectedResources';
import {
  CATEGORY_LABELS,
  FOCUS_RING,
  OBSERVATION_HINTS,
  OBSERVATION_LABELS,
  SEVERITY_BADGES,
  SEVERITY_LABELS,
  STATUS_BADGES,
  STATUS_LABELS,
  STATUS_MARKS,
  pluralize
} from './presentation';

/** DOM id for a finding card, so other sections can scroll to it. */
export function findingDomId(findingId: string): string {
  return stableId('fd', findingId);
}

export interface FindingCardProps {
  finding: AggregatedFinding;
  /** Open by default for findings that need attention. */
  defaultExpanded?: boolean;
  /** Opens the card when it becomes true, for links from other sections. */
  forceOpen?: boolean;
  resourceIdsByUrl?: ReadonlyMap<string, readonly string[]>;
  onShowResource?: (resourceId: string) => void;
}

const EMPTY_MAP: ReadonlyMap<string, readonly string[]> = new Map();

/**
 * One aggregated finding.
 *
 * Evidence values arrive pre-redacted and length-capped from the engine. They
 * are rendered as text only — never as markup — so target-derived strings stay
 * inert.
 */
export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  defaultExpanded = false,
  forceOpen = false,
  resourceIdsByUrl = EMPTY_MAP,
  onShowResource
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    if (forceOpen) setExpanded(true);
  }, [forceOpen]);

  const Chevron = expanded ? ChevronDown : ChevronRight;
  const showSeverity = finding.status === 'fail' || finding.status === 'warning';
  const panelId = `${findingDomId(finding.id)}-panel`;

  return (
    <article
      id={findingDomId(finding.id)}
      className={`rounded-xl border bg-slate-900/40 overflow-hidden ${
        forceOpen ? 'border-emerald-600' : 'border-slate-800'
      }`}
    >
      <h4>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`w-full p-4 text-left hover:bg-slate-900/70 transition-colors ${FOCUS_RING}`}
        >
          <span className="flex items-start gap-3">
            <Chevron className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="min-w-0 flex-1 space-y-2 block">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_BADGES[finding.status]} size="sm">
                  <span aria-hidden="true" className="mr-1">
                    {STATUS_MARKS[finding.status]}
                  </span>
                  {STATUS_LABELS[finding.status]}
                </Badge>
                {showSeverity && (
                  <Badge variant={SEVERITY_BADGES[finding.severity]} size="sm">
                    {SEVERITY_LABELS[finding.severity]} severity
                  </Badge>
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {CATEGORY_LABELS[finding.category]}
                </span>
              </span>
              <span className="block text-sm font-semibold text-white">{finding.title}</span>
              <span className="block text-xs text-slate-400 leading-relaxed font-normal">
                {finding.summary}
              </span>
              {(finding.affectedPageCount > 0 || finding.affectedResourceCount > 0) && (
                <span className="block text-[11px] font-mono text-slate-500 font-normal">
                  {finding.affectedPageCount > 0 &&
                    `${finding.affectedPageCount} ${pluralize(finding.affectedPageCount, 'page')}`}
                  {finding.affectedPageCount > 0 && finding.affectedResourceCount > 0 && ' · '}
                  {finding.affectedResourceCount > 0 &&
                    `${finding.affectedResourceCount} ${pluralize(finding.affectedResourceCount, 'resource')}`}
                </span>
              )}
            </span>
          </span>
        </button>
      </h4>

      {expanded && (
        <div id={panelId} className="px-4 pb-4 pl-11 space-y-4 border-t border-slate-800/80 pt-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {OBSERVATION_LABELS[finding.observation]} · {finding.confidence} confidence
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              {OBSERVATION_HINTS[finding.observation]} {finding.confidenceRationale}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Why it matters
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{finding.explanation}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              What to do
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{finding.recommendation}</p>
          </div>

          {finding.evidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Evidence{finding.evidenceTruncated ? ' (sample)' : ''}
              </span>
              <ul className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                {finding.evidence.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="p-2.5 space-y-0.5">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      {item.label}
                    </span>
                    <span className="block font-mono text-xs text-emerald-300 break-all">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AffectedResources
            finding={finding}
            resourceIdsByUrl={resourceIdsByUrl}
            onShowResource={onShowResource}
          />

          {finding.affectedPages.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Observed on {finding.affectedPageCount} of {finding.analyzedPageCount}{' '}
                {pluralize(finding.analyzedPageCount, 'page')}
              </span>
              <ul className="space-y-0.5">
                {finding.affectedPages.map((page) => (
                  <li key={page} className="font-mono text-[11px] text-slate-400 break-all">
                    {page}
                  </li>
                ))}
              </ul>
              {finding.affectedPagesTruncated && (
                <p className="text-[11px] text-slate-500">
                  The list above is capped for display; the count is complete.
                </p>
              )}
            </div>
          )}

          <p className="font-mono text-[10px] text-slate-500 break-all">
            Check: {finding.checkId}
            {finding.occurrences > 1 ? ` · ${finding.occurrences} observations` : ''}
            {finding.correlatedChecks ? ` · combines ${finding.correlatedChecks.join(', ')}` : ''}
          </p>
        </div>
      )}
    </article>
  );
};
