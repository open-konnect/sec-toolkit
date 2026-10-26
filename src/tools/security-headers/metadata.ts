import { ToolDefinition } from '../../types';

export const securityHeadersMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'security-headers',
  slug: 'security-headers',
  name: "Security Headers Generator & Analyzer",
  shortDescription: 'Configure and export essential HTTP security headers (HSTS, CSP, Permissions-Policy, nosniff) for Nginx, Apache, and Cloudflare.',
  description: 'Generate hardened HTTP response headers to defend against clickjacking, MIME sniffing, SSL stripping, and cross-origin leaks. Exports configurations for Nginx, Apache, and Cloudflare.',
  category: 'security',
  badge: 'Hardening',
  featured: false,
  iconName: 'Server',
  keywords: ['security headers', 'hsts', 'nosniff', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'coop', 'corp', 'nginx headers'],
  relatedTools: ['csp-generator', 'jwt-decoder', 'hash-generator'],
  seo: {
    title: "Security Headers Generator & Analyzer",
    description: "Generate and review HTTP security headers in your browser. Configure HSTS, CSP, nosniff, and Referrer-Policy, then export for Nginx, Apache, or Cloudflare.",
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
      },
      {
        heading: 'Header-by-header guidance',
        body: 'Content-Security-Policy restricts resource loading and should be tested in report-only mode. X-Content-Type-Options: nosniff stops MIME sniffing. Referrer-Policy controls how much URL information is sent to other origins; strict-origin-when-cross-origin is a common privacy-preserving default. Permissions-Policy disables browser features your site does not use. X-Frame-Options is a legacy clickjacking control; prefer CSP frame-ancestors for new deployments.'
      },
      {
        heading: 'Deploy HSTS carefully',
        body: 'Start with a modest max-age, confirm that every subdomain supports HTTPS, and only then consider includeSubDomains or preload. HSTS is cached by browsers and a preload submission is difficult to reverse. Do not enable it on a domain that still needs plain HTTP for development or legacy clients.'
      },
      {
        heading: 'Where to set headers',
        body: 'Set security headers at the edge, reverse proxy, or application server so they apply consistently to HTML and error responses. A <meta> tag can carry some policies but not HSTS or frame-ancestors. Avoid duplicate conflicting headers from both the CDN and origin, and verify the final response with browser devtools or curl -I.'
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
      },
      {
        question: 'Which security header should I add first?',
        answer: 'Start with HSTS once HTTPS is everywhere, X-Content-Type-Options: nosniff, and a conservative Referrer-Policy. Add CSP in report-only mode, then enforce it after testing. Add Permissions-Policy and cross-origin headers as your application requires.'
      },
      {
        question: 'Can I use every generated header at once?',
        answer: 'Not necessarily. A header that breaks embedded content or a required browser feature can harm users. Treat the output as a reviewed baseline, test it on staging, and remove or relax directives that conflict with real application behavior.'
      }
    ]
  }
};
