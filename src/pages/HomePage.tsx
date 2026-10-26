import React, { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  REGISTERED_TOOLS,
  TOOL_CATEGORIES,
  getFeaturedTools,
  getToolsByCategory,
  searchTools
} from '../tools/registry';
import { ToolCategory } from '../types';
import { ToolCard } from '../components/tool/ToolCard';
import { SEOHead } from '../components/tool/SEOHead';
import { getHomePageSeo } from '../seo/pages';
import {
  ShieldCheck,
  Search,
  Star,
  Shield,
  Binary,
  Database,
  Terminal,
  Sparkles,
  Lock,
  ArrowRight
} from 'lucide-react';

const VALID_CATEGORIES: ToolCategory[] = ['security', 'encoding', 'data', 'developer', 'ai'];

export const HomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') as ToolCategory | null;
  const [searchQuery, setSearchQuery] = useState('');

  const seo = useMemo(() => getHomePageSeo(), []);
  const featuredTools = useMemo(() => getFeaturedTools(), []);
  const isSearchActive = searchQuery.trim().length > 0;

  const filteredSearchResults = useMemo(() => {
    return isSearchActive ? searchTools(searchQuery) : [];
  }, [isSearchActive, searchQuery]);

  // Legacy category URLs now live on dedicated category pages.
  if (categoryParam && VALID_CATEGORIES.includes(categoryParam)) {
    return <Navigate to={`/${categoryParam}`} replace />;
  }

  const getCategoryIcon = (catId: ToolCategory) => {
    switch (catId) {
      case 'security': return <Shield className="w-4 h-4 text-emerald-400" aria-hidden="true" />;
      case 'encoding': return <Binary className="w-4 h-4 text-cyan-400" aria-hidden="true" />;
      case 'data': return <Database className="w-4 h-4 text-amber-400" aria-hidden="true" />;
      case 'developer': return <Terminal className="w-4 h-4 text-indigo-400" aria-hidden="true" />;
      case 'ai': return <Sparkles className="w-4 h-4 text-purple-400" aria-hidden="true" />;
    }
  };

  return (
    <div className="space-y-12">
      <SEOHead seo={seo} />

      <section className="pt-4 pb-2 text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <span>15 Privacy-First Browser Tools</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Developer &amp; Security Tools
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
          Fast, private, browser-based utilities for developers, security engineers, and AI builders.
        </p>

        <p className="text-xs font-mono text-emerald-400/90 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>Your data stays in your browser. No account required.</span>
        </p>
      </section>

      <section className="space-y-4 max-w-6xl mx-auto" aria-label="Search and browse tools">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <div className="relative w-full sm:w-80">
            <label htmlFor="tool-search" className="sr-only">
              Search tools
            </label>
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="tool-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tools (e.g. jwt, json, hash)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
            />
          </div>

          <nav aria-label="Tool categories" className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <Link
              to="/"
              className="text-xs font-mono px-3 py-1.5 rounded-lg border bg-emerald-600 border-emerald-500 text-white font-bold"
              aria-current="page"
            >
              All ({REGISTERED_TOOLS.length})
            </Link>
            {TOOL_CATEGORIES.map((category) => {
              const count = REGISTERED_TOOLS.filter((tool) => tool.category === category.id).length;

              return (
                <Link
                  key={category.id}
                  to={`/${category.id}`}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {getCategoryIcon(category.id)}
                  <span>{category.name} ({count})</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="max-w-6xl mx-auto space-y-12">
        {isSearchActive ? (
          <section className="space-y-4" aria-labelledby="search-results-heading">
            <div className="flex items-center justify-between gap-4">
              <h2 id="search-results-heading" className="text-lg font-bold text-white flex items-center gap-2">
                <span>Search results for &ldquo;{searchQuery}&rdquo;</span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  {filteredSearchResults.length} found
                </span>
              </h2>

              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              >
                Clear search
              </button>
            </div>

            {filteredSearchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSearchResults.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 space-y-3">
                <p className="text-sm">No tools matched &ldquo;{searchQuery}&rdquo;.</p>
                <p className="text-xs font-mono text-slate-500">
                  Try a term like <button type="button" className="text-emerald-400" onClick={() => setSearchQuery('jwt')}>jwt</button>,{' '}
                  <button type="button" className="text-emerald-400" onClick={() => setSearchQuery('json')}>json</button>,{' '}
                  <button type="button" className="text-emerald-400" onClick={() => setSearchQuery('hash')}>hash</button>, or{' '}
                  <button type="button" className="text-emerald-400" onClick={() => setSearchQuery('time')}>time</button>.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="space-y-4" aria-labelledby="featured-tools-heading">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden="true" />
                <h2 id="featured-tools-heading" className="text-lg font-bold text-white tracking-tight">
                  Featured &amp; Popular Tools
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>

            <div className="space-y-12 pt-4">
              {TOOL_CATEGORIES.map((category) => {
                const tools = getToolsByCategory(category.id);
                if (tools.length === 0) return null;

                return (
                  <section
                    key={category.id}
                    className="space-y-4 pt-6 border-t border-slate-800/60"
                    aria-labelledby={`category-${category.id}-heading`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.id)}
                        <h2 id={`category-${category.id}-heading`} className="text-base font-bold text-white tracking-tight">
                          {category.name}
                        </h2>
                        <span className="text-[11px] font-mono text-slate-500">
                          ({tools.length})
                        </span>
                      </div>
                      <Link
                        to={`/${category.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                      >
                        Browse {category.name} tools
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </div>
                    <p className="text-xs text-slate-400 max-w-3xl">{category.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {tools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="pt-10 border-t border-slate-800/60" aria-labelledby="about-toolkit-heading">
              <h2 id="about-toolkit-heading" className="text-xl font-bold text-white tracking-tight mb-3">
                Private developer tools that run in your browser
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                  <h3 className="text-sm font-semibold text-white mb-1.5">No uploads by design</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Tokens, passwords, JSON, and hashes are processed with browser APIs. Inputs are not sent to a server,
                    written to cookies, or included in analytics events.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                  <h3 className="text-sm font-semibold text-white mb-1.5">No account required</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Open a tool and start working. There is no sign-up, paywall, or client-side storage of your inputs.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                  <h3 className="text-sm font-semibold text-white mb-1.5">Built for everyday debugging</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Decode auth tokens, format payloads, inspect timestamps, test regular expressions, and estimate LLM
                    costs without switching between services.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
