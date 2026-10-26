import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { ToolCategory } from '../types';
import { TOOL_CATEGORIES, getToolsByCategory } from '../tools/registry';
import { ToolCard } from '../components/tool/ToolCard';
import { Breadcrumbs, BreadcrumbItem } from '../components/tool/Breadcrumbs';
import { EducationalSection } from '../components/tool/EducationalSection';
import { SEOHead } from '../components/tool/SEOHead';
import { getCategory, getCategoryPageSeo } from '../seo/pages';
import { NotFoundPage } from './NotFoundPage';

export interface CategoryPageProps {
  categoryId: ToolCategory;
}

export const CategoryPage: React.FC<CategoryPageProps> = ({ categoryId }) => {
  const category = getCategory(categoryId);
  const tools = useMemo(() => getToolsByCategory(categoryId), [categoryId]);
  const seo = useMemo(() => (category ? getCategoryPageSeo(category) : null), [category]);

  if (!category || !seo) {
    return <NotFoundPage />;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', to: '/' },
    { label: category.name }
  ];

  const otherCategories = TOOL_CATEGORIES.filter((item) => item.id !== category.id);

  return (
    <div className="space-y-10">
      <SEOHead seo={seo} />

      <Breadcrumbs items={breadcrumbs} />

      <header className="max-w-4xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{category.name} · {tools.length} tools</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {category.name} Tools
        </h1>
        <p className="text-base text-slate-300 font-light leading-relaxed">{category.intro}</p>
      </header>

      <section aria-labelledby="category-tools-heading" className="space-y-4">
        <h2 id="category-tools-heading" className="text-lg font-bold text-white tracking-tight">
          {category.name} utilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <EducationalSection data={category.educationalContent} />

      <section className="mt-12 pt-8 border-t border-slate-800/80" aria-labelledby="other-categories-heading">
        <h2 id="other-categories-heading" className="text-lg font-bold text-white tracking-tight mb-4">
          Explore other categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {otherCategories.map((item) => (
            <Link
              key={item.id}
              to={`/${item.id}`}
              className="group p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/50 hover:bg-slate-900 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                {item.name} tools
              </span>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                {item.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                Browse <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            View all tools
          </Link>
        </div>
      </section>
    </div>
  );
};
