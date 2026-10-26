import React, { useState, useMemo } from 'react';
import { generateTypeScriptFromJson } from '../logic/jsonToTsGenerator';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Code2, Sparkles, FileCode } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const SAMPLE_JSON = `{
  "userId": 10482,
  "username": "alex_dev",
  "email": "alex@example.com",
  "isVerified": true,
  "profile": {
    "bio": "Security enthusiast & frontend developer",
    "avatarUrl": "https://example.com/avatar.png",
    "loginCount": 42
  },
  "roles": ["developer", "auditor"],
  "preferences": {
    "theme": "dark",
    "notificationsEnabled": false
  }
}`;

export const JsonToTypescriptTool: React.FC = () => {
  const [jsonInput, setJsonInput] = useState<string>(SAMPLE_JSON);
  const [rootName, setRootName] = useState<string>('UserResponse');
  const [declarationType, setDeclarationType] = useState<'interface' | 'type'>('interface');

  const result = useMemo(() => {
    return generateTypeScriptFromJson(jsonInput, { rootName, declarationType });
  }, [jsonInput, rootName, declarationType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
    analytics.track('tool_used', { tool: 'json-to-typescript', action: 'input_change' });
  };

  const handleClear = () => {
    setJsonInput('');
  };

  const handleLoadSample = () => {
    setJsonInput(SAMPLE_JSON);
    setRootName('UserResponse');
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">Declaration:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setDeclarationType('interface')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                declarationType === 'interface'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              interface
            </button>
            <button
              type="button"
              onClick={() => setDeclarationType('type')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                declarationType === 'type'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              type
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="root-name" className="text-xs font-mono text-slate-400">
            Root Name:
          </label>
          <input
            id="root-name"
            type="text"
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            className="w-36 px-2.5 py-1.5 rounded-md border border-slate-800 bg-slate-950 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs font-mono px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Sample</span>
          </button>
          <ClearButton onClear={handleClear} disabled={!jsonInput} />
        </div>
      </div>

      {/* Editor & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JSON Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="json-raw-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Input JSON</span>
            </label>
            <CopyButton text={jsonInput} label="Copy JSON" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
            <textarea
              id="json-raw-input"
              rows={15}
              value={jsonInput}
              onChange={handleInputChange}
              placeholder="Paste JSON object to generate TypeScript types..."
              className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{jsonInput.length.toLocaleString()} characters</span>
              <span>100% In-Browser</span>
            </div>
          </div>
        </div>

        {/* TypeScript Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Generated TypeScript</span>
            </span>
            <CopyButton text={result.code} label="Copy Types" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col h-[356px] overflow-hidden">
            {result.error ? (
              <div className="p-4">
                <ErrorMessage message={result.error} />
              </div>
            ) : (
              <div className="p-4 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto overflow-y-auto whitespace-pre flex-1 select-all selection:bg-brand-500 selection:text-slate-950">
                {result.code || (
                  <span className="text-slate-600 italic font-sans select-none">
                    TypeScript interfaces will be generated here...
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{result.code ? `${result.code.split('\n').length} lines` : '0 lines'}</span>
              <span className="text-emerald-400">Strict Typing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
