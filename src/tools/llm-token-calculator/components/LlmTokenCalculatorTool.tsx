import React, { useState, useMemo } from 'react';
import { POPULAR_LLM_MODELS, estimateTokens, calculateLlmCost } from '../logic/tokenCalculator';
import { LlmModelPreset } from '../types';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { Sparkles, DollarSign, Cpu, FileText, Lock } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const SAMPLE_PROMPT = `You are a senior security engineer conducting an audit of a microservice authentication architecture.
Review the following OAuth 2.0 PKCE implementation details and outline potential vulnerabilities:
1. Authorization code exchange mechanism with 60-second validity window.
2. Code verifier constructed using 43 cryptographically random characters (RFC 7636).
3. State parameter signed with HMAC-SHA256 and stored in an HTTP-only secure cookie.
4. Refresh token rotation with immediate invalidation upon reuse detection.

Provide actionable recommendations and test cases for each area.`;

export const LlmTokenCalculatorTool: React.FC = () => {
  const [promptText, setPromptText] = useState<string>(SAMPLE_PROMPT);
  const [selectedModel, setSelectedModel] = useState<LlmModelPreset>(POPULAR_LLM_MODELS[0]);
  const [outputTokensEstimated, setOutputTokensEstimated] = useState<number>(800);
  
  // Custom pricing overrides
  const [inputRate, setInputRate] = useState<number>(POPULAR_LLM_MODELS[0].inputCostPerMillion);
  const [outputRate, setOutputRate] = useState<number>(POPULAR_LLM_MODELS[0].outputCostPerMillion);

  const { tokens: inputTokensEstimated } = useMemo(() => {
    return estimateTokens(promptText);
  }, [promptText]);

  const calculation = useMemo(() => {
    return calculateLlmCost(
      inputTokensEstimated,
      outputTokensEstimated,
      inputRate,
      outputRate,
      promptText
    );
  }, [inputTokensEstimated, outputTokensEstimated, inputRate, outputRate, promptText]);

  const handleModelSelect = (model: LlmModelPreset) => {
    setSelectedModel(model);
    setInputRate(model.inputCostPerMillion);
    setOutputRate(model.outputCostPerMillion);
    analytics.track('tool_used', { tool: 'llm-token-calculator', action: 'select_model', model: model.id });
  };

  const formatCurrency = (val: number) => {
    if (val < 0.0001 && val > 0) return `$${val.toFixed(6)}`;
    return `$${val.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/40 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-emerald-300 block">
            100% Client-Side Estimation • Zero API Transmission
          </span>
          <p className="text-slate-300 leading-relaxed">
            Your prompt text is analyzed locally using Byte-Pair Encoding (BPE) heuristics. No prompts are ever transmitted to OpenAI, Anthropic, Google, or any remote server.
          </p>
        </div>
      </div>

      {/* Model Preset Selection */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider block">
          Select Model Preset (Pricing data is fully editable):
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {POPULAR_LLM_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => handleModelSelect(model)}
              className={`text-xs font-mono px-3.5 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                selectedModel.id === model.id
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{model.name}</span>
            </button>
          ))}
        </div>

        {/* Editable Rate Inputs */}
        <div className="pt-2 flex flex-wrap items-center gap-6 border-t border-slate-800/80 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-2">
            <span>Input Rate ($/1M tokens):</span>
            <input
              type="number"
              step="0.01"
              value={inputRate}
              onChange={(e) => setInputRate(parseFloat(e.target.value) || 0)}
              className="w-24 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Output Rate ($/1M tokens):</span>
            <input
              type="number"
              step="0.01"
              value={outputRate}
              onChange={(e) => setOutputRate(parseFloat(e.target.value) || 0)}
              className="w-24 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Expected Output Tokens:</span>
            <input
              type="number"
              step="100"
              value={outputTokensEstimated}
              onChange={(e) => setOutputTokensEstimated(parseInt(e.target.value) || 0)}
              className="w-24 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Cost & Token Estimation Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Estimated Input Tokens
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              ~{calculation.estimatedInputTokens.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">tokens</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 mt-2">
            Cost: {formatCurrency(calculation.inputCost)}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Estimated Output Tokens
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              ~{calculation.estimatedOutputTokens.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">tokens</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 mt-2">
            Cost: {formatCurrency(calculation.outputCost)}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
            Total Estimated Call Cost
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-emerald-300">
              {formatCurrency(calculation.totalCost)}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 mt-2">
            ~{((calculation.estimatedInputTokens + calculation.estimatedOutputTokens) / selectedModel.contextWindow * 100).toFixed(2)}% of {selectedModel.contextWindow.toLocaleString()} context
          </span>
        </div>
      </div>

      {/* Input Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="prompt-text" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Paste Prompt, Document or Code:</span>
          </label>
          <div className="flex items-center gap-2">
            <ClearButton onClear={() => setPromptText('')} disabled={!promptText} />
            <CopyButton text={promptText} label="Copy Text" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all flex flex-col">
          <textarea
            id="prompt-text"
            rows={10}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Paste text here to estimate token count and compute API pricing..."
            className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
            spellCheck={false}
          />
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
            <span>{calculation.characterCount.toLocaleString()} characters ({calculation.wordCount.toLocaleString()} words)</span>
            <span>BPE Heuristic Estimate</span>
          </div>
        </div>
      </div>
    </div>
  );
};
