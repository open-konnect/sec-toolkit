import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ErrorMessageProps {
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 text-sm ${className}`}
    >
      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div className="font-mono text-xs leading-relaxed break-all">{message}</div>
    </div>
  );
};
