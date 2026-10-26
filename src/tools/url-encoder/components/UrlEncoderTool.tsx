import React, { useState, useMemo } from 'react';
import { UrlMode, UrlScope } from '../types';
import { convertUrl } from '../logic/urlConverter';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Globe, ArrowUpDown, Sparkles } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

export const UrlEncoderTool: React.FC = () => {
  const [input, setInput] = useState<string>('https://example.com/search?query=security tools & privacy=100%');
  const [mode, setMode] = useState<UrlMode>('encode');
  const [scope, setScope] = useState<UrlScope>('component');

  const result = useMemo(() => {
    return convertUrl(input, mode, scope);
  }, [input, mode, scope]);

  const handleSwap = () => {
    if (result.success && result.output) {
      setInput(result.output);
      setMode(mode === 'encode' ? 'decode' : 'encode');
    }
  };

  const handleSample = (text: string, sampleMode: UrlMode) => {
    setInput(text);
    setMode(sampleMode);
    analytics.track('tool_used', { tool: 'url-encoder', action: 'load_sample' });
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Encode / Decode Switch */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('encode')}
            className={`text-xs font-mono px-4 py-2 rounded-md font-semibold transition-all ${
              mode === 'encode'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setMode('decode')}
            className={`text-xs font-mono px-4 py-2 rounded-md font-semibold transition-all ${
              mode === 'decode'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Decode
          </button>
        </div>

        {/* Scope selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Scope:</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setScope('component')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                scope === 'component'
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              URI Component (recommended)
            </button>
            <button
              type="button"
              onClick={() => setScope('fullUrl')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                scope === 'fullUrl'
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Full URL
            </button>
          </div>
        </div>
      </div>

      {/* Input / Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="url-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{mode === 'encode' ? 'Plaintext / Unencoded URI' : 'Percent-Encoded URI'}</span>
            </label>
            <div className="flex items-center gap-2">
              <ClearButton onClear={() => setInput('')} disabled={!input} />
              <CopyButton text={input} label="Copy Input" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
            <textarea
              id="url-input"
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'encode' ? 'Enter string or parameters to URL encode...' : 'Paste percent-encoded string (e.g. hello%20world)...'}
              className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{input.length.toLocaleString()} characters</span>
              <span>UTF-8 Safe</span>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
              {mode === 'encode' ? 'Encoded URL Output' : 'Decoded Plaintext Output'}
            </span>
            <div className="flex items-center gap-2">
              {result.success && result.output && (
                <button
                  type="button"
                  onClick={handleSwap}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Swap input and output"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Swap</span>
                </button>
              )}
              <CopyButton text={result.output} label="Copy Output" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col min-h-[212px]">
            {result.error ? (
              <div className="p-4">
                <ErrorMessage message={result.error} />
              </div>
            ) : (
              <div className="p-4 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all flex-1 select-all selection:bg-brand-500 selection:text-slate-950">
                {result.output || (
                  <span className="text-slate-600 italic font-sans select-none">
                    Output will appear here automatically...
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{result.output.length.toLocaleString()} characters</span>
              <span className="text-emerald-400">Client-Side Processed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Presets:</span>
        </span>
        <button
          type="button"
          onClick={() => handleSample('param=hello world & security=100%!', 'encode')}
          className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
        >
          Special Chars & Spaces
        </button>
        <button
          type="button"
          onClick={() => handleSample('https%3A%2F%2Fapi.example.com%2Fv1%2Fusers%3Fname%3DAlice%20Smith', 'decode')}
          className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
        >
          Encoded Query String
        </button>
      </div>
    </div>
  );
};
