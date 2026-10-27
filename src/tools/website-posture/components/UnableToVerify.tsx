import React from 'react';
import { SecurityAssessment } from '../types';
import { STANDING_LIMITATIONS, summarizeUnverified } from '../logic/report/checked';

export interface UnableToVerifyProps {
  assessment: SecurityAssessment;
}

/** Browser limits and checks that could not reach a verdict. None of these are failures. */
export const UnableToVerify: React.FC<UnableToVerifyProps> = ({ assessment }) => {
  const unverified = summarizeUnverified(assessment);
  return (
    <section aria-labelledby="unverified-title" className="space-y-3">
      <h3 id="unverified-title" className="text-sm font-bold text-white tracking-tight">
        What we could not verify
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        These are limits of a passive check run in a browser tab. They are not failures and they do not
        change the score.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300 leading-relaxed">
        {STANDING_LIMITATIONS.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
      {unverified.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-slate-200">
            Checks that could not reach a verdict ({unverified.length})
          </h4>
          <ul className="space-y-1.5">
            {unverified.map((item) => (
              <li key={item.checkId} className="text-xs text-slate-400">
                <span className="text-slate-200">{item.name}</span>
                {item.reasons.length > 0 && <span> — {item.reasons.join(' ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
