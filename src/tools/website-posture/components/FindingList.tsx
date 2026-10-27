import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AggregatedFinding, FindingStatus } from '../types';
import {
  CategoryHealth,
  CategorySummary,
  reportCategoryOf,
  summarizeCategories
} from '../logic/report/reportCategories';
import { FindingCard } from './FindingCard';
import { FOCUS_RING, STATUS_LABELS, pluralize } from './presentation';

type StatusFilter = 'all' | FindingStatus;

const FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'fail', label: 'Issues' },
  { id: 'warning', label: 'Worth reviewing' },
  { id: 'info', label: 'Informational' },
  { id: 'pass', label: 'No issue detected' },
  { id: 'unable-to-verify', label: 'Unable to verify' },
  { id: 'not-applicable', label: 'Not applicable' }
];

const HEALTH_TEXT: Record<CategoryHealth, string> = {
  fail: 'Issue detected',
  warning: 'Worth reviewing',
  info: 'Informational only',
  pass: 'No issue detected in the checks performed',
  unverified: 'Could not be verified',
  none: 'Nothing to report'
};

export interface FindingListProps {
  findings: readonly AggregatedFinding[];
  resourceIdsByUrl?: ReadonlyMap<string, readonly string[]>;
  onShowResource?: (resourceId: string) => void;
  /** A finding to scroll to and open, from links in other sections. */
  focusFindingId?: string | null;
}

function countsLine(summary: CategorySummary): string {
  const parts: string[] = [];
  if (summary.counts.fail) parts.push(`${summary.counts.fail} ${pluralize(summary.counts.fail, 'issue')}`);
  if (summary.counts.warning) parts.push(`${summary.counts.warning} to review`);
  if (summary.counts.info) parts.push(`${summary.counts.info} info`);
  if (summary.counts.pass) parts.push(`${summary.counts.pass} clear`);
  if (summary.counts['unable-to-verify']) parts.push(`${summary.counts['unable-to-verify']} unverified`);
  if (summary.counts['not-applicable']) parts.push(`${summary.counts['not-applicable']} n/a`);
  return parts.join(' · ');
}

/**
 * Findings grouped by category. Categories that contain something to look at
 * start open; the rest stay collapsed so a clean report stays short.
 */
export const FindingList: React.FC<FindingListProps> = ({
  findings,
  resourceIdsByUrl,
  onShowResource,
  focusFindingId = null
}) => {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? findings : findings.filter((finding) => finding.status === filter)),
    [findings, filter]
  );
  const summaries = useMemo(() => summarizeCategories(filtered), [filtered]);

  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(summarizeCategories(findings).filter((s) => s.attention > 0).map((s) => s.id))
  );

  useEffect(() => {
    if (!focusFindingId) return;
    const target = findings.find((finding) => finding.id === focusFindingId);
    if (!target) return;
    setFilter('all');
    setOpen((previous) => new Set(previous).add(reportCategoryOf(target.category)));
  }, [focusFindingId, findings]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: findings.length };
    for (const finding of findings) result[finding.status] = (result[finding.status] ?? 0) + 1;
    return result;
  }, [findings]);

  if (findings.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No findings were produced. That usually means nothing could be read from the target.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter findings by status" className="flex flex-wrap gap-1.5">
        {FILTERS.filter((item) => item.id === 'all' || counts[item.id]).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`px-2.5 py-1 rounded-md border text-xs font-mono ${FOCUS_RING} ${
              filter === item.id
                ? 'bg-slate-800 border-emerald-600 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label} <span className="tabular-nums">({counts[item.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {summaries.map((summary) => {
        const isOpen = open.has(summary.id);
        const Chevron = isOpen ? ChevronDown : ChevronRight;
        const panelId = `category-${summary.id}`;
        return (
          <section key={summary.id} className="rounded-2xl border border-slate-800 bg-slate-900/30">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() =>
                  setOpen((previous) => {
                    const next = new Set(previous);
                    if (next.has(summary.id)) next.delete(summary.id);
                    else next.add(summary.id);
                    return next;
                  })
                }
                className={`w-full flex items-start gap-3 p-4 text-left rounded-2xl hover:bg-slate-900/60 ${FOCUS_RING}`}
              >
                <Chevron className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 space-y-1 block">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-bold text-white">{summary.label}</span>
                    <span className="text-[11px] font-mono text-slate-400 font-normal">
                      {HEALTH_TEXT[summary.health]}
                    </span>
                  </span>
                  <span className="block text-[11px] font-mono text-slate-500 font-normal">
                    {countsLine(summary)}
                  </span>
                </span>
              </button>
            </h3>
            {isOpen && (
              <div id={panelId} className="px-4 pb-4 space-y-2">
                <p className="text-xs text-slate-500 leading-relaxed">{summary.description}</p>
                {summary.findings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    defaultExpanded={finding.status === 'fail'}
                    forceOpen={focusFindingId === finding.id}
                    resourceIdsByUrl={resourceIdsByUrl}
                    onShowResource={onShowResource}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {summaries.length === 0 && (
        <p className="text-sm text-slate-400">
          No findings with the status “{STATUS_LABELS[filter as FindingStatus]}”.
        </p>
      )}
    </div>
  );
};
