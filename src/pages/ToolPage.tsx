import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getToolBySlug } from '../tools/registry';
import { ToolHeader } from '../components/tool/ToolHeader';
import { EducationalSection } from '../components/tool/EducationalSection';
import { SEOHead } from '../components/tool/SEOHead';
import { ToolDefinition } from '../types';

export interface ToolPageProps {
  toolDefinition?: ToolDefinition;
}

export const ToolPage: React.FC<ToolPageProps> = ({ toolDefinition: propTool }) => {
  const { slug } = useParams<{ slug: string }>();

  // Use passed tool prop or look up by slug from route param
  const tool = propTool || (slug ? getToolBySlug(slug) : undefined);

  if (!tool) {
    return <Navigate to="/404" replace />;
  }

  const ToolComponent = tool.component;

  return (
    <div className="space-y-8">
      {/* SEO & Structured Data */}
      <SEOHead
        title={tool.seo.title}
        description={tool.seo.description}
        canonicalPath={tool.seo.canonicalPath}
        keywords={tool.keywords}
        faqs={tool.educationalContent?.faqs}
      />

      {/* Tool Header */}
      <ToolHeader
        name={tool.name}
        category={tool.category}
        shortDescription={tool.shortDescription}
        badge={tool.badge}
      />

      {/* Core Tool Application Component */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <ToolComponent />
      </div>

      {/* Educational & Technical Documentation Section */}
      {tool.educationalContent && (
        <EducationalSection data={tool.educationalContent} />
      )}
    </div>
  );
};
