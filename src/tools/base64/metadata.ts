import { ToolDefinition } from '../../types';

export const base64Metadata: Omit<ToolDefinition, 'component'> = {
  id: 'base64',
  slug: 'base64',
  name: 'Base64 Encoder / Decoder',
  shortDescription: 'Encode and decode standard Base64 and URL-safe Base64URL strings with guaranteed UTF-8 character and emoji support.',
  description: 'Convert plaintext to Base64 and Base64 to plaintext directly inside your browser. Supports both RFC 4648 standard base64 and url-safe Base64URL formatting with full international UTF-8 support.',
  category: 'data',
  badge: 'Core Utility',
  keywords: ['base64', 'base64 encode', 'base64 decode', 'base64url', 'utf-8 base64', 'binary to text', 'rfc 4648'],
  seo: {
    title: 'Base64 & Base64URL Encoder / Decoder — Privacy-First Converter',
    description: 'Fast, browser-based Base64 and Base64URL encoder and decoder. Converts UTF-8 text, international characters, and binary formats locally with zero server transmission.',
    canonicalPath: '/base64'
  },
  educationalContent: {
    title: 'Understanding Base64 and Base64URL Encoding (RFC 4648)',
    subtitle: 'Everything you need to know about binary-to-text encoding, character tables, URL safety, and padding rules.',
    content: [
      {
        heading: 'What is Base64 Encoding?',
        body: 'Base64 is a binary-to-text encoding scheme that represents binary data in an ASCII string format by translating it into a radix-64 representation. Each Base64 digit represents exactly 6 bits of data, allowing 3 8-bit bytes (24 bits) to be represented by 4 6-bit Base64 characters.'
      },
      {
        heading: 'Standard Base64 vs. Base64URL',
        body: 'Standard Base64 uses "+" and "/" as the 62nd and 63rd characters, with "=" used as padding. However, "+" and "/" have special reserved meanings in URLs and filenames. Base64URL replaces "+" with "-" and "/" with "_", and typically omits trailing "=" padding characters to make strings safe for query strings and HTTP headers.',
        codeExample: 'Standard:  SGVsZG8rV29ybGQvMjAyNg==\nBase64URL: SGVsZG8tV29ybGRfMjAyNg'
      },
      {
        heading: 'Why UTF-8 Handling Matters',
        body: 'The legacy browser window.btoa and window.atob functions only operate on Latin-1 (binary) strings. Passing multi-byte Unicode characters (such as emojis, Cyrillic, Chinese, or Arabic) triggers an unhandled Character Out of Range exception. This tool utilizes native TextEncoder and TextDecoder to ensure proper multi-byte UTF-8 encoding.'
      },
      {
        heading: 'Is Base64 Encryption?',
        body: 'No. Base64 is strictly an encoding format designed for safe data transmission across text-only protocols (such as email MIME or JSON payloads). It provides zero confidentiality and can be decoded by anyone without a key.'
      }
    ],
    faqs: [
      {
        question: 'Does Base64 encoding increase file or payload size?',
        answer: 'Yes. Because 3 bytes of raw data become 4 Base64 characters, Base64 encoding increases data size by approximately 33%.'
      },
      {
        question: 'What is the purpose of "=" padding at the end of a Base64 string?',
        answer: 'Base64 operates on 24-bit blocks. If the input data is not an exact multiple of 3 bytes, one or two "=" padding characters are appended to indicate that the final 4-character block contains 1 or 2 actual bytes.'
      },
      {
        question: 'Is my data transmitted to your server when encoding or decoding?',
        answer: 'No. All conversions execute strictly inside your local browser tab using client-side JavaScript. No data is sent across the network.'
      }
    ]
  }
};
