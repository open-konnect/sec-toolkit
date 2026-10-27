import { ToolDefinition, ToolCategory, CategoryInfo } from '../types';

// Tool imports
import { jwtToolDefinition } from './jwt';
import { hashGeneratorToolDefinition } from './hash-generator';
import { jwtGeneratorToolDefinition } from './jwt-generator';
import { cspGeneratorToolDefinition } from './csp-generator';
import { securityHeadersToolDefinition } from './security-headers';
import { passwordStrengthToolDefinition } from './password-strength';
import { websitePostureToolDefinition } from './website-posture';

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
    iconName: 'Shield',
    seoTitle: 'Security Tools — JWT, CSP & Passwords',
    seoDescription:
      'Inspect JWTs, generate hashes and signed tokens, build CSP and security headers, and check password strength locally in your browser.',
    intro:
      'Security utilities for debugging authentication, hardening HTTP responses, and checking cryptographic primitives. Tokens, secrets, and passwords stay in your browser; none of these tools upload input to a server.',
    educationalContent: {
      title: 'Choosing the Right Security Tool',
      subtitle: 'Inspect and harden web applications without sending credentials or tokens to a third party.',
      content: [
        {
          heading: 'Start with the token, then verify on the server',
          body:
            'Use the JWT Decoder & Security Analyzer to read a token header, payload, claims, and expiry, or to spot common issues such as alg:none and excessive lifetimes. Decoding is not verification: only your backend can validate a signature with the correct secret or public key. Use the JWT Generator for short-lived test tokens with synthetic claims.'
        },
        {
          heading: 'Harden responses, not just application code',
          body:
            'The CSP Generator and Security Headers Generator help you assemble Content-Security-Policy, HSTS, nosniff, Referrer-Policy, and related headers. Start with a report-only policy, test against the real application, then enforce it. Generated values are a starting point, not a universal configuration.'
        },
        {
          heading: 'Check secrets and passwords without exposing them',
          body:
            'The Hash Generator computes SHA-256, SHA-384, and SHA-512 digests locally, and the Password Strength Analyzer estimates entropy and detects common patterns. Hashing is not encryption, and a browser tool is still the wrong place for real production credentials. Use synthetic test data whenever possible.'
        },
        {
          heading: 'Which security tool should I use?',
          body:
            'Decoding an auth token: JWT Decoder. Creating a test token: JWT Generator. Verifying a checksum: Hash Generator. Planning browser defenses: CSP Generator or Security Headers Generator. Reviewing password policy: Password Strength Analyzer.'
        }
      ],
      faqs: [
        {
          question: 'Are these security tools safe for real production secrets?',
          answer:
            'Processing happens locally, but you should still avoid pasting long-lived production secrets into any browser tool on a shared or untrusted device. Prefer synthetic tokens, test keys, and non-sensitive examples.'
        },
        {
          question: 'Does the JWT Decoder verify the signature?',
          answer:
            'No. It decodes and analyzes the token. Signature verification requires the issuer’s secret or public key and must be performed by a trusted backend service.'
        },
        {
          question: 'Can I deploy the generated CSP or headers without changes?',
          answer:
            'Not automatically. Every site loads different scripts, fonts, and frames. Test a generated policy in report-only mode and adjust it for your real application before enforcing it.'
        }
      ]
    }
  },
  {
    id: 'encoding',
    name: 'Encoding',
    description: 'Encode and decode standard binary, text, and URI formats with full UTF-8 support.',
    iconName: 'Binary',
    seoTitle: 'Encoding Tools — Base64 & URL Encoders',
    seoDescription:
      'Encode and decode Base64, Base64URL, full URLs, and query parameters locally in your browser. UTF-8 aware and privacy-first.',
    intro:
      'Encoding tools for moving text and binary data through systems that only accept safe characters. Encoding is reversible and does not provide confidentiality; do not use it to protect secrets.',
    educationalContent: {
      title: 'Encoding Formats for Developers',
      subtitle: 'Choose the right encoding for text, URLs, and binary payloads.',
      content: [
        {
          heading: 'Encoding is not encryption',
          body:
            'Base64 and percent-encoding transform data into a different representation so it can safely cross text-based protocols. Anyone can reverse them without a key. Use encryption or hashing when you need confidentiality or integrity, not encoding.'
        },
        {
          heading: 'Base64 vs Base64URL',
          body:
            'Standard Base64 uses + and / and may include = padding. Base64URL replaces those characters with - and _ and usually omits padding, which makes it safe for URLs, filenames, and JWT segments. The Base64 tool supports both variants.'
        },
        {
          heading: 'URL encoding and query parameters',
          body:
            'Reserved characters such as spaces, &, =, #, and / have structural meaning in a URL. Percent-encoding lets you include them inside a path segment or query value. Use component encoding for individual parameters and full-URI encoding only when you intend to preserve URL delimiters.'
        },
        {
          heading: 'UTF-8 matters',
          body:
            'Legacy atob() and btoa() only handle Latin-1. Multi-byte characters such as emoji or non-Latin scripts need TextEncoder/TextDecoder to avoid corrupted output. These tools use the native UTF-8 APIs.'
        }
      ],
      faqs: [
        {
          question: 'Which tool should I use for JWT segments?',
          answer:
            'JWT header and payload segments use Base64URL. The Base64 Encoder / Decoder supports Base64URL mode; the JWT Decoder handles the full token for you.'
        },
        {
          question: 'Does Base64 make my data secure?',
          answer:
            'No. Base64 provides no encryption, authentication, or access control. It only changes the representation of the data.'
        }
      ]
    }
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Format, validate, and convert structured data payloads and types in your browser.',
    iconName: 'Database',
    seoTitle: 'Data Tools — JSON, Types & Validation',
    seoDescription:
      'Format, validate, minify, and convert JSON payloads locally in your browser. Inspect syntax errors and generate TypeScript types without uploading data.',
    intro:
      'Data utilities for debugging API payloads and turning real JSON examples into usable TypeScript types. Payloads remain in browser memory and are not uploaded or stored.',
    educationalContent: {
      title: 'Working with JSON Payloads',
      subtitle: 'Validate, format, and type the structured data your application exchanges.',
      content: [
        {
          heading: 'Format before you debug',
          body:
            'A formatted JSON document makes nesting, missing fields, and type mismatches visible. The JSON Formatter validates strict RFC 8259 syntax, shows the error location, and can minify the payload again before you send it.'
        },
        {
          heading: 'Turn real payloads into types',
          body:
            'The JSON to TypeScript Converter infers interfaces from an example object. It is useful for bootstrapping API clients, but inferred types only describe the example you provided. Review optional fields, nullable values, and arrays before relying on them.'
        },
        {
          heading: 'Keep sensitive payloads local',
          body:
            'API responses may contain customer identifiers, tokens, or internal configuration. These tools parse and format in the browser; they do not send the JSON to a remote formatter or AI service.'
        }
      ],
      faqs: [
        {
          question: 'Which data tool should I start with?',
          answer:
            'Use the JSON Formatter & Validator to inspect or repair a payload. Once the JSON is valid, use the JSON to TypeScript Converter to generate a first-pass type definition.'
        },
        {
          question: 'Do these tools change the meaning of my JSON?',
          answer:
            'Formatting and minification only change whitespace. Type generation is an inference step and should be reviewed by a developer before it is used in production code.'
        }
      ]
    }
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Essential workflow utilities for timestamps, regular expressions, UUIDs, and cron.',
    iconName: 'Terminal',
    seoTitle: 'Developer Tools — UUID, Time, Regex & Cron',
    seoDescription:
      'Generate UUIDs, convert Unix timestamps, test regular expressions, and build cron schedules locally in your browser. Fast, private developer utilities.',
    intro:
      'Everyday utilities for identifiers, time, text patterns, and scheduled jobs. They are designed for quick debugging without setting up a local script or sending values to a remote service.',
    educationalContent: {
      title: 'Developer Workflow Utilities',
      subtitle: 'Small tools for the identifiers, timestamps, patterns, and schedules that show up in every codebase.',
      content: [
        {
          heading: 'Pick the right identifier',
          body:
            'UUID v4 values are random and non-sequential, which makes them useful for distributed systems and public identifiers that should not reveal record counts. They are not sortable; use a time-ordered identifier such as ULID when index locality matters.'
        },
        {
          heading: 'Work across time zones deliberately',
          body:
            'Unix timestamps count seconds from 1970-01-01 UTC. JavaScript uses milliseconds, while many APIs and JWT claims use seconds. The Timestamp Converter makes the unit and the UTC/local representation explicit so off-by-1000 errors are easier to spot.'
        },
        {
          heading: 'Test patterns and schedules before deployment',
          body:
            'The Regex Tester shows matches, capture groups, flags, and replacements. The Cron Generator explains a five-field schedule and previews the next run times. Always confirm the cron dialect used by your platform; not every scheduler uses the same fields.'
        }
      ],
      faqs: [
        {
          question: 'Which developer tools are available?',
          answer:
            'UUID Generator, Unix Timestamp Converter, Regex Tester & Debugger, and Cron Expression Generator. Each has a dedicated guide and FAQ on its page.'
        },
        {
          question: 'Do these tools require an account or installation?',
          answer:
            'No. They run in the browser with no sign-up, installation, or server-side processing.'
        }
      ]
    }
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Privacy-first token counting, context-window calculation, and catalog-backed LLM cost estimation.',
    iconName: 'Sparkles',
    seoTitle: 'AI Tools — LLM Token & Cost Calculator',
    seoDescription:
      'Estimate LLM token counts from a real prompt and sample response, then compare cached input, context-window usage, and API costs locally in your browser. Browse catalog models without sending text anywhere.',
    intro:
      'AI utilities for planning prompts, context budgets, and API spend. Model pricing comes from a catalog refreshed during the build, and prompts are never sent to a model provider by this site.',
    educationalContent: {
      title: 'Planning LLM Token Budgets',
      subtitle: 'Estimate real prompt and response usage, then plan the cost.',
      content: [
        {
          heading: 'Tokens are not words',
          body:
            'Language models tokenize text into sub-word units. Common English words may be one token, while code, punctuation, and non-English scripts often use more. The LLM Token & Cost Calculator estimates both sides of an actual interaction: paste the prompt you sent and a sample response you received, and the same local heuristic measures each one.'
        },
        {
          heading: 'Catalog pricing changes over time',
          body:
            'Each provider uses a different tokenizer and vocabulary, and list prices change frequently. The calculator refreshes its model catalog during the build, displays the date of the last successful refresh, and supports cached-input rates where a provider publishes them.'
        },
        {
          heading: 'Compare models before you commit',
          body:
            'The same token counts can cost very different amounts across frontier, small, and open-weight models. Switch providers, search the catalog, and compare input, output, cached, daily, and monthly estimates before choosing a default model for a feature.'
        },
        {
          heading: 'Keep prompts and data local',
          body:
            'Prompts and responses can contain source code, customer data, or internal documentation. Token counting and cost estimation happen in your browser; neither text is sent to OpenAI, Anthropic, Google, or any other API.'
        }
      ],
      faqs: [
        {
          question: 'Are the token estimates exact?',
          answer:
            'No. They are approximate heuristics. Use the provider’s tokenizer or usage response when you need exact billing numbers.'
        },
        {
          question: 'Where does the model pricing come from?',
          answer:
            'The site fetches the public LiteLLM model cost map during the build, normalizes it, and serves a static catalog. The calculator shows the date of the last successful refresh so you can judge how current the prices are.'
        },
        {
          question: 'Can I estimate cached-input costs?',
          answer:
            'Yes, for models that publish a cached-input rate. Enter how many of the input tokens were cached and the calculator bills the cached portion separately from uncached input.'
        }
      ]
    }
  }
];

/**
 * The 16 Registered Tools
 */
export const REGISTERED_TOOLS: ToolDefinition[] = [
  // Security (7)
  jwtToolDefinition,
  hashGeneratorToolDefinition,
  jwtGeneratorToolDefinition,
  cspGeneratorToolDefinition,
  securityHeadersToolDefinition,
  passwordStrengthToolDefinition,
  websitePostureToolDefinition,

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
