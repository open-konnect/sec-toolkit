import React from 'react';
import { Link } from 'react-router-dom';
import { REGISTERED_TOOLS } from '../tools/registry';
import { ArrowLeft, ShieldAlert, ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/tool/SEOHead';
import { NOT_FOUND_SEO } from '../seo/pages';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="py-16 text-center max-w-xl mx-auto space-y-6">
      <SEOHead seo={NOT_FOUND_SEO} />

      <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-8 h-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">404 — Tool Not Found</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          The requested tool route does not exist or may have been relocated. Use the links below to find a tool.
        </p>
      </div>

      <div className="pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Return to Homepage</span>
        </Link>
      </div>

      <div className="pt-8 border-t border-slate-800/80 text-left">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Available developer tools
        </h2>
        <div className="space-y-2">
          {REGISTERED_TOOLS.map((tool) => (
            <Link
              key={tool.id}
              to={`/${tool.slug}`}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>{tool.name}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
