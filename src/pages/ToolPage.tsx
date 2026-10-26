import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getToolBySlug, getRelatedTools } from '../tools/registry';
import { ToolHeader } from '../components/tool/ToolHeader';
import { Breadcrumbs, BreadcrumbItem } from '../components/tool/Breadcrumbs';
import { RelatedTools } from '../components/tool/RelatedTools';
import { EducationalSection } from '../components/tool/EducationalSection';
import { SEOHead } from '../components/tool/SEOHead';
import { ToolDefinition } from '../types';
import { getToolPageSeo } from '../seo/pages';
import { NotFoundPage } from './NotFoundPage';
import { Loader2, ShieldCheck } from 'lucide-react';

export interface ToolPageProps {
  toolDefinition?: ToolDefinition;
}

function ToolInterfaceLoading({ toolName }: { toolName: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[320px] flex flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" aria-hidden="true" />
      <span className="text-sm font-semibold text-slate-200">Loading the {toolName} interface…</span>
      <p className="max-w-md text-xs text-slate-400 leading-relaxed">
        The interactive tool is loading. Your input is processed locally in this browser tab and is never uploaded.
      </p>
      <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        100% client-side processing
      </span>
    </div>
  );
}

function toBreadcrumbItems(seo: ReturnType<typeof getToolPageSeo>): BreadcrumbItem[] {
  return (seo.breadcrumbs || []).map((crumb, index, all) => ({
    label: crumb.name,
    to: index === all.length - 1 ? undefined : crumb.path
  }));
}

/**
 * renderToString does not support Suspense, so the prerender pass renders the
 * same loading state that the client shows during its first render. The client
 * only mounts the lazy tool after hydration, which keeps the initial markup
 * identical and avoids hydration mismatches.
 */
const IS_SSR = import.meta.env.SSR;

export const ToolPage: React.FC<ToolPageProps> = ({ toolDefinition: propTool }) => {
  const { slug } = useParams<{ slug: string }>();
  const tool = propTool || (slug ? getToolBySlug(slug) : undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const seo = useMemo(() => (tool ? getToolPageSeo(tool) : null), [tool]);
  const related = useMemo(() => (tool ? getRelatedTools(tool.id) : []), [tool]);

  if (!tool || !seo) {
    return <NotFoundPage />;
  }

  const ToolComponent = tool.component;
  const breadcrumbs = toBreadcrumbItems(seo);

  return (
    <div className="space-y-8">
      <SEOHead seo={seo} />

      <Breadcrumbs items={breadcrumbs} />

      <ToolHeader
        name={tool.name}
        category={tool.category}
        shortDescription={tool.shortDescription}
        badge={tool.badge}
      />

      <section
        aria-label={`${tool.name} interactive tool`}
        className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-sm"
      >
        {IS_SSR || !hydrated ? (
          <ToolInterfaceLoading toolName={tool.name} />
        ) : (
          <Suspense fallback={<ToolInterfaceLoading toolName={tool.name} />}>
            <ToolComponent />
          </Suspense>
        )}
      </section>

      {tool.educationalContent && (
        <EducationalSection data={tool.educationalContent} />
      )}

      <RelatedTools tools={related} currentToolName={tool.name} />
    </div>
  );
};
