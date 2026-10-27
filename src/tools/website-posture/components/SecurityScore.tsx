import React from 'react';
import { AssessmentScore } from '../types';
import { GRADE_COLORS, scoreColor } from './presentation';

export interface SecurityScoreProps {
  score: AssessmentScore;
}

/** Posture score, presented as a result of the checks that ran — not of the site as a whole. */
export const SecurityScore: React.FC<SecurityScoreProps> = ({ score }) => {
  const { technical, hygiene } = score.dimensions;
  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Posture score</h3>
      <div className="flex items-baseline gap-3">
        <span className={`text-5xl font-bold tabular-nums ${scoreColor(score.value)}`}>
          {score.value === null ? '—' : Math.round(score.value)}
        </span>
        {score.value !== null && <span className="text-sm text-slate-500">/ 100</span>}
        {score.grade && (
          <span className={`ml-auto text-2xl font-bold ${GRADE_COLORS[score.grade]}`}>
            <span className="sr-only">Grade </span>
            {score.grade}
          </span>
        )}
      </div>
      {score.value === null ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          Not scored: no scoreable check reached a verdict, so no number is given rather than a misleading one.
        </p>
      ) : (
        <p className="text-xs text-slate-400 leading-relaxed">
          Based on {score.scoredChecks.length} scored checks. Checks that could not be verified are left
          out and never lower this number.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
        {[technical, hygiene].map((dimension) => (
          <div key={dimension.id}>
            <dt className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{dimension.label}</dt>
            <dd className={`font-bold tabular-nums ${scoreColor(dimension.value)}`}>
              {dimension.value === null ? 'Not scored' : Math.round(dimension.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
