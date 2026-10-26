import { CspBuildResult, CspDirectiveName, CspWarning } from '../types';

export const CSP_DIRECTIVE_DEFINITIONS: Record<CspDirectiveName, { description: string; defaultSources: string[] }> = {
  'default-src': { description: 'Fallback policy for all fetch directives.', defaultSources: ["'self'"] },
  'script-src': { description: 'Restricts valid sources for JavaScript execution.', defaultSources: ["'self'"] },
  'style-src': { description: 'Restricts sources for stylesheets and CSS.', defaultSources: ["'self'"] },
  'img-src': { description: 'Restricts sources for images and favicons.', defaultSources: ["'self'", 'data:', 'https:'] },
  'font-src': { description: 'Restricts sources for web fonts.', defaultSources: ["'self'", 'https:'] },
  'connect-src': { description: 'Restricts URLs loaded via XHR, Fetch, and WebSockets.', defaultSources: ["'self'"] },
  'media-src': { description: 'Restricts audio and video sources.', defaultSources: ["'self'"] },
  'object-src': { description: 'Restricts plugins (Flash, Java, Silverlight, Applets).', defaultSources: ["'none'"] },
  'frame-src': { description: 'Restricts URLs that can be embedded in frames.', defaultSources: ["'self'"] },
  'frame-ancestors': { description: 'Restricts who can embed this site (Clickjacking protection).', defaultSources: ["'none'"] },
  'base-uri': { description: 'Restricts URLs that can appear in HTML <base> tags.', defaultSources: ["'self'"] },
  'form-action': { description: 'Restricts target endpoints for HTML forms.', defaultSources: ["'self'"] }
};

/**
 * Builds CSP policy string and outputs for various platforms with automated risk audits.
 */
export function buildCspPolicy(directives: Partial<Record<CspDirectiveName, string[]>>): CspBuildResult {
  const parts: string[] = [];
  const warnings: CspWarning[] = [];

  for (const [name, sources] of Object.entries(directives) as [CspDirectiveName, string[]][]) {
    if (!sources || sources.length === 0) continue;

    // Filter duplicates and trim
    const cleanSources = Array.from(new Set(sources.map(s => s.trim()).filter(Boolean)));
    if (cleanSources.length === 0) continue;

    parts.push(`${name} ${cleanSources.join(' ')}`);

    // Audit for security risks
    for (const src of cleanSources) {
      if (src === "'unsafe-inline'" && (name === 'script-src' || name === 'default-src')) {
        warnings.push({
          directive: name,
          source: src,
          severity: 'high',
          message: `'unsafe-inline' in ${name} bypasses Cross-Site Scripting (XSS) protections by allowing inline scripts.`
        });
      }
      if (src === "'unsafe-eval'" && (name === 'script-src' || name === 'default-src')) {
        warnings.push({
          directive: name,
          source: src,
          severity: 'high',
          message: `'unsafe-eval' allows arbitrary string evaluation (eval, Function), enabling script execution bugs.`
        });
      }
      if (src === '*' && name !== 'img-src') {
        warnings.push({
          directive: name,
          source: src,
          severity: 'medium',
          message: `Wildcard '*' allows loading resources from any origin on the internet.`
        });
      }
      if (src === 'http:' || src.startsWith('http://')) {
        warnings.push({
          directive: name,
          source: src,
          severity: 'medium',
          message: `Insecure HTTP source "${src}" is vulnerable to Man-in-the-Middle (MitM) tampering.`
        });
      }
    }
  }

  // Check if object-src is missing or not 'none'
  const objectSrc = directives['object-src'];
  if (!objectSrc || !objectSrc.includes("'none'")) {
    warnings.push({
      directive: 'object-src',
      source: 'missing',
      severity: 'medium',
      message: `object-src should be explicitly set to "'none'" to prevent execution of legacy plugin exploits.`
    });
  }

  const headerValue = parts.join('; ');
  const rawHeader = `Content-Security-Policy: ${headerValue}`;
  const metaHtml = `<meta http-equiv="Content-Security-Policy" content="${headerValue}">`;
  const nginxConfig = `add_header Content-Security-Policy "${headerValue}" always;`;

  return {
    headerValue,
    rawHeader,
    metaHtml,
    nginxConfig,
    warnings
  };
}
