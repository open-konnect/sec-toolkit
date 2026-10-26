import React, { useState, useMemo } from 'react';
import { DEFAULT_SECURITY_HEADERS, buildSecurityHeadersConfig } from '../logic/securityHeadersBuilder';
import { SecurityHeaderItem, HeaderPlatform } from '../types';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ShieldCheck, Server, Sparkles } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

export const SecurityHeadersTool: React.FC = () => {
  const [headers, setHeaders] = useState<SecurityHeaderItem[]>(DEFAULT_SECURITY_HEADERS);
  const [platform, setPlatform] = useState<HeaderPlatform>('raw');

  const configs = useMemo(() => {
    return buildSecurityHeadersConfig(headers);
  }, [headers]);

  const activeOutput = platform === 'raw'
    ? configs.raw
    : platform === 'nginx'
    ? configs.nginx
    : platform === 'apache'
    ? configs.apache
    : configs.cloudflare;

  const toggleHeader = (id: string) => {
    setHeaders(prev => prev.map(h => h.id === id ? { ...h, enabled: !h.enabled } : h));
    analytics.track('tool_used', { tool: 'security-headers', action: 'toggle_header', headerId: id });
  };

  const handleUpdateValue = (id: string, newVal: string) => {
    setHeaders(prev => prev.map(h => h.id === id ? { ...h, value: newVal } : h));
  };

  return (
    <div className="space-y-6">
      {/* Output Configuration Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Recommended HTTP Security Headers
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {[
                { id: 'raw', label: 'Raw HTTP' },
                { id: 'nginx', label: 'Nginx' },
                { id: 'apache', label: 'Apache' },
                { id: 'cloudflare', label: 'Cloudflare _headers' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id as HeaderPlatform)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    platform === p.id ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <CopyButton text={activeOutput} label="Copy Config" />
          </div>
        </div>

        {/* Code display */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre overflow-x-auto select-all selection:bg-brand-500 selection:text-slate-950 max-h-64">
          {activeOutput}
        </div>
      </div>

      {/* Header Item Toggles */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-semibold uppercase text-slate-300 tracking-wider block">
          Configure Header Directives
        </span>

        <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          {headers.map((h) => (
            <div key={h.id} className="p-4 hover:bg-slate-900/60 transition-colors space-y-2">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={() => toggleHeader(h.id)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950"
                  />
                  <span className={`font-mono text-xs font-bold ${h.enabled ? 'text-white' : 'text-slate-500 line-through'}`}>
                    {h.name}
                  </span>
                </label>
                <span className="text-[11px] font-mono text-emerald-400/80">
                  {h.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <p className="text-xs text-slate-400">{h.description}</p>

              {h.enabled && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => handleUpdateValue(h.id, e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
