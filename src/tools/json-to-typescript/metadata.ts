import { ToolDefinition } from '../../types';

export const jsonToTypescriptMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'json-to-typescript',
  slug: 'json-to-typescript',
  name: 'JSON to TypeScript Converter',
  shortDescription: 'Infer and generate clean TypeScript interfaces and type definitions from JSON payloads with automatic nested object decomposition.',
  description: 'Convert JSON objects into strongly-typed TypeScript interfaces or type aliases directly in your browser. Recursively resolves nested structures, arrays, and primitive union types.',
  category: 'data',
  badge: 'Type Inference',
  featured: false,
  iconName: 'Code2',
  keywords: ['json to typescript', 'json to ts', 'typescript interfaces', 'type generator', 'json schema to ts', 'ts types from json'],
  relatedTools: ['json-formatter', 'jwt-decoder', 'llm-token-calculator'],
  seo: {
    title: 'JSON to TypeScript Converter — Free Client-Side Type Generator',
    description: 'Paste any JSON object to generate clean, strongly-typed TypeScript interfaces and types locally in your browser with zero data uploads.',
    canonicalPath: '/json-to-typescript'
  },
  educationalContent: {
    title: 'TypeScript Type Inference & Interface Best Practices',
    subtitle: 'A technical reference on typing dynamic JSON, interfaces versus type aliases, and handling optional or nullable fields.',
    content: [
      {
        heading: 'Why Type Your JSON Payloads?',
        body: 'Dynamic APIs frequently return unexpected data structures. Generating compile-time TypeScript contracts prevents runtime null-pointer exceptions, enhances IDE auto-completion, and catches breaking API contract changes before deployment.'
      },
      {
        heading: 'Interfaces vs. Type Aliases in TypeScript',
        body: 'Interfaces are extendable via declaration merging and inheritance (extends), making them ideal for object-oriented architectures and API models. Type aliases are more flexible for unions, intersections, primitives, and mapped tuples.'
      }
    ],
    faqs: [
      {
        question: 'How does this tool handle mixed-type arrays in JSON?',
        answer: 'Arrays containing heterogeneous elements are converted into TypeScript union types, e.g. (string | number)[].'
      },
      {
        question: 'Does this tool transmit my JSON payload to any AI or server?',
        answer: 'No. Type inference is executed entirely client-side using deterministic TypeScript parsing algorithms inside your browser.'
      }
    ]
  }
};
