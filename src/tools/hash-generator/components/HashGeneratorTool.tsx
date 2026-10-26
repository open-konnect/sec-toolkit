import React, { useState, useEffect } from 'react';
import { HashAlgorithm, HashResult } from '../types';
import { computeHash } from '../logic/hashCalculator';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ClearButton } from '../../../components/ui/ClearButton';
import { WarningMessage } from '../../../components/ui/WarningMessage';
import { Hash, ShieldAlert, KeyRound } from 'lucide-react';
import { analytics } from '../../../lib/analytics';

const ALGORITHMS: Array<{ id: HashAlgorithm; name: string; bits: number; desc: string; weak?: boolean }> = [
  { id: 'SHA-256', name: 'SHA-256', bits: 256, desc: 'Industry standard, strong cryptographic security (NIST approved).' },
  { id: 'SHA-512', name: 'SHA-512', bits: 512, desc: 'High entropy 512-bit digest, ideal for sensitive data integrity.' },
  { id: 'SHA-384', name: 'SHA-384', bits: 384, desc: 'Truncated 384-bit variant of SHA-512.' },
  { id: 'SHA-1', name: 'SHA-1 (Legacy)', bits: 160, desc: 'Deprecated. Cryptographically broken by collision attacks.', weak: true }
];

export const HashGeneratorTool: React.FC = () => {
  const [input, setInput] = useState<string>('Developer Security Toolkit');
  const [selectedAlg, setSelectedAlg] = useState<HashAlgorithm>('SHA-256');
  const [result, setResult] = useState<HashResult | null>(null);

  useEffect(() => {
    let isCancelled = false;
    computeHash(input, selectedAlg).then((res) => {
      if (!isCancelled) {
        setResult(res);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [input, selectedAlg]);

  const handleAlgChange = (alg: HashAlgorithm) => {
    setSelectedAlg(alg);
    analytics.track('tool_used', { tool: 'hash-generator', action: 'select_algorithm', algorithm: alg });
  };

  return (
    <div className="space-y-6">
      {/* Algorithm selector pills */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider block">
          Select Hash Function (Web Crypto CSPRNG):
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {ALGORITHMS.map((alg) => (
            <button
              key={alg.id}
              type="button"
              onClick={() => handleAlgChange(alg.id)}
              className={`text-xs font-mono px-3.5 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                selectedAlg === alg.id
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>{alg.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Weak Algorithm Warning */}
      {selectedAlg === 'SHA-1' && (
        <WarningMessage
          title="Security Advisory: SHA-1 is Deprecated"
          message="SHA-1 is no longer considered cryptographically secure due to practical collision attacks (e.g. SHAttered attack). Do not use SHA-1 for digital signatures, certificates, or tamper-proofing."
        />
      )}

      {/* Input Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="hash-input" className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Plaintext Input (UTF-8)</span>
          </label>
          <div className="flex items-center gap-2">
            <ClearButton onClear={() => setInput('')} disabled={!input} />
            <CopyButton text={input} label="Copy Input" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/80 transition-all">
          <textarea
            id="hash-input"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste text to compute its hash digest..."
            className="w-full bg-transparent p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-brand-500 selection:text-slate-950"
            spellCheck={false}
          />
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px] font-mono text-slate-400">
            <span>{input.length.toLocaleString()} characters ({new Blob([input]).size} bytes)</span>
            <span>crypto.subtle.digest()</span>
          </div>
        </div>
      </div>

      {/* Output Hash Digest */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>{selectedAlg} Digest (Hexadecimal)</span>
          </span>
          <CopyButton text={result?.hex || ''} label="Copy Digest" />
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-sm text-emerald-300 break-all select-all selection:bg-brand-500 selection:text-slate-950 min-h-[56px] flex items-center">
          {result?.hex || <span className="text-slate-600 font-sans text-xs italic select-none">Enter input to generate hash...</span>}
        </div>

        {result && result.hex && (
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span>Length: {result.hex.length} hex chars ({result.bitLength} bits)</span>
            <span>Deterministic One-Way Digest</span>
          </div>
        )}
      </div>

      {/* Distinctions Alert Box */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Hashing vs. Encryption vs. Encoding</span>
        </div>
        <p className="leading-relaxed">
          <strong className="text-slate-200">Hashing:</strong> A one-way mathematical function that produces a fixed-size digest. Hashes cannot be "decrypted" because original information is irreversibly condensed.<br />
          <strong className="text-slate-200">Encryption:</strong> A two-way function that transforms data using a key so only holders of the corresponding key can decrypt it.<br />
          <strong className="text-slate-200">Encoding (e.g. Base64):</strong> A reversible format representation without keys. Has zero security or confidentiality.
        </p>
      </div>
    </div>
  );
};
