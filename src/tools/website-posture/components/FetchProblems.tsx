import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { SecurityAssessment } from '../types';
import { summarizeFetchProblems } from '../logic/report/fetchProblems';
import { pluralize } from './presentation';

/** Why some pages are missing from the report. Renders nothing when every page was read. */
export const FetchProblems: React.FC<{ assessment: SecurityAssessment }> = ({ assessment }) => {
  const summary = summarizeFetchProblems(assessment);
  if (summary.problems.length === 0 && !summary.nothingRead) return null;

  return (
    <section
      aria-labelledby="fetch-problems-title"
      role={summary.nothingRead ? 'alert' : 'status'}
      className="p-4 rounded-xl border border-amber-800/50 bg-amber-950/20 space-y-2"
    >
      <h3 id="fetch-problems-title" className="flex items-center gap-2 text-sm font-bold text-amber-300">
        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        {summary.nothingRead ? 'No page could be read' : 'Some pages could not be read'}
      </h3>
      {summary.nothingRead && (
        <p className="text-xs text-slate-300 leading-relaxed">
          Without a page there are no assets, domains or findings to show. This describes the connection to the
          site, not the site&apos;s security.
        </p>
      )}
      {summary.problems.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-300">
          {summary.problems.map((problem, position) => (
            <li key={`${problem.url}-${position}`}>
              <span className="font-mono text-slate-200 break-all">{problem.url}</span> — {problem.reason}
            </li>
          ))}
          {summary.omitted > 0 && (
            <li>
              and {summary.omitted} more {pluralize(summary.omitted, 'page')}.
            </li>
          )}
        </ul>
      )}
      {summary.suggestion && (
        <p className="text-xs text-slate-300 leading-relaxed">
          Some sites only answer on their <code className="font-mono">www</code> address. Try{' '}
          <span className="font-mono text-emerald-300 break-all">{summary.suggestion}</span>.
        </p>
      )}
    </section>
  );
};
