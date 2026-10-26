import { describe, it, expect } from 'vitest';
import { estimateTokens, calculateLlmCost } from '../src/tools/llm-token-calculator/logic/tokenCalculator';

describe('estimateTokens', () => {
  it('estimateTokens("hello") returns a positive integer', () => {
    const result = estimateTokens('hello');
    expect(result.tokens).toBeGreaterThan(0);
    expect(Number.isInteger(result.tokens)).toBe(true);
  });

  it('estimateTokens("") returns 0 tokens and 0 words', () => {
    const result = estimateTokens('');
    expect(result.tokens).toBe(0);
    expect(result.words).toBe(0);
  });

  it('estimateTokens with whitespace-only string returns 0', () => {
    const result = estimateTokens('   ');
    expect(result.tokens).toBe(0);
  });

  it('token count increases with longer text', () => {
    const short = estimateTokens('hi');
    const long = estimateTokens('The quick brown fox jumps over the lazy dog near the riverbank');
    expect(long.tokens).toBeGreaterThan(short.tokens);
  });

  it('word count is correctly estimated', () => {
    const result = estimateTokens('one two three four five');
    expect(result.words).toBe(5);
  });
});

describe('calculateLlmCost', () => {
  it('returns correct total cost for known input/output tokens and rates', () => {
    // 1M input tokens at $2.50/M = $2.50; 500k output at $10/M = $5.00; total = $7.50
    const result = calculateLlmCost(1_000_000, 500_000, 2.50, 10.00, 'some text');
    expect(result.inputCost).toBeCloseTo(2.50);
    expect(result.outputCost).toBeCloseTo(5.00);
    expect(result.totalCost).toBeCloseTo(7.50);
  });

  it('zero tokens produce zero cost', () => {
    const result = calculateLlmCost(0, 0, 2.50, 10.00, '');
    expect(result.totalCost).toBe(0);
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
  });

  it('characterCount matches rawText length', () => {
    const text = 'hello world';
    const result = calculateLlmCost(100, 50, 1.0, 2.0, text);
    expect(result.characterCount).toBe(text.length);
  });

  it('estimatedInputTokens and estimatedOutputTokens match input arguments', () => {
    const result = calculateLlmCost(300, 150, 1.0, 2.0, 'test');
    expect(result.estimatedInputTokens).toBe(300);
    expect(result.estimatedOutputTokens).toBe(150);
  });

  it('totalCost equals inputCost plus outputCost', () => {
    const result = calculateLlmCost(500, 200, 3.00, 15.00, 'sample text');
    expect(result.totalCost).toBeCloseTo(result.inputCost + result.outputCost);
  });
});
