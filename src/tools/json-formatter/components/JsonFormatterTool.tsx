import React, { useState, useMemo } from 'react';
import { processJson } from '../logic/jsonFormatter';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { CheckCircle2, FileJson, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const EXAMPLE_JSON = `{
  "toolkit": "Developer Security Toolkit",
  "version": 1.0,
  "privacy": {
    "clientSideOnly": true,
    "zeroServerUploads": true
  },
  "tags": ["security", "crypto", "privacy", "tools"],
  "stats": {
    "toolsCount": 15,
    "activeUsers": 25000
  }
}`;

export const JsonFormatterTool: React.FC = () => {
  const [input, setInput] = useState<string>(EXAMPLE_JSON);
  const [indent, setIndent] = useState<number>(2);
  const [mode, setMode] = useState<'formatted' | 'minified'>('formatted');

  const result = useMemo(() => {
    return processJson(input, indent);
  }, [input, indent]);

  const displayedOutput = mode === 'formatted' ? (result.formatted || '') : (result.minified || '');

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    analytics.track('tool_used', { tool: 'json-formatter', action: 'input_change' });
  };

  const handleClear = () => {
    setInput('');
  };

  const handleLoadExample = () => {
    setInput(EXAMPLE_JSON);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">View Mode:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMode('formatted')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                mode === 'formatted'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Prettify</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('minified')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                mode === 'minified'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Minify</span>
            </button>
          </div>
        </div>

        {mode === 'formatted' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Indentation:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              {[2, 4].map((spaces) => (
                <button
                  key={spaces}
                  type="button"
                  onClick={() => setIndent(spaces)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    indent === spaces
                      ? 'bg-slate-800 text-emerald-400 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spaces} spaces
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadExample}
            className="text-xs font-mono px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Example</span>
          </button>
          <ClearButton onClear={handleClear} disabled={!input} />
        </div>
      </div>

      {/* Editor & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="json-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-400" />
              <span>Input JSON</span>
            </label>
            <CopyButton text={input} label="Copy Input" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
            <textarea
              id="json-input"
              rows={16}
              value={input}
              onChange={handleInputChange}
              placeholder="Paste raw or unformatted JSON here..."
              className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950 font-normal"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{input.length.toLocaleString()} chars ({result.byteSize} bytes)</span>
              <span>Direct Client Validation</span>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                {mode === 'formatted' ? 'Prettified Result' : 'Minified Result'}
              </span>
              {result.isValid && input.trim() && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid JSON</span>
                </span>
              )}
            </div>
            <CopyButton text={displayedOutput} label="Copy Output" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col h-[380px] overflow-hidden">
            {result.error ? (
              <div className="p-4 space-y-3">
                <ErrorMessage message={result.error} />
                {result.errorLocation && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400">
                    <div>Line: <strong className="text-amber-400">{result.errorLocation.line}</strong>, Column: <strong className="text-amber-400">{result.errorLocation.column}</strong></div>
                    <div className="text-[11px] text-slate-500 mt-1">Check for missing quotes, trailing commas, or unclosed braces.</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto overflow-y-auto whitespace-pre flex-1 select-all selection:bg-brand-500 selection:text-slate-950">
                {displayedOutput || (
                  <span className="text-slate-600 italic font-sans select-none">
                    Formatted output will appear here...
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{displayedOutput ? `${displayedOutput.length.toLocaleString()} chars` : '0 chars'} {result.keyCount !== undefined && `• ${result.keyCount} keys`}</span>
              <span className="text-emerald-400">100% In-Browser</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
