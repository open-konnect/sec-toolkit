import React from 'react';
import { Check, Loader2, Square } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { AssessmentProgress as ProgressSnapshot } from '../types';
import { progressView } from '../logic/report/progressSteps';
import { pluralize } from './presentation';

export interface AssessmentProgressProps {
  progress: ProgressSnapshot | null;
  onCancel: () => void;
}

/** The 11-step progress list with a cancel control. Step state is approximate. */
export const AssessmentProgress: React.FC<AssessmentProgressProps> = ({ progress, onCancel }) => {
  const view = progressView(progress);

  return (
    <section
      aria-label="Assessment progress"
      className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Loader2 className="w-4 h-4 mt-0.5 text-emerald-400 animate-spin shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5" role="status" aria-live="polite">
            <p className="text-sm text-slate-200">{progress?.message ?? 'Starting…'}</p>
            <p className="font-mono text-[11px] text-slate-500">
              {progress
                ? `${progress.checksCompleted}/${progress.totalChecks} checks · ${progress.pagesAnalyzed} ${pluralize(progress.pagesAnalyzed, 'page')} read`
                : 'browser-passive'}
            </p>
          </div>
        </div>
        <Button variant="danger" icon={<Square className="w-4 h-4" />} onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Overall progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent}
        className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${view.percent}%` }}
        />
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {view.steps.map((step) => (
          <li
            key={step.label}
            aria-current={step.state === 'active' ? 'step' : undefined}
            className={`flex items-center gap-2 text-xs ${
              step.state === 'pending' ? 'text-slate-600' : step.state === 'active' ? 'text-white' : 'text-slate-400'
            }`}
          >
            <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center" aria-hidden="true">
              {step.state === 'done' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : step.state === 'active' ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              )}
            </span>
            <span>{step.label}</span>
            <span className="sr-only">
              {step.state === 'done' ? ' (done)' : step.state === 'active' ? ' (in progress)' : ' (pending)'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};
