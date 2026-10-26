export type UuidCase = 'lowercase' | 'uppercase';

export interface UuidFormatOptions {
  uppercase: boolean;
  hyphens: boolean;
}

export interface GeneratedUuidItem {
  id: string;
  value: string;
  version: number;
}
