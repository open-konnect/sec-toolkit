import { ToolDefinition } from '../../types';

export const cspGeneratorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'csp-generator',
  slug: 'csp-generator',
  name: "CSP Generator",
  shortDescription: 'Build and audit Content Security Policy headers with automated risk checks for wildcards, unsafe-inline scripts, and legacy plugin exploits.',
  description: 'Visual CSP header builder with real-time security warnings. Formats production-ready Content-Security-Policy headers for HTTP, HTML meta tags, and Nginx reverse proxies.',
  category: 'security',
  badge: 'XSS Defense',
  featured: false,
  iconName: 'Shield',
  keywords: ['csp', 'csp generator', 'content security policy', 'xss defense', 'security header', 'script-src', 'clickjacking'],
  relatedTools: ['security-headers', 'jwt-decoder', 'hash-generator'],
  seo: {
    title: "CSP Generator — Policy Builder",
    description: "Build a Content Security Policy in your browser. Configure common directives, spot unsafe sources, and copy a policy for real-world testing.",
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
      },
      {
        heading: 'Core directives and what they control',
        body: 'default-src is the fallback for most resource types. script-src controls JavaScript, style-src controls CSS, img-src controls images, font-src controls fonts, connect-src controls fetch/XHR/WebSocket destinations, and media-src controls audio/video. object-src should usually be \'none\', frame-src limits embedded frames, base-uri restricts <base> tags, and form-action limits where forms may submit. frame-ancestors controls who may embed your page.'
      },
      {
        heading: 'Test before you enforce',
        body: 'Start with Content-Security-Policy-Report-Only on a staging deployment, exercise every page and user flow, and watch both the browser console and your report endpoint. Replace wildcards with explicit origins, add nonces or hashes for necessary inline scripts, and only then switch to the enforcing header. A policy that breaks checkout or authentication is not an improvement.'
      },
      {
        heading: 'CSP is defense in depth, not a sanitizer',
        body: 'CSP reduces the impact of some injection flaws, but it does not replace output encoding, input validation, framework escaping, or secure cookie settings. Avoid \'unsafe-inline\' where possible, never add \'unsafe-eval\' just to silence a library error, and review third-party scripts as part of the policy rather than allowlisting every domain they mention.'
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
      },
      {
        question: 'How do I test a Content Security Policy safely?',
        answer: 'Deploy it as Content-Security-Policy-Report-Only first, exercise all critical flows, and monitor browser console violations and your report endpoint. Adjust the sources, then enforce the policy.'
      },
      {
        question: 'Does CSP replace input sanitization?',
        answer: 'No. CSP is a defense-in-depth control that can limit the impact of injected content. It does not replace output encoding, server-side validation, or framework escaping.'
      }
    ]
  }
};
