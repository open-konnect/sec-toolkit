import React from 'react';

export type BadgeVariant = 'default' | 'info' | 'low' | 'medium' | 'high' | 'critical' | 'success' | 'outline';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
  size = 'md'
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
    info: 'bg-sky-950/60 text-sky-300 border border-sky-800/60',
    low: 'bg-blue-950/60 text-blue-300 border border-blue-800/60',
    medium: 'bg-amber-950/60 text-amber-300 border border-amber-800/60',
    high: 'bg-orange-950/60 text-orange-300 border border-orange-800/60',
    critical: 'bg-rose-950/60 text-rose-300 border border-rose-800/70',
    success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60',
    outline: 'bg-transparent text-slate-400 border border-slate-700',
  };

  return (
    <span className={`inline-flex items-center font-mono font-medium rounded-md tracking-wide uppercase ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
