import React, { useState, useMemo } from 'react';
import { analyzePassword } from '../logic/passwordAnalyzer';
import { PasswordStrengthLevel } from '../types';
import { ClearButton } from '../../../components/ui/ClearButton';
import { WarningMessage } from '../../../components/ui/WarningMessage';
import { ShieldCheck, ShieldAlert, KeyRound, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const STRENGTH_CONFIG: Record<PasswordStrengthLevel, { label: string; color: string; bg: string; width: string }> = {
  'very-weak': { label: 'Very Weak', color: 'text-rose-400', bg: 'bg-rose-500', width: 'w-1/5' },
  'weak': { label: 'Weak', color: 'text-orange-400', bg: 'bg-orange-500', width: 'w-2/5' },
  'fair': { label: 'Fair', color: 'text-amber-400', bg: 'bg-amber-500', width: 'w-3/5' },
  'strong': { label: 'Strong', color: 'text-emerald-400', bg: 'bg-emerald-500', width: 'w-4/5' },
  'very-strong': { label: 'Very Strong', color: 'text-emerald-300', bg: 'bg-emerald-400', width: 'w-full' }
};

export const PasswordStrengthTool: React.FC = () => {
  const [password, setPassword] = useState<string>('Correct-Horse-Battery-Staple!2026');
  const [showPassword, setShowPassword] = useState<boolean>(true);

  const analysis = useMemo(() => {
    return analyzePassword(password);
  }, [password]);

  const config = STRENGTH_CONFIG[analysis.level];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Note: NEVER pass password value to analytics!
    analytics.track('tool_used', { tool: 'password-strength', action: 'input_change' });
  };

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/40 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-emerald-300 block">
            Zero Server Uploads • 100% In-Browser Privacy
          </span>
          <p className="text-slate-300 leading-relaxed">
            Your password is analyzed purely in client memory and is never transmitted over the network, stored in cookies, or sent to analytics.
          </p>
        </div>
      </div>

      {/* Password Input Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="pwd-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Enter Password or Passphrase</span>
          </label>
          <ClearButton onClear={() => setPassword('')} disabled={!password} />
        </div>

        <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all flex items-center">
          <input
            id="pwd-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={handleInputChange}
            placeholder="Type a password to test..."
            className="w-full bg-transparent p-4 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none pr-12 select-all selection:bg-brand-500 selection:text-slate-950"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 text-slate-400 hover:text-white transition-colors"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Strength Bar & Score Overview */}
      {password && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Strength:</span>
              <span className={`text-base font-bold font-mono tracking-tight ${config.color}`}>
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>Length: <strong className="text-slate-200">{analysis.length}</strong> chars</span>
              <span>Entropy: <strong className="text-slate-200">~{analysis.entropyBits}</strong> bits</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className={`h-full ${config.bg} ${config.width} transition-all duration-300 rounded-full`} />
          </div>

          {/* Character Diversity Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
            <span className={`px-2.5 py-1 rounded-md border ${analysis.hasLowercase ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
              Lowercase (a-z)
            </span>
            <span className={`px-2.5 py-1 rounded-md border ${analysis.hasUppercase ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
              Uppercase (A-Z)
            </span>
            <span className={`px-2.5 py-1 rounded-md border ${analysis.hasNumber ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
              Numbers (0-9)
            </span>
            <span className={`px-2.5 py-1 rounded-md border ${analysis.hasSymbol ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
              Symbols (!@#$)
            </span>
          </div>
        </div>
      )}

      {/* Warnings & Suggestions */}
      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          {analysis.warnings.map((w, idx) => (
            <WarningMessage key={idx} title="Structural Weakness Detected" message={w} />
          ))}
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
          <span className="text-xs font-mono font-semibold uppercase text-slate-400 block mb-1">
            Recommendations for Improvement:
          </span>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {analysis.suggestions.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
