export type CspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'media-src'
  | 'object-src'
  | 'frame-src'
  | 'frame-ancestors'
  | 'base-uri'
  | 'form-action';

export interface CspDirectiveConfig {
  name: CspDirectiveName;
  sources: string[];
  description: string;
}

export interface CspWarning {
  directive: string;
  source: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface CspBuildResult {
  headerValue: string;
  rawHeader: string;
  metaHtml: string;
  nginxConfig: string;
  warnings: CspWarning[];
}
