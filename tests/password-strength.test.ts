import { describe, it, expect } from 'vitest';
import { analyzePassword } from '../src/tools/password-strength/logic/passwordAnalyzer';

describe('analyzePassword', () => {
  it('short password (< 8 chars) scores as very-weak or weak', () => {
    const result = analyzePassword('abc');
    expect(['very-weak', 'weak']).toContain(result.level);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('long complex password scores as strong or very-strong', () => {
    const result = analyzePassword('Xk#9pLm@2Qr&Tz5!');
    expect(['strong', 'very-strong']).toContain(result.level);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('"password" is flagged as a common password', () => {
    const result = analyzePassword('password');
    expect(result.warnings.some(w => w.toLowerCase().includes('common') || w.toLowerCase().includes('breach'))).toBe(true);
  });

  it('"123456" is flagged as a common password', () => {
    const result = analyzePassword('123456');
    expect(result.warnings.some(w => w.toLowerCase().includes('common') || w.toLowerCase().includes('breach'))).toBe(true);
  });

  it('entropy increases with longer password and more character variety', () => {
    const short = analyzePassword('abc');
    const long = analyzePassword('Abc123!@#XyZ$%^&');
    expect(long.entropyBits).toBeGreaterThan(short.entropyBits);
  });

  it('correctly identifies presence of lowercase, uppercase, number, symbol', () => {
    const result = analyzePassword('Abc1!xyz');
    expect(result.hasLowercase).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSymbol).toBe(true);
  });

  it('empty password returns score 0 and very-weak level', () => {
    const result = analyzePassword('');
    expect(result.score).toBe(0);
    expect(result.level).toBe('very-weak');
    expect(result.length).toBe(0);
  });

  it('password with repeated chars triggers a warning', () => {
    const result = analyzePassword('aaaa1234A!bc');
    expect(result.warnings.some(w => w.toLowerCase().includes('repetit'))).toBe(true);
  });

  it('length is correctly reported', () => {
    const result = analyzePassword('hello');
    expect(result.length).toBe(5);
  });
});
