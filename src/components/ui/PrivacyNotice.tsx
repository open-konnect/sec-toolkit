import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface PrivacyNoticeProps {
  compact?: boolean;
  className?: string;
}

export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({
  compact = false,
  className = ''
}) => {
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-mono ${className}`}>
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>100% Client-Side • Zero Data Uploaded</span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl bg-slate-900/60 border border-emerald-900/30 relative overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-emerald-300">Privacy Guarantee</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Your data stays in your browser.</strong> These tools process your input locally using native Web APIs.
            No tokens, credentials, or generated values are ever transmitted to any remote server, stored in cookies, or logged.
          </p>
        </div>
      </div>
    </div>
  );
};
