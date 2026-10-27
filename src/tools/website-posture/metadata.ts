import { ToolDefinition } from '../../types';

export const websitePostureMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'website-security-posture',
  slug: 'website-security-posture',
  name: 'Website Security Posture Assessment',
  shortDescription:
    'Run passive, read-only security posture checks on a website from your own browser — HTTPS, mixed content, CSP, SRI, and login form transport.',
  description:
    'A passive website security posture assessment. The analysis, scoring and report run in your browser; to read another site\'s pages and response headers, which browsers block, the page is fetched through this site\'s stateless relay. It reports what it observed and clearly separates checks it could not verify. It is not a vulnerability scanner and never tests, fuzzes, or exploits anything.',
  category: 'security',
  badge: 'Assessment',
  featured: true,
  iconName: 'ScanSearch',
  keywords: [
    'website security posture',
    'passive security assessment',
    'mixed content checker',
    'csp analyzer',
    'subresource integrity check',
    'https check',
    'security.txt check',
    'client-side security assessment'
  ],
  relatedTools: ['security-headers', 'csp-generator', 'jwt-decoder'],
  seo: {
    title: 'Website Security Posture Assessment — Passive Checks',
    description:
      'Passive, read-only website security posture checks: HTTPS, security headers, mixed content, CSP, SRI and login forms. Analysis runs in your browser; results are never stored.',
    canonicalPath: '/website-security-posture'
  },
  educationalContent: {
    title: 'Understanding Passive Website Security Posture Assessment',
    subtitle:
      'What a browser-based, read-only assessment can honestly tell you about a site — and what it cannot.',
    content: [
      {
        heading: 'Posture assessment is not vulnerability scanning',
        body:
          'A posture assessment observes what a site already reveals: the transport it uses, the resources it loads, the policies it declares. A vulnerability scanner actively probes for exploitable behaviour by submitting forms, fuzzing parameters, and attempting payloads. This tool only does the former. It issues ordinary read-only GET requests, never submits a form, never sends credentials, and never executes any script it reads from the target. A clean result therefore means no issue was detected in the checks performed — not that the site is secure.'
      },
      {
        heading: 'Why some checks cannot be verified in a browser',
        body:
          'The browser same-origin policy exists to protect you. A page served from one origin cannot read the response body of another origin unless that origin opts in with an Access-Control-Allow-Origin header, and even a successful cross-origin fetch hides every response header that is not CORS-safelisted. That means header-based checks for HSTS, X-Frame-Options, or a Content-Security-Policy sent as a header are genuinely unobservable from a browser for most third-party sites. This tool reports those as "unable to verify" and excludes them from the score, because turning a browser restriction into a security finding would be dishonest.'
      },
      {
        heading: 'Reading the score and the coverage number together',
        body:
          'The score is a weighted penalty total, normalized by the weight of the checks that actually completed. The coverage percentage states how many applicable checks reached a verdict at all. A score of 82 with 68% coverage does not mean the site is 18% insecure; it means that among the two thirds of checks that could run, the observed issues carried that much weight. Checks that were unverified, not applicable, or purely informational never lower the score, and a hardening suggestion is weighted far below a verified weakness.'
      },
      {
        heading: 'Mixed content and why active resources matter more',
        body:
          'When an HTTPS page loads a subresource over plain http://, the encryption guarantee for that part of the page is gone. Browsers block active mixed content such as scripts, stylesheets, and frames outright, because an attacker who can modify that response can execute code in your page. Passive mixed content such as images and media is usually upgraded or shown with a warning instead. This tool reports the two cases separately and at different severities, since an http:// script tag is a materially worse finding than an http:// image.'
      },
      {
        heading: 'What Subresource Integrity actually protects',
        body:
          'Subresource Integrity lets you pin a cross-origin script or stylesheet to a cryptographic hash, so the browser refuses to run it if the file served does not match. Without SRI, a compromise of a CDN or a third-party vendor becomes a compromise of every page that loads from it. Missing SRI is a hardening gap rather than a confirmed vulnerability, so this tool reports it at reduced weight. An integrity attribute without a matching crossorigin attribute is flagged separately, because the browser will not enforce the hash in that configuration.'
      },
      {
        heading: 'Login forms, HTTPS, and the page they live on',
        body:
          'A password field that submits to an http:// endpoint sends the credential in cleartext to anyone on the network path. Less obviously, a password field on an http:// page that posts to https:// is also unsafe: the page itself arrived unauthenticated, so an on-path attacker can rewrite the form action or inject a script that reads the field before submission. This tool reads form structure only — the field type, the method, the action URL. Field values are never captured by the parser, so they cannot appear in a result, and no form is ever submitted.'
      },
      {
        heading: 'How page discovery is bounded',
        body:
          'Discovery is breadth-first, same-origin only, and capped on page count, link depth, concurrency, and per-page time. URLs are normalized and deduplicated so a run always terminates, fragments are dropped, and obvious binary or download links are skipped rather than retrieved. Every failure is isolated: one unreachable page or one malformed URL lowers coverage and never aborts the assessment. The assessment is still useful when only the entry page can be read, which is the common case for a cross-origin target.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool send the assessed website or my results anywhere?',
        answer:
          'Partly. In Scan URL mode the target address is sent to this site\'s stateless fetch relay, which makes one read-only GET per page and returns the text and security headers; it applies strict limits, accepts only public hostnames, and does not store or log what it reads. All parsing, scoring and reporting happens in this tab, and results are never uploaded, written to cookies, or sent to analytics. Direct-from-browser and paste-source modes send nothing to this site at all.'
      },
      {
        question: 'Why do so many checks say "unable to verify"?',
        answer:
          'Because the browser will not let a page read another origin\'s response headers or body unless that origin explicitly allows it with CORS headers. That is a browser security restriction, not a problem with the site. Those checks are listed separately and never count against the score.'
      },
      {
        question: 'Can I assess a site whose pages the browser refuses to read?',
        answer:
          'Scan URL mode fetches through the relay, so CORS does not get in the way. If you would rather send nothing to this site, switch to the paste-page-source mode, open View Source on the page you want assessed, and paste the markup (and optionally the response headers) in. The identical check engine runs over it with no network requests at all.'
      },
      {
        question: 'Is running this against a website I do not own legal or safe?',
        answer:
          'The tool only issues ordinary read-only GET requests for pages the site already links to, which is what any browser or search engine crawler does. It performs no penetration testing, no brute force, no fuzzing, and no form submission. Even so, check the target\'s terms and your own authorization before assessing a site you do not control.'
      },
      {
        question: 'Does a high score mean my website has no vulnerabilities?',
        answer:
          'No, and the tool will never claim that. A score reflects only the checks that actually completed on the pages that were read. Server configuration, application logic, authentication flows, and dependencies are all outside what a passive browser assessment can see.'
      }
    ]
  }
};
