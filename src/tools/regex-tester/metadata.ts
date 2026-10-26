import { ToolDefinition } from '../../types';

export const regexTesterMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'regex-tester',
  slug: 'regex-tester',
  name: "Regex Tester & Debugger",
  shortDescription: 'Test, debug, and evaluate regular expressions with instant match highlighting, capture group inspection, and replace preview.',
  description: 'Fast, client-side regex tester with full support for JavaScript RegExp flags (g, i, m, s, u). Inspect capture groups, match indices, and replacement strings without uploading data.',
  category: 'developer',
  badge: 'Popular',
  featured: true,
  iconName: 'Search',
  keywords: ['regex', 'regex tester', 'regular expression', 'regex validator', 'regex replace', 'pattern matcher', 'javascript regex'],
  relatedTools: ['timestamp-converter', 'json-formatter', 'uuid-generator'],
  seo: {
    title: "Regex Tester & Debugger",
    description: "Test and debug regular expressions directly in your browser. Highlight matches, inspect capture groups, and preview replacements without uploading test strings.",
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
      },
      {
        heading: 'Patterns, groups, and anchors',
        body: 'A regex is built from literals and metacharacters. "." matches one character, character classes such as [a-z] match one of a set, ^ and $ anchor to the start and end, and quantifiers (*, +, ?, {n,m}) control repetition. Parentheses create capturing groups; (?:...) creates a non-capturing group, and (?<name>...) creates a named group. Alternation with | selects between patterns.'
      },
      {
        heading: 'Common regular expression examples',
        body: 'Start from a small, readable pattern and add flags deliberately. The examples below are safe to test and illustrate anchors, groups, and escaping. Remember that JavaScript regex syntax differs from PCRE, Python, and other engines in areas such as lookbehind and named-group syntax.',
        codeExample: 'Email-ish:      ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\nIPv4-ish:       ^(?:\\d{1,3}\\.){3}\\d{1,3}$\nHex color:      ^#(?:[0-9a-fA-F]{3}){1,2}$\nRepeated word:  \\b(\\w+)\\s+\\1\\b\nReplacement:    $1 -> $2'
      },
      {
        heading: 'Common regex mistakes',
        body: 'Greedy quantifiers can consume more than intended; add ? for lazy matching or use a more specific character class. Forgetting to escape a literal dot makes it match any character. Anchors behave differently with the m flag. Reusing a global regex without resetting lastIndex can skip matches. Test against realistic input and keep the pattern as simple as possible.'
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
      },
      {
        question: 'Which flags should I use?',
        answer: 'Use g to find every match, i for case-insensitive matching, m when ^ and $ should match each line, s when "." should match newlines, and u for full Unicode code-point matching. Add flags only when the pattern needs them.'
      },
      {
        question: 'Why does my regex match too much text?',
        answer: 'Greedy quantifiers such as .* consume as much as possible. Use a lazy quantifier (.*?), a narrower character class, or explicit anchors to limit the match. Test the pattern against both matching and non-matching input.'
      }
    ]
  }
};
