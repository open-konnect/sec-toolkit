import React, { useState, useMemo } from 'react';
import { parseJwt } from '../logic/jwtParser';
import { analyzeJwt } from '../logic/jwtAnalyzer';
import { SAMPLE_TOKENS } from '../logic/sampleTokens';
import { JsonViewer } from '../../../components/ui/JsonViewer';
import { ClearButton } from '../../../components/ui/ClearButton';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { JwtSignatureViewer } from './JwtSignatureViewer';
import { JwtFindingsList } from './JwtFindingsList';
import { analytics } from '../../../lib/analytics';
import { ShieldAlert, Sparkles, Key, FileCode } from 'lucide-react';

export const JwtTool: React.FC = () => {
  const [tokenInput, setTokenInput] = useState<string>(SAMPLE_TOKENS[0].token);
  const [activeTab, setActiveTab] = useState<'decoded' | 'security'>('decoded');

  // Parse and analyze memoized
  const analysis = useMemo(() => {
    const parsed = parseJwt(tokenInput);
    return analyzeJwt(parsed);
  }, [tokenInput]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTokenInput(e.target.value);
    if (e.target.value.trim()) {
      analytics.track('tool_used', { tool: 'jwt-decoder', action: 'input_change' });
    }
  };

  const handleClear = () => {
    setTokenInput('');
  };

  const handleLoadSample = (sampleToken: string) => {
    setTokenInput(sampleToken);
    analytics.track('tool_used', { tool: 'jwt-decoder', action: 'load_sample' });
  };

  const parsed = analysis.parsed;
  const isInputEmpty = !tokenInput.trim();

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="jwt-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            <span>Paste Encoded JWT (Compact Serialization)</span>
          </label>

          <div className="flex items-center gap-2">
            <ClearButton onClear={handleClear} disabled={isInputEmpty} />
            <CopyButton text={tokenInput} label="Copy Token" />
          </div>
        </div>

        {/* Textarea */}
        <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all">
          <textarea
            id="jwt-input"
            rows={5}
            value={tokenInput}
            onChange={handleInputChange}
            placeholder="Paste your JSON Web Token here (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
            className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
            spellCheck={false}
          />

          <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
            <span>
              Length: {tokenInput.length.toLocaleString()} chars ({new Blob([tokenInput]).size} bytes)
            </span>
            <span className="text-emerald-400/80">Local Browser Processing</span>
          </div>
        </div>

        {/* Sample Loaders */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Sample:</span>
          </span>
          {SAMPLE_TOKENS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleLoadSample(s.token)}
              className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              title={s.description}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Prominent Verification Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-800/40 text-amber-200 text-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-300">
              Important: Decoding a JWT does not verify its cryptographic signature.
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              Anyone can alter the payload of an unverified token. Never trust the claims (such as user ID or roles) inside a JWT
              until it has been cryptographically validated by your backend using the correct secret key or public certificate.
            </p>
          </div>
        </div>
      </div>

      {/* Parsing Errors (if any) */}
      {parsed?.parseError && (
        <ErrorMessage message={parsed.parseError} />
      )}

      {/* Decoded Content & Analysis Sections */}
      {!isInputEmpty && parsed?.isValidStructure && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('decoded')}
              className={`px-4 py-3 text-xs font-mono font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'decoded'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Decoded Data (Header & Payload)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-4 py-3 text-xs font-mono font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'security'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security Analysis ({analysis.findings.length})</span>
            </button>
          </div>

          {activeTab === 'decoded' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                    Header (Algorithm & Token Type)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    alg: {parsed.header?.alg || 'none'}
                  </span>
                </div>
                <JsonViewer
                  data={parsed.header}
                  title="JOSE Header"
                />
              </div>

              {/* Payload */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                    Payload (Claims & Data)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {Object.keys(parsed.payload || {}).length} claims
                  </span>
                </div>
                <JsonViewer
                  data={parsed.payload}
                  title="Decoded Payload Claims"
                  highlightTimestamps={true}
                />
              </div>

              {/* Signature Viewer full width */}
              <div className="lg:col-span-2 pt-2">
                <JwtSignatureViewer
                  rawSignature={parsed.segments.rawSignature}
                  alg={parsed.header?.alg}
                />
              </div>
            </div>
          ) : (
            <div>
              <JwtFindingsList findings={analysis.findings} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
