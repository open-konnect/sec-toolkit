export interface SecurityHeaderItem {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
  recommendedValue: string;
  description: string;
}

export type HeaderPlatform = 'raw' | 'nginx' | 'apache' | 'cloudflare';

export interface SecurityHeadersResult {
  raw: string;
  nginx: string;
  apache: string;
  cloudflare: string;
}
