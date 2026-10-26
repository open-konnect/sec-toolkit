import React from 'react';
import { Badge, BadgeVariant } from '../ui/Badge';
import { 
  AlertOctagon, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2
} from 'lucide-react';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical' | 'pass';

export interface SecurityFindingData {
  id: string;
  title: string;
  severity: FindingSeverity;
  what: string;
  why: string;
  recommendation: string;
  codeSnippet?: string;
}

export interface SecurityFindingProps {
  finding: SecurityFindingData;
}

export const SecurityFinding: React.FC<SecurityFindingProps> = ({ finding }) => {
  const { title, severity, what, why, recommendation, codeSnippet } = finding;

  const severityConfig: Record<FindingSeverity, {
    badgeVariant: BadgeVariant;
    icon: React.ReactNode;
    cardBorder: string;
    headerBg: string;
    label: string;
  }> = {
    critical: {
      badgeVariant: 'critical',
      icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />,
      cardBorder: 'border-rose-800/60 bg-rose-950/20',
      headerBg: 'bg-rose-950/40 border-rose-800/40',
      label: 'Critical Severity'
    },
    high: {
      badgeVariant: 'high',
      icon: <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />,
      cardBorder: 'border-orange-800/60 bg-orange-950/20',
      headerBg: 'bg-orange-950/40 border-orange-800/40',
      label: 'High Severity'
    },
    medium: {
      badgeVariant: 'medium',
      icon: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
      cardBorder: 'border-amber-800/60 bg-amber-950/20',
      headerBg: 'bg-amber-950/40 border-amber-800/40',
      label: 'Medium Severity'
    },
    low: {
      badgeVariant: 'low',
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
      cardBorder: 'border-blue-800/50 bg-blue-950/15',
      headerBg: 'bg-blue-950/30 border-blue-800/30',
      label: 'Low Severity'
    },
    info: {
      badgeVariant: 'info',
      icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
      cardBorder: 'border-sky-800/50 bg-sky-950/15',
      headerBg: 'bg-sky-950/30 border-sky-800/30',
      label: 'Informational'
    },
    pass: {
      badgeVariant: 'success',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      cardBorder: 'border-emerald-800/50 bg-emerald-950/15',
      headerBg: 'bg-emerald-950/30 border-emerald-800/30',
      label: 'Passed Check'
    }
  };

  const config = severityConfig[severity];

  return (
    <div className={`rounded-xl border ${config.cardBorder} overflow-hidden shadow-sm`}>
      {/* Finding Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${config.headerBg}`}>
        <div className="flex items-center gap-2.5">
          {config.icon}
          <h4 className="text-sm font-semibold text-white tracking-tight">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="sr-only">{config.label}</span>
          <Badge variant={config.badgeVariant} size="sm">
            {severity}
          </Badge>
        </div>
      </div>

      {/* 3-part clear explanation */}
      <div className="p-4 space-y-3.5 text-xs">
        <div>
          <span className="font-mono uppercase font-semibold text-slate-400 text-[10px] tracking-wider block mb-1">
            What was detected
          </span>
          <p className="text-slate-200 leading-relaxed font-sans">{what}</p>
        </div>

        <div>
          <span className="font-mono uppercase font-semibold text-slate-400 text-[10px] tracking-wider block mb-1">
            Why it matters
          </span>
          <p className="text-slate-300 leading-relaxed font-sans">{why}</p>
        </div>

        <div>
          <span className="font-mono uppercase font-semibold text-emerald-400 text-[10px] tracking-wider block mb-1">
            Recommended Action
          </span>
          <p className="text-slate-300 leading-relaxed font-sans">{recommendation}</p>
        </div>

        {codeSnippet && (
          <div className="mt-2 pt-2 border-t border-slate-800/80">
            <pre className="p-2.5 rounded bg-slate-950/90 font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre">
              {codeSnippet}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
