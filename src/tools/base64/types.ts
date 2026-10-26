export type Base64Mode = 'encode' | 'decode';
export type Base64Variant = 'standard' | 'urlSafe';

export interface Base64ConvertOptions {
  mode: Base64Mode;
  variant: Base64Variant;
}

export interface Base64Result {
  output: string;
  success: boolean;
  error?: string;
  inputBytes: number;
  outputBytes: number;
}
