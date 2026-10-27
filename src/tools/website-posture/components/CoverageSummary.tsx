import React from 'react';
import { AssessmentCoverage, DiscoveryReport } from '../types';
import { pluralize } from './presentation';

export interface CoverageSummaryProps {
  coverage: AssessmentCoverage;
  discovery: DiscoveryReport | null;
}

/** How much of the assessment could actually be carried out. Separate from the score. */
export const CoverageSummary: React.FC<CoverageSummaryProps> = ({ coverage, discovery }) => {
  const notices: string[] = [];
  if (discovery?.cancelled) notices.push('The run was cancelled, so pages after that point were not read.');
  if (discovery?.timedOut) notices.push('The page-discovery time budget ran out before every page was read.');
  if (discovery?.limitReached) notices.push('The page or depth limit stopped further discovery.');

  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Coverage</h3>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-bold tabular-nums text-sky-300">{Math.round(coverage.percent)}%</span>
        <span className="text-sm text-slate-500">of applicable checks</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {coverage.performed} of {coverage.performed + coverage.unableToVerify + coverage.errored} applicable{' '}
        {pluralize(coverage.performed + coverage.unableToVerify + coverage.errored, 'check')} reached a
        verdict across {coverage.pagesAnalyzed} {pluralize(coverage.pagesAnalyzed, 'page')}.
      </p>
      <dl className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
        {[
          { label: 'Pages analyzed', value: coverage.pagesAnalyzed },
          { label: 'Pages discovered', value: coverage.pagesDiscovered },
          { label: 'Not readable', value: coverage.pagesInaccessible },
          { label: 'Skipped', value: coverage.pagesSkipped }
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{item.label}</dt>
            <dd className="font-bold tabular-nums text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
      {notices.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-300" role="status">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
