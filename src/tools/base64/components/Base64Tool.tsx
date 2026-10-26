import React, { useState, useMemo } from 'react';
import { Base64Mode, Base64Variant } from '../types';
import { convertBase64 } from '../logic/base64Converter';
import { ClearButton } from '../../../components/ui/ClearButton';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { analytics } from '../../../lib/analytics';
import { Binary, ArrowUpDown, Sparkles } from 'lucide-react';

export const Base64Tool: React.FC = () => {
  const [input, setInput] = useState<string>('Developer Security Toolkit 🔐 2026');
  const [mode, setMode] = useState<Base64Mode>('encode');
  const [variant, setVariant] = useState<Base64Variant>('standard');

  const conversion = useMemo(() => {
    return convertBase64(input, { mode, variant });
  }, [input, mode, variant]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    analytics.track('tool_used', { tool: 'base64', action: 'input_change', mode });
  };

  const handleModeSwitch = (newMode: Base64Mode) => {
    setMode(newMode);
    analytics.track('tool_used', { tool: 'base64', action: 'switch_mode', mode: newMode });
  };

  const handleVariantSwitch = (newVariant: Base64Variant) => {
    setVariant(newVariant);
    analytics.track('tool_used', { tool: 'base64', action: 'switch_variant', variant: newVariant });
  };

  const handleSwap = () => {
    if (conversion.success && conversion.output) {
      setInput(conversion.output);
      setMode(mode === 'encode' ? 'decode' : 'encode');
    }
  };

  const handleSample = (text: string, sampleMode: Base64Mode) => {
    setInput(text);
    setMode(sampleMode);
    analytics.track('tool_used', { tool: 'base64', action: 'load_sample' });
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar: Mode & Variant Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Encode / Decode Switch */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => handleModeSwitch('encode')}
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
            onClick={() => handleModeSwitch('decode')}
            className={`text-xs font-mono px-4 py-2 rounded-md font-semibold transition-all ${
              mode === 'decode'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Decode
          </button>
        </div>

        {/* Variant: Standard vs Base64URL */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Format:</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleVariantSwitch('standard')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                variant === 'standard'
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Standard (+ / =)
            </button>
            <button
              type="button"
              onClick={() => handleVariantSwitch('urlSafe')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                variant === 'urlSafe'
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Base64URL (- _ unpadded)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Input and Output Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base64-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Binary className="w-4 h-4 text-emerald-400" />
              <span>{mode === 'encode' ? 'Plaintext / UTF-8 Input' : 'Base64 Encoded Input'}</span>
            </label>
            <div className="flex items-center gap-2">
              <ClearButton onClear={() => setInput('')} disabled={!input} />
              <CopyButton text={input} label="Copy Input" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
            <textarea
              id="base64-input"
              rows={8}
              value={input}
              onChange={handleInputChange}
              placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Paste Base64 or Base64URL string here...'}
              className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
              spellCheck={false}
            />
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{input.length.toLocaleString()} characters ({conversion.inputBytes} bytes)</span>
              <span>UTF-8 Safe</span>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>{mode === 'encode' ? 'Base64 Encoded Result' : 'Decoded UTF-8 Output'}</span>
            </span>
            <div className="flex items-center gap-2">
              {conversion.success && conversion.output && (
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
              <CopyButton text={conversion.output} label="Copy Output" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col min-h-[212px]">
            {conversion.error ? (
              <div className="p-4">
                <ErrorMessage message={conversion.error} />
              </div>
            ) : (
              <div className="p-4 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all flex-1 select-all selection:bg-brand-500 selection:text-slate-950">
                {conversion.output || (
                  <span className="text-slate-600 italic font-sans select-none">
                    Output will appear here automatically...
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
              <span>{conversion.output.length.toLocaleString()} characters ({conversion.outputBytes} bytes)</span>
              <span className="text-emerald-400">Client-Side Processed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Preset Samples */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Presets:</span>
        </span>
        <button
          type="button"
          onClick={() => handleSample('Hello, World! 🚀', 'encode')}
          className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
        >
          Text with Emoji
        </button>
        <button
          type="button"
          onClick={() => handleSample('{"auth": true, "role": "admin"}', 'encode')}
          className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
        >
          JSON String
        </button>
        <button
          type="button"
          onClick={() => handleSample('ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5', 'decode')}
          className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
        >
          Base64 Sample
        </button>
      </div>
    </div>
  );
};
