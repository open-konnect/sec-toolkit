import React, { useState, useMemo } from 'react';
import { REGISTERED_TOOLS, TOOL_CATEGORIES, searchTools } from '../tools/registry';
import { ToolCategory } from '../types';
import { ToolCard } from '../components/tool/ToolCard';
import { PrivacyNotice } from '../components/ui/PrivacyNotice';
import { SEOHead } from '../components/tool/SEOHead';
import { 
  ShieldCheck, 
  Search, 
  Terminal, 
  Lock, 
  Database, 
  Zap
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');

  const filteredTools = useMemo(() => {
    let tools = searchTools(searchQuery);
    if (selectedCategory !== 'all') {
      tools = tools.filter(t => t.category === selectedCategory);
    }
    return tools;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-16">
      <SEOHead
        title="Developer Security Toolkit — Free, Privacy-First Browser Tools"
        description="Free, privacy-first developer and security utilities. 100% client-side processing: inspect JWTs, encode/decode Base64, and generate secure UUIDs without uploading data."
        canonicalPath="/"
        keywords={['developer tools', 'security tools', 'jwt decoder', 'base64 converter', 'uuid generator', 'privacy-first', 'client-side']}
      />

      {/* Hero Section */}
      <section className="pt-6 pb-2 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero Server Storage • Zero Input Logging</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Developer Security Toolkit
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
          Free, privacy-first developer utilities that run <strong className="font-semibold text-white">entirely in your browser</strong>.
        </p>

        {/* Prominent Privacy Statement */}
        <div className="max-w-2xl mx-auto">
          <PrivacyNotice />
        </div>
      </section>

      {/* Search & Filter Controls */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools (e.g. jwt, base64, uuid)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Tools ({REGISTERED_TOOLS.length})
            </button>
            {TOOL_CATEGORIES.map((cat) => {
              const count = REGISTERED_TOOLS.filter(t => t.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tool Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 text-sm">
            No tools matched your search query "{searchQuery}".
          </div>
        )}
      </section>

      {/* Product Architecture & Roadmap Highlights */}
      <section className="pt-8 border-t border-slate-800/80 max-w-5xl mx-auto">
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-1">
            Modular Architecture
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Built for Scalability and Developer Trust
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Each utility is isolated in its own self-contained module. New utilities in security, data transformation, and AI can be plugged in without refactoring core services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOL_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold">
                {cat.id === 'security' && <Lock className="w-4 h-4" />}
                {cat.id === 'data' && <Database className="w-4 h-4" />}
                {cat.id === 'developer' && <Terminal className="w-4 h-4" />}
                {cat.id === 'ai' && <Zap className="w-4 h-4" />}
                <span>{cat.name}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
