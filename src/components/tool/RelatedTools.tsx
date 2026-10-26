import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { ToolDefinition } from '../../types';

export interface RelatedToolsProps {
  tools: ToolDefinition[];
  currentToolName: string;
}

export const RelatedTools: React.FC<RelatedToolsProps> = ({ tools, currentToolName }) => {
  if (!tools || tools.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-slate-800/80" aria-labelledby="related-tools-heading">
      <h2
        id="related-tools-heading"
        className="flex items-center gap-2 mb-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider"
      >
        <Compass className="w-4 h-4" aria-hidden="true" />
        <span>Related Tools</span>
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Other privacy-first utilities commonly used alongside{' '}
        <strong className="text-slate-200">{currentToolName}</strong>:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            to={`/${tool.slug}`}
            className="group p-4 rounded-xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                  {tool.category}
                </span>
                {tool.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {tool.badge}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                {tool.name}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                {tool.shortDescription}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-end text-xs font-mono text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              <span className="mr-1">Open {tool.name}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
