import React from 'react';

export type ToolCategory = 'security' | 'encoding' | 'data' | 'developer' | 'ai';

export interface CategoryInfo {
  id: ToolCategory;
  name: string;
  description: string;
  iconName: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  educationalContent: EducationalSectionData;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface EducationalSectionData {
  title: string;
  subtitle?: string;
  content: Array<{
    heading: string;
    body: string;
    codeExample?: string;
  }>;
  faqs?: FaqItem[];
}

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: ToolCategory;
  badge?: string;
  featured?: boolean;
  iconName?: string;
  keywords: string[];
  relatedTools?: string[];
  component: React.LazyExoticComponent<React.ComponentType> | React.ComponentType;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
  };
  educationalContent?: EducationalSectionData;
}
