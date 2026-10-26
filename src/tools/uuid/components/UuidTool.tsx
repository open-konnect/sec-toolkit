import React, { useState, useEffect } from 'react';
import { generateBulkUuids, isValidUuidV4 } from '../logic/uuidGenerator';
import { GeneratedUuidItem, UuidFormatOptions } from '../types';
import { CopyButton } from '../../../components/ui/CopyButton';
import { analytics } from '../../../lib/analytics';
import { RefreshCw, CheckCircle2, XCircle, Key, ShieldCheck } from 'lucide-react';

export const UuidTool: React.FC = () => {
  const [quantity, setQuantity] = useState<number>(5);
  const [options, setOptions] = useState<UuidFormatOptions>({
    uppercase: false,
    hyphens: true
  });
  const [uuids, setUuids] = useState<GeneratedUuidItem[]>([]);
  const [testInput, setTestInput] = useState<string>('');

  const generate = () => {
    const list = generateBulkUuids(quantity, options);
    setUuids(list);
    analytics.track('tool_used', { tool: 'uuid-generator', action: 'generate', count: quantity });
  };

  useEffect(() => {
    generate();
  }, [quantity, options]);

  const allUuidsText = uuids.map(u => u.value).join('\n');

  const testResult = testInput.trim() ? isValidUuidV4(testInput) : null;

  return (
    <div className="space-y-8">
      {/* Configuration & Action Header */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Quantity selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300 font-semibold uppercase">Quantity:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {[1, 5, 10, 25, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    quantity === num
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Regenerate Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
            <CopyButton text={allUuidsText} label="Copy All" />
          </div>
        </div>

        {/* Formatting Options */}
        <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.hyphens}
              onChange={(e) => setOptions({ ...options, hyphens: e.target.checked })}
              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950"
            />
            <span>Include Hyphens (RFC standard)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.uppercase}
              onChange={(e) => setOptions({ ...options, uppercase: e.target.checked })}
              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950"
            />
            <span>Uppercase Letters</span>
          </label>

          <div className="ml-auto text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>crypto.randomUUID() (CSPRNG)</span>
          </div>
        </div>
      </div>

      {/* Hero Single Display (when quantity is 1) */}
      {quantity === 1 && uuids[0] && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
              Cryptographically Secure UUID v4
            </span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-white select-all tracking-tight break-all">
              {uuids[0].value}
            </span>
          </div>
          <CopyButton text={uuids[0].value} label="Copy UUID" />
        </div>
      )}

      {/* Generated List Display */}
      {quantity > 1 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 text-xs font-mono text-slate-400">
            <span>Generated UUIDs ({uuids.length})</span>
            <CopyButton text={allUuidsText} label="Copy All to Clipboard" />
          </div>

          <div className="divide-y divide-slate-800/60 font-mono text-xs max-h-96 overflow-y-auto">
            {uuids.map((item, idx) => (
              <div
                key={item.id + idx}
                className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-[11px] w-6 select-none">{idx + 1}.</span>
                  <span className="text-emerald-300 font-medium select-all break-all">{item.value}</span>
                </div>
                <CopyButton text={item.value} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UUID Validator Utility Section */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          <span>UUID v4 Format Validator</span>
        </h4>
        <p className="text-xs text-slate-400">
          Paste any UUID to check if it conforms to the RFC 4122 Version 4 specification.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            spellCheck={false}
          />

          {testResult !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${
              testResult
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
            }`}>
              {testResult ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Valid UUID v4</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Invalid UUID v4</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
