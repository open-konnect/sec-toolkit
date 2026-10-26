import { ToolDefinition } from '../../types';

export const cspGeneratorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'csp-generator',
  slug: 'csp-generator',
  name: 'Content Security Policy (CSP) Generator',
  shortDescription: 'Build and audit Content Security Policy headers with automated risk checks for wildcards, unsafe-inline scripts, and legacy plugin exploits.',
  description: 'Visual CSP header builder with real-time security warnings. Formats production-ready Content-Security-Policy headers for HTTP, HTML meta tags, and Nginx reverse proxies.',
  category: 'security',
  badge: 'XSS Defense',
  featured: false,
  iconName: 'Shield',
  keywords: ['csp', 'csp generator', 'content security policy', 'xss defense', 'security header', 'script-src', 'clickjacking'],
  relatedTools: ['security-headers', 'jwt-decoder', 'hash-generator'],
  seo: {
    title: 'CSP Generator — Content Security Policy Builder & Auditor',
    description: 'Construct secure Content Security Policy headers visually. Detect unsafe-inline and wildcard security risks before deploying to production.',
    canonicalPath: '/csp-generator'
  },
  educationalContent: {
    title: 'Understanding Content Security Policy (CSP Level 3)',
    subtitle: 'A technical reference on mitigating Cross-Site Scripting (XSS), data injection, and clickjacking attacks.',
    content: [
      {
        heading: 'What is a Content Security Policy (CSP)?',
        body: 'CSP is an HTTP response header that restricts the resources (such as JavaScript, CSS, Images, and Fonts) that the browser is allowed to load for a given page. It is the web platform’s primary defense-in-depth mechanism against Cross-Site Scripting (XSS) and data injection.'
      },
      {
        heading: 'The Hazard of "unsafe-inline" and "unsafe-eval"',
        body: 'Allowing "unsafe-inline" allows attackers to execute injected <script> tags or inline event handlers (onload, onerror). Allowing "unsafe-eval" enables window.eval() and new Function(), which attackers can exploit to execute arbitrary code from user-controlled strings.'
      },
      {
        heading: 'Clickjacking Protection with frame-ancestors',
        body: 'The frame-ancestors directive supersedes legacy X-Frame-Options headers. Setting "frame-ancestors \'none\'" prevents malicious sites from embedding your application inside invisible iframes to hijack user clicks.'
      }
    ],
    faqs: [
      {
        question: 'Can I blindly deploy this generated CSP to my production site?',
        answer: 'No. You should test your policy first using the "Content-Security-Policy-Report-Only" header to observe what resources break before enforcing it strictly.'
      },
      {
        question: 'Are my domain names or website settings uploaded?',
        answer: 'No. All policy generation and vulnerability checks run entirely within your local browser.'
      }
    ]
  }
};
