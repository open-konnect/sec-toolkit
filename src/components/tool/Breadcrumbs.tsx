import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { ToolCategory } from '../../types';

export interface BreadcrumbsProps {
  category: ToolCategory;
  toolName: string;
}

const CATEGORY_NAMES: Record<ToolCategory, string> = {
  security: 'Security',
  encoding: 'Encoding',
  data: 'Data',
  developer: 'Developer',
  ai: 'AI'
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ category, toolName }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-4 select-none">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-emerald-400 transition-colors focus:outline-none focus:underline"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <Link
        to={`/?category=${category}`}
        className="hover:text-emerald-400 transition-colors focus:outline-none focus:underline capitalize"
      >
        {CATEGORY_NAMES[category] || category}
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <span className="text-slate-200 font-medium truncate" aria-current="page">
        {toolName}
      </span>
    </nav>
  );
};
