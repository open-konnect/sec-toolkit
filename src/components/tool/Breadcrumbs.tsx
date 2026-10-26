import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Visible, keyboard-accessible breadcrumb trail.
 * BreadcrumbList structured data is generated from the same items in PageSeo.
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 select-none">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />}
              {isLast || !item.to ? (
                <span className="text-slate-200 font-medium truncate" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded"
                >
                  {index === 0 && <Home className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
