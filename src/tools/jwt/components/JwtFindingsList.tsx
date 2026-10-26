import React, { useState } from 'react';
import { SecurityFinding, SecurityFindingData, FindingSeverity } from '../../../components/tool/SecurityFinding';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export interface JwtFindingsListProps {
  findings: SecurityFindingData[];
}

export const JwtFindingsList: React.FC<JwtFindingsListProps> = ({ findings }) => {
  const [filter, setFilter] = useState<string>('all');

  const counts: Record<FindingSeverity, number> = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
    pass: findings.filter(f => f.severity === 'pass').length
  };

  const filteredFindings = filter === 'all'
    ? findings
    : findings.filter(f => f.severity === filter);

  if (findings.length === 0) {
    return null;
  }

  const hasHighRisk = counts.critical > 0 || counts.high > 0;

  return (
    <div className="space-y-4">
      {/* Overview bar */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        hasHighRisk 
          ? 'bg-rose-950/20 border-rose-800/40' 
          : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex items-center gap-2.5">
          {hasHighRisk ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Security & Claim Analysis ({findings.length} item{findings.length === 1 ? '' : 's'})
            </h3>
            <p className="text-xs text-slate-400">
              Static verification of algorithms, claims, expirations, and structure.
            </p>
          </div>
        </div>

        {/* Severity Badges Filter */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded transition-colors ${
              filter === 'all' ? 'bg-slate-700 text-white font-bold' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            All ({findings.length})
          </button>
          {counts.critical > 0 && (
            <button
              type="button"
              onClick={() => setFilter('critical')}
              className={`px-2 py-1 rounded transition-colors ${
                filter === 'critical' ? 'bg-rose-700 text-white font-bold' : 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/60'
              }`}
            >
              Critical: {counts.critical}
            </button>
          )}
          {counts.high > 0 && (
            <button
              type="button"
              onClick={() => setFilter('high')}
              className={`px-2 py-1 rounded transition-colors ${
                filter === 'high' ? 'bg-orange-700 text-white font-bold' : 'bg-orange-950/60 text-orange-300 hover:bg-orange-900/60'
              }`}
            >
              High: {counts.high}
            </button>
          )}
          {counts.medium > 0 && (
            <button
              type="button"
              onClick={() => setFilter('medium')}
              className={`px-2 py-1 rounded transition-colors ${
                filter === 'medium' ? 'bg-amber-700 text-white font-bold' : 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/60'
              }`}
            >
              Med: {counts.medium}
            </button>
          )}
          {counts.low > 0 && (
            <button
              type="button"
              onClick={() => setFilter('low')}
              className={`px-2 py-1 rounded transition-colors ${
                filter === 'low' ? 'bg-blue-700 text-white font-bold' : 'bg-blue-950/60 text-blue-300 hover:bg-blue-900/60'
              }`}
            >
              Low: {counts.low}
            </button>
          )}
        </div>
      </div>

      {/* Findings list */}
      <div className="space-y-3">
        {filteredFindings.map((finding) => (
          <SecurityFinding key={finding.id} finding={finding} />
        ))}
      </div>
    </div>
  );
};
