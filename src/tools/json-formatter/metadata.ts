import { ToolDefinition } from '../../types';

export const jsonFormatterMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'json-formatter',
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  shortDescription: 'Format, prettify, minify, and validate JSON payloads with precise syntax error locations and zero server uploads.',
  description: 'Clean, client-side JSON prettifier and syntax checker. Validates strict RFC 8259 compliance, highlights line-by-line syntax errors, and supports instant minification.',
  category: 'data',
  badge: 'Popular',
  featured: true,
  iconName: 'FileJson',
  keywords: ['json', 'json formatter', 'json prettifier', 'json validator', 'json minifier', 'json parser', 'beautify json'],
  relatedTools: ['json-to-typescript', 'jwt-decoder', 'base64'],
  seo: {
    title: 'JSON Formatter & Validator — Free Privacy-First Prettifier',
    description: 'Format, validate, and minify JSON data directly in your browser. Get clear syntax error locations with zero data sent to external servers.',
    canonicalPath: '/json-formatter'
  },
  educationalContent: {
    title: 'Understanding JSON (RFC 8259) & Validation Standards',
    subtitle: 'A technical reference on strict JSON grammar, common formatting errors, and client-side processing.',
    content: [
      {
        heading: 'What is JSON (JavaScript Object Notation)?',
        body: 'JSON is a lightweight, language-independent data-interchange text format conforming to RFC 8259. Unlike JavaScript object literals, JSON requires strict adherence: property keys must be enclosed in double quotes, single quotes are invalid, and trailing commas are forbidden.'
      },
      {
        heading: 'Common JSON Syntax Errors',
        body: 'The most frequent causes of JSON parsing failures are trailing commas after the last property or array item, unquoted keys, single quotes instead of double quotes, and unescaped control characters or backslashes.'
      },
      {
        heading: 'Prettifying vs. Minification',
        body: 'Prettifying adds consistent whitespace and newlines for human readability during debugging and API inspection. Minification removes all non-essential whitespace, lowering payload transfer sizes over the network.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool execute any JavaScript inside the JSON?',
        answer: 'No. The formatter uses standard JSON.parse(), which parses static data structures and never executes functions or arbitrary code.'
      },
      {
        question: 'Is my JSON uploaded to any server or database?',
        answer: 'No. All parsing, validation, and formatting runs locally inside your browser tab.'
      }
    ]
  }
};
