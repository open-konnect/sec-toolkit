import React from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { SecurityAssessment } from '../types';
import { countByStatus } from '../logic/aggregation';
import { sanitizeUrlForEvidence } from '../logic/findings';
import { safeText } from '../logic/report/text';
import { CoverageSummary } from './CoverageSummary';
import { SecurityScore } from './SecurityScore';
import { STATUS_BADGES, STATUS_LABELS, STATUS_MARKS, pluralize } from './presentation';

const MODE_LABELS: Record<SecurityAssessment['mode'], string> = {
  'browser-passive': 'Browser · passive',
  'server-passive': 'Server · passive',
  'verified-active': 'Verified · active'
};

const COUNT_ORDER = ['fail', 'warning', 'info', 'pass', 'unable-to-verify'] as const;

export interface AssessmentSummaryProps {
  assessment: SecurityAssessment;
}

/** Report header, score and coverage side by side, and finding counts. */
export const AssessmentSummary: React.FC<AssessmentSummaryProps> = ({ assessment }) => {
  const counts = countByStatus(assessment.findings);
  const attention = counts.fail + counts.warning;
  const completed = new Date(assessment.completedAt);
  const when = Number.isNaN(completed.getTime()) ? '' : completed.toLocaleString();

  return (
    <section aria-labelledby="report-title" className="space-y-4">
      <header className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" size="sm">
            <Eye className="w-3 h-3 inline mr-1" aria-hidden="true" />
            {MODE_LABELS[assessment.mode]}
          </Badge>
          <Badge variant="outline" size="sm">
            Runs in this browser tab
          </Badge>
        </div>
        <h2 id="report-title" className="text-lg font-bold text-white tracking-tight">
          Website security posture report
        </h2>
        <p className="font-mono text-sm text-emerald-300 break-all">{safeText(sanitizeUrlForEvidence(assessment.target.url), 300)}</p>
        <p className="text-[11px] font-mono text-slate-500">
          {when && `${when} · `}
          {(assessment.durationMs / 1000).toFixed(1)}s
        </p>
        <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>
            Analysis, scoring and this report ran in your browser. Findings were not uploaded and the target is
            not sent to analytics. In Scan URL mode the pages were fetched by this site's stateless relay, which
            does not store or log them.
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SecurityScore score={assessment.score} />
        <CoverageSummary coverage={assessment.coverage} discovery={assessment.discovery} />
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        The score reflects problems seen in the checks that ran. Coverage is how many checks could run at
        all. A high score with low coverage means little was verifiable, not that little is wrong.
      </p>

      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <p className="text-sm text-slate-200">
          {assessment.coverage.performed} {pluralize(assessment.coverage.performed, 'check')} performed.{' '}
          {attention === 0
            ? 'No issues detected in the checks performed.'
            : `${attention} ${pluralize(attention, 'finding')} need attention.`}
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {COUNT_ORDER.map((status) => (
            <li key={status} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="block text-xl font-bold tabular-nums text-white">{counts[status]}</span>
              <Badge variant={STATUS_BADGES[status]} size="sm">
                <span aria-hidden="true" className="mr-1">
                  {STATUS_MARKS[status]}
                </span>
                {STATUS_LABELS[status]}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
