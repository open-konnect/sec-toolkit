import React, { useState, useMemo } from 'react';
import { CspDirectiveName } from '../types';
import { buildCspPolicy, CSP_DIRECTIVE_DEFINITIONS } from '../logic/cspBuilder';
import { CopyButton } from '../../../components/ui/CopyButton';
import { WarningMessage } from '../../../components/ui/WarningMessage';
import { Shield, ShieldAlert, Sparkles, Plus, X, Code } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const INITIAL_DIRECTIVES: Record<CspDirectiveName, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'https:'],
  'connect-src': ["'self'"],
  'media-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

export const CspGeneratorTool: React.FC = () => {
  const [directives, setDirectives] = useState<Record<CspDirectiveName, string[]>>(INITIAL_DIRECTIVES);
  const [newSourceInputs, setNewSourceInputs] = useState<{ [key: string]: string }>({});
  const [outputTab, setOutputTab] = useState<'header' | 'html' | 'nginx'>('header');

  const policy = useMemo(() => {
    return buildCspPolicy(directives);
  }, [directives]);

  const handleAddSource = (directive: CspDirectiveName) => {
    const text = (newSourceInputs[directive] || '').trim();
    if (!text) return;

    if (!directives[directive]?.includes(text)) {
      setDirectives(prev => ({
        ...prev,
        [directive]: [...(prev[directive] || []), text]
      }));
    }
    setNewSourceInputs(prev => ({ ...prev, [directive]: '' }));
    analytics.track('tool_used', { tool: 'csp-generator', action: 'add_source', directive });
  };

  const handleRemoveSource = (directive: CspDirectiveName, sourceToRemove: string) => {
    setDirectives(prev => ({
      ...prev,
      [directive]: prev[directive].filter(s => s !== sourceToRemove)
    }));
  };

  const handleResetStrict = () => {
    setDirectives(INITIAL_DIRECTIVES);
  };

  return (
    <div className="space-y-6">
      {/* Policy Output Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Generated Content Security Policy
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setOutputTab('header')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  outputTab === 'header' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                HTTP Header
              </button>
              <button
                type="button"
                onClick={() => setOutputTab('html')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  outputTab === 'html' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                HTML Meta
              </button>
              <button
                type="button"
                onClick={() => setOutputTab('nginx')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  outputTab === 'nginx' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Nginx
              </button>
            </div>
            <CopyButton
              text={
                outputTab === 'header'
                  ? policy.rawHeader
                  : outputTab === 'html'
                  ? policy.metaHtml
                  : policy.nginxConfig
              }
              label="Copy"
            />
          </div>
        </div>

        {/* Code display */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 break-all select-all selection:bg-brand-500 selection:text-slate-950">
          {outputTab === 'header' && policy.rawHeader}
          {outputTab === 'html' && policy.metaHtml}
          {outputTab === 'nginx' && policy.nginxConfig}
        </div>
      </div>

      {/* Security Warnings from Automated Policy Audit */}
      {policy.warnings.length > 0 && (
        <div className="space-y-2">
          {policy.warnings.map((w, idx) => (
            <WarningMessage
              key={idx}
              title={`CSP Security Risk: ${w.directive} contains ${w.source}`}
              message={w.message}
            />
          ))}
        </div>
      )}

      {/* Directives Builder Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold uppercase text-slate-300 tracking-wider">
            Directive Controls
          </span>
          <button
            type="button"
            onClick={handleResetStrict}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Recommended Defaults</span>
          </button>
        </div>

        <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          {(Object.keys(CSP_DIRECTIVE_DEFINITIONS) as CspDirectiveName[]).map((name) => {
            const def = CSP_DIRECTIVE_DEFINITIONS[name];
            const currentSources = directives[name] || [];

            return (
              <div key={name} className="p-4 hover:bg-slate-900/60 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-white select-all">
                      {name}
                    </span>
                    <p className="text-[11px] text-slate-400">{def.description}</p>
                  </div>

                  {/* Add source mini input */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Add source (e.g. https://api.com)"
                      value={newSourceInputs[name] || ''}
                      onChange={(e) => setNewSourceInputs({ ...newSourceInputs, [name]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSource(name);
                        }
                      }}
                      className="w-48 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSource(name)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                      title="Add source"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Badges of current sources */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {currentSources.map((src) => (
                    <span
                      key={src}
                      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700/80"
                    >
                      <span>{src}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(name, src)}
                        className="text-slate-400 hover:text-rose-400 ml-0.5"
                        title="Remove source"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
