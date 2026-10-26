import React from 'react';
import { Trash2 } from 'lucide-react';

export interface ClearButtonProps {
  onClear: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const ClearButton: React.FC<ClearButtonProps> = ({
  onClear,
  disabled = false,
  label = 'Clear',
  className = ''
}) => {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md transition-colors border select-none
        bg-slate-800/80 hover:bg-rose-950/40 border-slate-700 hover:border-rose-800/60 text-slate-300 hover:text-rose-300
        disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
      <span>{label}</span>
    </button>
  );
};
