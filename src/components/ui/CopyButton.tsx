import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../lib/formatting/clipboard';

export interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors border select-none
        ${copied 
          ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' 
          : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
        } ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-slate-400" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
