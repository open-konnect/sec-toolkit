import { ToolDefinition } from '../../types';

export const regexTesterMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'regex-tester',
  slug: 'regex-tester',
  name: 'Regular Expression Tester',
  shortDescription: 'Test, debug, and evaluate regular expressions with instant match highlighting, capture group inspection, and replace preview.',
  description: 'Fast, client-side regex tester with full support for JavaScript RegExp flags (g, i, m, s, u). Inspect capture groups, match indices, and replacement strings without uploading data.',
  category: 'developer',
  badge: 'Popular',
  featured: true,
  iconName: 'Search',
  keywords: ['regex', 'regex tester', 'regular expression', 'regex validator', 'regex replace', 'pattern matcher', 'javascript regex'],
  relatedTools: ['timestamp-converter', 'json-formatter', 'uuid-generator'],
  seo: {
    title: 'Regex Tester — Free Client-Side Regular Expression Debugger',
    description: 'Test, evaluate, and replace regular expressions in real-time in your browser. Inspect capture groups, flags, and match performance safely.',
    canonicalPath: '/regex-tester'
  },
  educationalContent: {
    title: 'Regular Expression Patterns & Security Best Practices',
    subtitle: 'A technical reference on regex flags, capture groups, and avoiding Regular Expression Denial of Service (ReDoS).',
    content: [
      {
        heading: 'Common JavaScript Regex Flags',
        body: '• g (Global): Finds all matches rather than stopping after the first.\n• i (Case-Insensitive): Matches uppercase and lowercase letters interchangeably.\n• m (Multiline): ^ and $ match the start and end of each line, not just the entire string.\n• s (DotAll): Allows the dot (.) character to match newline characters.\n• u (Unicode): Enables full Unicode code-point matching.'
      },
      {
        heading: 'Preventing ReDoS (Regular Expression Denial of Service)',
        body: 'Pathological regular expressions with nested quantifiers (such as (a+)+ or (x+x+)+y) exhibit catastrophic backtracking when evaluated against non-matching input strings, locking up CPU threads. Avoid ambiguous overlapping repetitions and enforce strict input length bounds.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool execute any arbitrary JavaScript?',
        answer: 'No. The tester instantiates native JavaScript RegExp objects and never evaluates user-provided scripts or eval().'
      },
      {
        question: 'Are my test strings sent to a backend server?',
        answer: 'No. All regex matching runs entirely on your local device.'
      }
    ]
  }
};
