import React from 'react';
import { SecurityAssessment } from '../types';
import { summarizeChecked } from '../logic/report/checked';

const STATUS_TEXT = {
  performed: 'Ran',
  'unable-to-verify': 'Could not verify',
  'not-applicable': 'Not applicable',
  errored: 'Did not complete'
} as const;

export interface WhatWeCheckedProps {
  assessment: SecurityAssessment;
}

export const WhatWeChecked: React.FC<WhatWeCheckedProps> = ({ assessment }) => {
  const groups = summarizeChecked(assessment);
  return (
    <section aria-labelledby="checked-title" className="space-y-3">
      <h3 id="checked-title" className="text-sm font-bold text-white tracking-tight">
        What we checked
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        {assessment.checksPerformed.length} checks ran. Each looks only at what a page exposes to the
        browser; none sends requests that change anything on the target.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((group) => (
          <div key={group.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
            <h4 className="text-xs font-bold text-slate-200">{group.label}</h4>
            <ul className="space-y-0.5">
              {group.checks.map((check) => (
                <li key={check.checkId} className="flex justify-between gap-3 text-[11px] text-slate-400">
                  <span>{check.name}</span>
                  <span className="shrink-0 font-mono text-slate-500">
                    {STATUS_TEXT[check.status as keyof typeof STATUS_TEXT] ?? check.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
