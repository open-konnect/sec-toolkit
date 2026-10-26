import { ToolDefinition, ToolCategory, CategoryInfo } from '../types';
import { jwtToolDefinition } from './jwt';
import { base64ToolDefinition } from './base64';
import { uuidToolDefinition } from './uuid';

/**
 * Category metadata for navigation, grouping, and roadmaps.
 */
export const TOOL_CATEGORIES: CategoryInfo[] = [
  {
    id: 'security',
    name: 'Security & Auth',
    description: 'Inspect tokens, headers, certificates, and authentication credentials.',
    iconName: 'Shield'
  },
  {
    id: 'data',
    name: 'Data & Encoding',
    description: 'Convert, encode, format, and safely parse structured data payloads.',
    iconName: 'Database'
  },
  {
    id: 'developer',
    name: 'Developer Utilities',
    description: 'Essential workflow generators, validators, and developer productivity tools.',
    iconName: 'Terminal'
  },
  {
    id: 'ai',
    name: 'AI & LLM Tools',
    description: 'Token estimation, context-window calculators, and prompt security utilities.',
    iconName: 'Sparkles'
  }
];

/**
 * The Central Tool Registry.
 *
 * To register a new tool:
 * 1. Create `src/tools/<tool-name>/` with its logic, component, and metadata.
 * 2. Add the tool definition to this `REGISTERED_TOOLS` array.
 * 3. The route, card, navigation, and SEO automatically integrate without modifying core app logic.
 */
export const REGISTERED_TOOLS: ToolDefinition[] = [
  jwtToolDefinition,
  base64ToolDefinition,
  uuidToolDefinition
];

/**
 * Tool Registry Helpers
 */
export function getToolBySlug(slug: string): ToolDefinition | undefined {
  const normalized = slug.replace(/^\//, '').toLowerCase();
  return REGISTERED_TOOLS.find(tool => tool.slug.toLowerCase() === normalized);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return REGISTERED_TOOLS.filter(tool => tool.category === category);
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return REGISTERED_TOOLS;

  return REGISTERED_TOOLS.filter(tool => {
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.shortDescription.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q) ||
      tool.keywords.some(k => k.toLowerCase().includes(q))
    );
  });
}
