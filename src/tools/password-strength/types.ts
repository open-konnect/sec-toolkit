export type PasswordStrengthLevel = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';

export interface PasswordAnalysisResult {
  score: number; // 0 to 4
  level: PasswordStrengthLevel;
  entropyBits: number;
  length: number;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  warnings: string[];
  suggestions: string[];
}
