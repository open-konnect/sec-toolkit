import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface WarningMessageProps {
  title?: string;
  message: string;
  className?: string;
}

export const WarningMessage: React.FC<WarningMessageProps> = ({
  title,
  message,
  className = ''
}) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-sm ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        {title && <div className="font-semibold text-amber-300 text-xs mb-1">{title}</div>}
        <div className="font-mono text-xs leading-relaxed">{message}</div>
      </div>
    </div>
  );
};
