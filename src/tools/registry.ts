import { ToolDefinition, ToolCategory, CategoryInfo } from '../types';

// Tool imports
import { jwtToolDefinition } from './jwt';
import { hashGeneratorToolDefinition } from './hash-generator';
import { jwtGeneratorToolDefinition } from './jwt-generator';
import { cspGeneratorToolDefinition } from './csp-generator';
import { securityHeadersToolDefinition } from './security-headers';
import { passwordStrengthToolDefinition } from './password-strength';

import { base64ToolDefinition } from './base64';
import { urlEncoderToolDefinition } from './url-encoder';

import { jsonFormatterToolDefinition } from './json-formatter';
import { jsonToTypescriptToolDefinition } from './json-to-typescript';

import { uuidToolDefinition } from './uuid';
import { timestampConverterToolDefinition } from './timestamp-converter';
import { regexTesterToolDefinition } from './regex-tester';
import { cronGeneratorToolDefinition } from './cron-generator';

import { llmTokenCalculatorToolDefinition } from './llm-token-calculator';

/**
 * 5 Canonical Categories
 */
export const TOOL_CATEGORIES: CategoryInfo[] = [
  {
    id: 'security',
    name: 'Security',
    description: 'Analyze tokens, generate security configurations, and inspect security primitives locally.',
    iconName: 'Shield'
  },
  {
    id: 'encoding',
    name: 'Encoding',
    description: 'Encode and decode standard binary, text, and URI formats with full UTF-8 support.',
    iconName: 'Binary'
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Format, validate, and convert structured data payloads and types in your browser.',
    iconName: 'Database'
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Essential workflow utilities for timestamps, regular expressions, UUIDs, and cron.',
    iconName: 'Terminal'
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Privacy-first token counting, context-window calculation, and LLM cost estimation.',
    iconName: 'Sparkles'
  }
];

/**
 * The 15 Registered Tools
 */
export const REGISTERED_TOOLS: ToolDefinition[] = [
  // Security (6)
  jwtToolDefinition,
  hashGeneratorToolDefinition,
  jwtGeneratorToolDefinition,
  cspGeneratorToolDefinition,
  securityHeadersToolDefinition,
  passwordStrengthToolDefinition,

  // Encoding (2)
  base64ToolDefinition,
  urlEncoderToolDefinition,

  // Data (2)
  jsonFormatterToolDefinition,
  jsonToTypescriptToolDefinition,

  // Developer (4)
  uuidToolDefinition,
  timestampConverterToolDefinition,
  regexTesterToolDefinition,
  cronGeneratorToolDefinition,

  // AI (1)
  llmTokenCalculatorToolDefinition
];

/**
 * Registry Helper Functions
 */
export function getToolBySlug(slug: string): ToolDefinition | undefined {
  const normalized = slug.replace(/^\//, '').toLowerCase();
  return REGISTERED_TOOLS.find(tool => tool.slug.toLowerCase() === normalized);
}

export function getToolById(id: string): ToolDefinition | undefined {
  return REGISTERED_TOOLS.find(tool => tool.id === id);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return REGISTERED_TOOLS.filter(tool => tool.category === category);
}

export function getFeaturedTools(): ToolDefinition[] {
  return REGISTERED_TOOLS.filter(tool => tool.featured);
}

export function getRelatedTools(toolId: string): ToolDefinition[] {
  const current = getToolById(toolId);
  if (!current || !current.relatedTools || current.relatedTools.length === 0) {
    // Fallback: return tools from same category excluding current
    return REGISTERED_TOOLS.filter(t => t.category === current?.category && t.id !== toolId).slice(0, 3);
  }

  const related = current.relatedTools
    .map(id => getToolById(id))
    .filter((t): t is ToolDefinition => t !== undefined);

  return related.slice(0, 4);
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
