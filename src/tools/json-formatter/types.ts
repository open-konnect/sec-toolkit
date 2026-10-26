export interface JsonValidationResult {
  isValid: boolean;
  formatted?: string;
  minified?: string;
  error?: string;
  errorLocation?: {
    line: number;
    column: number;
    characterIndex: number;
  };
  byteSize: number;
  keyCount?: number;
}
