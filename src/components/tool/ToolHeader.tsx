import React from 'react';
import { Badge } from '../ui/Badge';
import { PrivacyNotice } from '../ui/PrivacyNotice';
import { ToolCategory } from '../../types';

export interface ToolHeaderProps {
  name: string;
  category: ToolCategory;
  shortDescription: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  name,
  category,
  shortDescription,
  badge,
  actions
}) => {
  return (
    <div className="border-b border-slate-800/80 pb-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-xs font-mono font-medium text-emerald-400 uppercase tracking-wider">
              {category}
            </span>
            {badge && <Badge variant="info">{badge}</Badge>}
            <PrivacyNotice compact />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {name}
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
            {shortDescription}
          </p>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
