import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ToolDefinition } from '../../types';

export interface ToolCardProps {
  tool: ToolDefinition;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  return (
    <div className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-emerald-950/20">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider">
              {tool.category}
            </span>
            {tool.badge && (
              <Badge variant="info" size="sm">
                {tool.badge}
              </Badge>
            )}
          </div>
          <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            Client-Side
          </span>
        </div>

        <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors tracking-tight mb-2">
          {tool.name}
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          {tool.shortDescription}
        </p>
      </div>

      <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tool.keywords.slice(0, 3).map((kw) => (
            <span
              key={kw}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400"
            >
              #{kw}
            </span>
          ))}
        </div>

        <Link
          to={`/${tool.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all focus:outline-none focus:underline"
        >
          <span>Open Tool</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
