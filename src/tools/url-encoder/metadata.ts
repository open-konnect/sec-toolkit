import { ToolDefinition } from '../../types';

export const urlEncoderMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'url-encoder',
  slug: 'url-encoder',
  name: 'URL Encoder / Decoder',
  shortDescription: 'Encode and decode query strings, path segments, and full URLs with RFC 3986 percent-encoding support.',
  description: 'Convert characters to percent-encoded formats and decode encoded query parameters safely in your browser. Supports both URI component and full URI modes.',
  category: 'encoding',
  badge: 'RFC 3986',
  featured: false,
  iconName: 'Globe',
  keywords: ['url encoder', 'url decoder', 'percent encoding', 'url component', 'uri encode', 'uri decode', 'rfc 3986', 'query string'],
  relatedTools: ['base64', 'jwt-decoder', 'json-formatter'],
  seo: {
    title: 'URL Encoder & Decoder — Free Percent-Encoding Tool',
    description: 'Encode and decode URLs, query strings, and URI components locally in your browser. Handles UTF-8 characters and special symbols with zero network latency.',
    canonicalPath: '/url-encoder'
  },
  educationalContent: {
    title: 'Understanding URL Percent-Encoding (RFC 3986)',
    subtitle: 'A technical reference on URI reserved characters, percent-encoding syntax, and component versus full URI escaping.',
    content: [
      {
        heading: 'What is URL Percent-Encoding?',
        body: 'URL percent-encoding is a mechanism for encoding information in a Uniform Resource Identifier (URI) under RFC 3986. Characters that are not allowed or have special reserved meanings (such as spaces, ?, &, /, #) are represented using a "%" followed by their two-digit hexadecimal ASCII or UTF-8 byte value.'
      },
      {
        heading: 'URI Component vs. Full URI Encoding',
        body: 'encodeURIComponent escapes all reserved characters (including ":", "/", "?", and "&"), making it ideal for individual query parameters. In contrast, encodeURI preserves protocol and pathname delimiters (such as "https://" and "/"), making it suitable only when escaping an entire URL.'
      },
      {
        heading: 'URL Encoding vs. Base64',
        body: 'URL encoding is designed for transmitting special characters safely inside HTTP URIs. Base64 converts arbitrary binary data into 64 ASCII characters. For URLs, Base64URL is preferred to avoid conflicting with reserved URL characters (+ and /).'
      }
    ],
    faqs: [
      {
        question: 'Why is a space sometimes encoded as "+" and other times as "%20"?',
        answer: 'In standard URI syntax (RFC 3986), a space is encoded as "%20". In application/x-www-form-urlencoded query strings (HTML form submissions), spaces are traditionally encoded as "+". This tool decodes both formats seamlessly.'
      },
      {
        question: 'Is any URL or data sent to external servers?',
        answer: 'No. All encoding and decoding operations execute entirely in your local browser JavaScript engine.'
      }
    ]
  }
};
