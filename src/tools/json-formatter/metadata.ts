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
    title: "JSON Formatter & Validator",
    description: "Format, validate, beautify, and minify JSON directly in your browser. Quickly find syntax errors and copy clean JSON without uploading your data.",
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
        body: 'The most frequent causes of JSON parsing failures are trailing commas after the last property or array item, unquoted keys, single quotes instead of double quotes, and unescaped control characters or backslashes. JSON also does not support comments, so // or /* */ blocks must be removed before parsing.',
        codeExample: '// Invalid JSON\n{\n  name: \'Alice\',\n  "age": 30,\n  "roles": ["admin",],\n}\n\n// Valid JSON\n{\n  "name": "Alice",\n  "age": 30,\n  "roles": ["admin"]\n}'
      },
      {
        heading: 'Valid JSON values',
        body: 'A JSON document contains one value: an object, array, string, number, boolean, or null. Objects use string keys and colon-separated values; arrays are ordered lists. Strings must use double quotes, numbers cannot contain leading zeros or NaN/Infinity, and dates are represented as strings such as "2026-01-01T00:00:00Z".'
      },
      {
        heading: 'JSON vs JavaScript objects',
        body: 'JSON is a data format; JavaScript object literals are executable source code. A JavaScript object can contain comments, single-quoted strings, methods, undefined, Date instances, and computed keys, none of which are valid JSON. Use JSON.parse for untrusted data rather than eval or Function, and remember that JSON.parse does not execute code.'
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
      },
      {
        question: 'Why is my JSON invalid?',
        answer: 'The most common causes are trailing commas, single-quoted strings, unquoted object keys, comments, and unescaped control characters. The validator reports the failing line and column so you can correct the exact location.'
      },
      {
        question: 'What is the difference between JSON and a JavaScript object?',
        answer: 'JSON is a strict text data format with double-quoted keys and no comments, functions, undefined, or Date objects. A JavaScript object is executable source code and can contain all of those, which is why copying an object literal into a JSON parser often fails.'
      }
    ]
  }
};
