import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { 
  ShieldCheck, 
  Search, 
  Star, 
  Shield, 
  Binary, 
  Database, 
  Terminal, 
  Sparkles,
  Lock

} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') as ToolCategory | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>(
    categoryParam && ['security', 'encoding', 'data', 'developer', 'ai'].includes(categoryParam)
      ? categoryParam
      : 'all'
  );

  // Sync state if URL query param changes
  useEffect(() => {
    if (categoryParam && ['security', 'encoding', 'data', 'developer', 'ai'].includes(categoryParam)) {
      setSelectedCategory(categoryParam);
    } else if (!categoryParam) {
      setSelectedCategory('all');
    }
  }, [categoryParam]);

  const handleCategorySelect = (cat: ToolCategory | 'all') => {
    setSelectedCategory(cat);
    if (cat === 'all') {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: cat });
    }
  };

  const isSearchActive = searchQuery.trim().length > 0;
  const isCategoryFilterActive = selectedCategory !== 'all';

  const filteredSearchResults = useMemo(() => {
    let list = searchTools(searchQuery);
    if (selectedCategory !== 'all') {
      list = list.filter(t => t.category === selectedCategory);
    }
    return list;
  }, [searchQuery, selectedCategory]);

  const featuredTools = useMemo(() => {
    return getFeaturedTools();
  }, []);

  const getCategoryIcon = (catId: ToolCategory) => {
    switch (catId) {
      case 'security': return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'encoding': return <Binary className="w-4 h-4 text-cyan-400" />;
      case 'data': return <Database className="w-4 h-4 text-amber-400" />;
      case 'developer': return <Terminal className="w-4 h-4 text-indigo-400" />;
      case 'ai': return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-12">
      <SEOHead
        title="Developer & Security Tools — Fast, Private Browser Utilities"
        description="Fast, private, browser-based utilities for developers, security engineers, and AI builders. 15 tools running 100% locally in your browser."
        canonicalPath="/"
        keywords={[
          'developer tools', 'security tools', 'jwt decoder', 'json formatter', 'hash generator',
          'base64 converter', 'regex tester', 'timestamp converter', 'cron generator', 'uuid generator',
          'csp generator', 'security headers', 'password strength', 'llm token calculator'
        ]}
      />

      {/* Clean, Minimal Hero Section */}
      <section className="pt-4 pb-2 text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>15 Privacy-First Browser Tools</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Developer & Security Tools
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
          Fast, private, browser-based utilities for developers, security engineers, and AI builders.
        </p>

        <p className="text-xs font-mono text-emerald-400/90 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Your data stays in your browser. No account required.</span>
        </p>
      </section>

      {/* Search & Category Filter Navigation Bar */}
      <section className="space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools (e.g. jwt, json, hash)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
            />
          </div>

          {/* Compact Category Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCategorySelect('all')}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              All ({REGISTERED_TOOLS.length})
            </button>
            {TOOL_CATEGORIES.map((cat) => {
              const count = REGISTERED_TOOLS.filter(t => t.category === cat.id).length;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {getCategoryIcon(cat.id)}
                  <span>{cat.name} ({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto space-y-12">
        {/* CASE A: Active Search or Category Filter */}
        {(isSearchActive || isCategoryFilterActive) ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>
                  {isSearchActive ? `Search Results for "${searchQuery}"` : `${selectedCategory.toUpperCase()} Tools`}
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  {filteredSearchResults.length} found
                </span>
              </h2>

              {(isSearchActive || isCategoryFilterActive) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    handleCategorySelect('all');
                  }}
                  className="text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            {filteredSearchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSearchResults.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 space-y-3">
                <p className="text-sm">No tools matched your criteria "{searchQuery}".</p>
                <div className="text-xs font-mono text-slate-500">
                  Try searching for: <span className="text-emerald-400 cursor-pointer" onClick={() => setSearchQuery('jwt')}>jwt</span>, <span className="text-emerald-400 cursor-pointer" onClick={() => setSearchQuery('json')}>json</span>, <span className="text-emerald-400 cursor-pointer" onClick={() => setSearchQuery('hash')}>hash</span>, or <span className="text-emerald-400 cursor-pointer" onClick={() => setSearchQuery('time')}>time</span>.
                </div>
              </div>
            )}
          </section>
        ) : (
          /* CASE B: Default View (Featured Tools + Category Sections) */
          <>
            {/* 1. Featured / Popular Tools Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Featured & Popular Tools
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>

            {/* 2. Structured Category Sections */}
            <div className="space-y-12 pt-4">
              {TOOL_CATEGORIES.map((cat) => {
                const tools = getToolsByCategory(cat.id);
                if (tools.length === 0) return null;

                return (
                  <section key={cat.id} className="space-y-4 pt-6 border-t border-slate-800/60">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(cat.id)}
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {cat.name}
                        </h3>
                        <span className="text-[11px] font-mono text-slate-500">
                          ({tools.length})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {cat.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {tools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
