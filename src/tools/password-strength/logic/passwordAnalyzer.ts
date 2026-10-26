import { PasswordAnalysisResult, PasswordStrengthLevel } from '../types';

const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', '123456789', 'qwerty', 'admin',
  'welcome', 'football', 'iloveyou', 'secret', 'pass123', 'dragon',
  'master', 'letmein', 'monkey', 'login', 'princess', 'solo'
]);

/**
 * Analyzes password complexity, entropy, and structural weaknesses client-side.
 */
export function analyzePassword(password: string): PasswordAnalysisResult {
  const length = password.length;

  if (!password) {
    return {
      score: 0,
      level: 'very-weak',
      entropyBits: 0,
      length: 0,
      hasLowercase: false,
      hasUppercase: false,
      hasNumber: false,
      hasSymbol: false,
      warnings: [],
      suggestions: ['Enter a password to evaluate its strength.']
    };
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  // Character pool size
  let poolSize = 0;
  if (hasLowercase) poolSize += 26;
  if (hasUppercase) poolSize += 26;
  if (hasNumber) poolSize += 10;
  if (hasSymbol) poolSize += 33;

  // Information entropy calculation: L * log2(poolSize)
  const entropyBits = poolSize > 0 ? Math.round(length * Math.log2(poolSize)) : 0;

  const warnings: string[] = [];
  const suggestions: string[] = [];

  const lower = password.toLowerCase();

  // Check common passwords
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(password)) {
    warnings.push('This is an extremely common, widely breached password.');
  }

  // Check repeated characters (e.g. "aaaa", "1111")
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Contains repetitive consecutive characters (e.g. "aaa").');
  }

  // Check sequential patterns (e.g. "1234", "abcd", "qwerty")
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop'];
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 4; i++) {
      const sub = seq.slice(i, i + 4);
      if (lower.includes(sub)) {
        warnings.push(`Contains a predictable keyboard or alphabetical sequence ("${sub}").`);
        break;
      }
    }
  }

  // Length suggestions
  if (length < 8) {
    warnings.push('Password is shorter than the minimum standard length (8 characters).');
    suggestions.push('Increase length to at least 14–16 characters for strong security.');
  } else if (length < 12) {
    suggestions.push('Consider adding more characters. Length is the single most effective factor against brute-force attacks.');
  }

  // Variety suggestions
  const varietyCount = [hasLowercase, hasUppercase, hasNumber, hasSymbol].filter(Boolean).length;
  if (varietyCount < 3) {
    suggestions.push('Mix uppercase letters, numbers, and symbols to expand the character search space.');
  }

  // Calculate score (0 to 4)
  let score = 0;
  if (length >= 8) score++;
  if (length >= 12 && varietyCount >= 3) score++;
  if (length >= 16 && varietyCount >= 3) score++;
  if (entropyBits >= 70 && warnings.length === 0) score++;

  if (warnings.length > 0 && score > 2) {
    score = 2; // Cap score if critical warning exists
  }

  const levels: Record<number, PasswordStrengthLevel> = {
    0: 'very-weak',
    1: 'weak',
    2: 'fair',
    3: 'strong',
    4: 'very-strong'
  };

  suggestions.push('For everyday accounts, consider using a dedicated password manager to generate unique, random passwords.');

  return {
    score,
    level: levels[score],
    entropyBits,
    length,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
    warnings,
    suggestions: Array.from(new Set(suggestions))
  };
}
