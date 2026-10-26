import React, { useState, useMemo } from 'react';
import { testRegex } from '../logic/regexMatcher';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Search, Sparkles, ArrowRightLeft, Layers } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const PRESET_PATTERNS = [
  { name: 'Email Address', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: 'gm' },
  { name: 'IPv4 Address', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { name: 'ISO Date', pattern: '\\b\\d{4}-\\d{2}-\\d{2}\\b', flags: 'g' },
  { name: 'UUID v4', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', flags: 'gi' }
];

export const RegexTesterTool: React.FC = () => {
  const [pattern, setPattern] = useState<string>('([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})');
  const [flags, setFlags] = useState<{ [key: string]: boolean }>({
    g: true,
    i: true,
    m: false,
    s: false,
    u: true
  });
  const [testString, setTestString] = useState<string>(
    'Contact security@example.com or support@developer-toolkit.org for assistance with auth tokens.'
  );
  const [showReplace, setShowReplace] = useState<boolean>(false);
  const [replacement, setReplacement] = useState<string>('contact-$1@masked.domain');

  const activeFlagsString = Object.entries(flags)
    .filter(([_, active]) => active)
    .map(([flag]) => flag)
    .join('');

  const result = useMemo(() => {
    return testRegex(pattern, activeFlagsString, testString, showReplace ? replacement : undefined);
  }, [pattern, activeFlagsString, testString, showReplace, replacement]);

  const toggleFlag = (flag: string) => {
    setFlags(prev => ({ ...prev, [flag]: !prev[flag] }));
    analytics.track('tool_used', { tool: 'regex-tester', action: 'toggle_flag', flag });
  };

  const handleApplyPreset = (p: string, f: string) => {
    setPattern(p);
    const newFlags: { [key: string]: boolean } = { g: false, i: false, m: false, s: false, u: false };
    for (const char of f) {
      if (char in newFlags) newFlags[char] = true;
    }
    setFlags(newFlags);
    analytics.track('tool_used', { tool: 'regex-tester', action: 'load_preset' });
  };

  return (
    <div className="space-y-6">
      {/* Pattern Input Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="regex-pattern" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Regular Expression Pattern</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReplace(!showReplace)}
              className={`text-xs font-mono px-2.5 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${
                showReplace
                  ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Replace Mode</span>
            </button>
            <ClearButton onClear={() => setPattern('')} disabled={!pattern} />
          </div>
        </div>

        {/* Pattern Input and Flags */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 focus-within:border-emerald-500">
            <span className="text-slate-500 font-mono text-sm select-none">/</span>
            <input
              id="regex-pattern"
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. [a-z0-9]+..."
              className="w-full bg-transparent px-2 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none"
              spellCheck={false}
            />
            <span className="text-slate-500 font-mono text-sm select-none">/{activeFlagsString}</span>
          </div>

          {/* Flag toggles */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-mono">
            {['g', 'i', 'm', 's', 'u'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFlag(f)}
                className={`w-7 h-7 rounded-lg font-bold transition-colors ${
                  flags[f]
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                    : 'text-slate-500 hover:text-white'
                }`}
                title={`Flag /${f}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Replacement input if replace mode active */}
        {showReplace && (
          <div className="pt-2 flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Replace With:</span>
            <input
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="e.g. $1 or replacement text"
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Pattern error display */}
      {!result.isValid && result.error && (
        <ErrorMessage message={result.error} />
      )}

      {/* Test String and Match Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test String */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="test-string" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
              Test String
            </label>
            <ClearButton onClear={() => setTestString('')} disabled={!testString} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
            <textarea
              id="test-string"
              rows={10}
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              placeholder="Paste or enter test string to evaluate regex matches..."
              className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{testString.length.toLocaleString()} characters</span>
              <span>Matched in {result.executionTimeMs}ms</span>
            </div>
          </div>
        </div>

        {/* Matches Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                Matches ({result.matches.length})
              </span>
            </div>
            {showReplace && result.replacedText && (
              <CopyButton text={result.replacedText} label="Copy Replaced Output" />
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 h-[256px] overflow-y-auto space-y-3 font-mono text-xs">
            {showReplace && result.replacedText !== undefined ? (
              <div>
                <span className="text-[10px] uppercase text-slate-400 block mb-1">Replaced Output Preview:</span>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 whitespace-pre-wrap select-all">
                  {result.replacedText}
                </div>
              </div>
            ) : null}

            {result.matches.length > 0 ? (
              <div className="space-y-2">
                {result.matches.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold select-all">
                        Match {item.index + 1}: "{item.match}"
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Index: {item.startIndex}–{item.endIndex}
                      </span>
                    </div>

                    {item.groups && item.groups.length > 0 && (
                      <div className="pl-3 border-l-2 border-slate-800 text-[11px] text-slate-300 space-y-0.5">
                        {item.groups.map((group, gIdx) => (
                          <div key={gIdx} className="flex items-baseline gap-2">
                            <span className="text-slate-500 font-semibold">Group {gIdx + 1}:</span>
                            <span className="text-amber-300 select-all font-mono">{group !== undefined ? `"${group}"` : 'undefined'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 italic text-xs py-8 text-center select-none">
                No regex matches found in test string.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Preset Patterns:</span>
        </span>
        {PRESET_PATTERNS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => handleApplyPreset(p.pattern, p.flags)}
            className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
};
