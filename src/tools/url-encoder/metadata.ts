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
    title: "URL Encoder & Decoder",
    description: "Encode and decode URLs and query parameters directly in your browser. Handle spaces, special characters, and UTF-8 safely without uploading data.",
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
        heading: 'Reserved characters and %20',
        body: 'RFC 3986 reserves characters such as ":", "/", "?", "#", "[", "]", "@", "!", "$", "&", "\'", "(", ")", "*", "+", ",", ";", and "=" because they have structural meaning in a URI. A literal space is encoded as %20 in standard URI syntax; HTML form encoding may use "+" instead. UTF-8 characters are encoded byte by byte, so "é" becomes %C3%A9.',
        codeExample: 'Search term:  jwt decoder & security\nComponent:    jwt%20decoder%20%26%20security\nQuery string: ?q=jwt%20decoder%20%26%20security\n\nFull URL:     https://example.com/search?q=jwt%20decoder\nDo not encode the scheme and path delimiters when encoding a full URL.'
      },
      {
        heading: 'Query parameters in practice',
        body: 'Encode each parameter name and value separately, then join them with "&". If a value itself contains "&" or "=", encoding it prevents the server from splitting the parameter incorrectly. Do not put secrets in query strings: URLs appear in browser history, server logs, proxies, and referrer headers.'
      },
      {
        heading: 'Common URL encoding mistakes',
        body: 'Double-encoding is a frequent bug: encoding an already encoded value turns "%20" into "%2520". Encoding a whole URL with encodeURIComponent breaks the scheme and path separators. Assuming "+" always means a space is also unsafe outside form-encoded query strings. Decode once at the boundary where the value is consumed.'
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
      },
      {
        question: 'Should I encode a full URL or each component separately?',
        answer: 'Encode each path segment or query parameter separately with component encoding. Only use full-URI encoding when you intentionally want to preserve the scheme, host, and path delimiters while escaping unsafe characters.'
      },
      {
        question: 'What is double encoding?',
        answer: 'Double encoding means encoding an already encoded string, so "%20" becomes "%2520". It often happens when a value is encoded on the client and again by a framework. Encode once, and decode once at the point where the value is consumed.'
      }
    ]
  }
};
