import { ToolDefinition } from '../../types';

export const securityHeadersMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'security-headers',
  slug: 'security-headers',
  name: 'Security Headers Generator',
  shortDescription: 'Configure and export essential HTTP security headers (HSTS, CSP, Permissions-Policy, nosniff) for Nginx, Apache, and Cloudflare.',
  description: 'Generate hardened HTTP response headers to defend against clickjacking, MIME sniffing, SSL stripping, and cross-origin leaks. Exports configurations for Nginx, Apache, and Cloudflare.',
  category: 'security',
  badge: 'Hardening',
  featured: false,
  iconName: 'Server',
  keywords: ['security headers', 'hsts', 'nosniff', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'coop', 'corp', 'nginx headers'],
  relatedTools: ['csp-generator', 'jwt-decoder', 'hash-generator'],
  seo: {
    title: 'Security Headers Generator — HSTS, CSP, nosniff & Permissions',
    description: 'Configure and export hardened HTTP security headers for Nginx, Apache, and Cloudflare directly in your browser. Improve your Mozilla Observatory score.',
    canonicalPath: '/security-headers'
  },
  educationalContent: {
    title: 'Understanding HTTP Security Headers & Web Hardening',
    subtitle: 'A technical reference on modern HTTP defense-in-depth headers and their role in web application security.',
    content: [
      {
        heading: 'Why Security Headers Matter',
        body: 'HTTP security headers tell the browser how to behave when handling your site’s content. They enforce HTTPS encryption (HSTS), restrict framing to prevent clickjacking, block MIME confusion attacks (nosniff), and disable hardware sensors (Permissions-Policy).'
      },
      {
        heading: 'Strict-Transport-Security (HSTS)',
        body: 'HSTS instructs browsers to strictly communicate with your domain over HTTPS for a specified duration (e.g. 1 year / 31536000 seconds). It eliminates insecure HTTP redirects and protects against SSL stripping attacks.'
      },
      {
        heading: 'COOP & CORP Cross-Origin Isolation',
        body: 'Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Resource-Policy (CORP) isolate your browsing context from untrusted third-party windows and scripts, mitigating Spectre-class side-channel attacks.'
      }
    ],
    faqs: [
      {
        question: 'Will these headers interfere with my website’s functionality?',
        answer: 'Most headers (nosniff, Referrer-Policy, HSTS) are safe for all modern websites. If your website needs to be embedded in an iframe on another domain, ensure you adjust X-Frame-Options and CSP frame-ancestors accordingly.'
      },
      {
        question: 'Is any server information uploaded?',
        answer: 'No. All configuration generation is performed locally in your browser.'
      }
    ]
  }
};
