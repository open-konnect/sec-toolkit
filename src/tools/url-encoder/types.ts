export type UrlMode = 'encode' | 'decode';
export type UrlScope = 'component' | 'fullUrl';

export interface UrlConversionResult {
  output: string;
  success: boolean;
  error?: string;
  inputLength: number;
  outputLength: number;
}
