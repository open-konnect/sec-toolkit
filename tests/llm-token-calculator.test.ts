import { describe, it, expect } from 'vitest';
import {
  analyzeText,
  calculateLlmCost,
  estimateTokens
} from '../src/tools/llm-token-calculator/logic/tokenCalculator';

describe('analyzeText and estimateTokens', () => {
  it('returns zero for empty and whitespace-only text', () => {
    expect(analyzeText('')).toEqual({ tokens: 0, words: 0, characters: 0 });
    expect(analyzeText('   \n\t  ')).toEqual({ tokens: 0, words: 0, characters: 0 });
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
  });

  it('returns a positive integer for short text and matches analyzeText', () => {
    const tokens = estimateTokens('hello');
    expect(tokens).toBeGreaterThan(0);
    expect(Number.isInteger(tokens)).toBe(true);
    expect(tokens).toBe(analyzeText('hello').tokens);
  });

  it('is deterministic across repeated calls', () => {
    const text = 'A deterministic estimator should return the same value every time.';
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('counts words and characters after trimming outer whitespace', () => {
    const result = analyzeText('  one two three four five  ');
    expect(result.words).toBe(5);
    expect(result.characters).toBe('one two three four five'.length);
  });

  it('increases token count with longer text', () => {
    const short = estimateTokens('hi');
    const long = estimateTokens(
      'The quick brown fox jumps over the lazy dog near the riverbank'
    );
    expect(long).toBeGreaterThan(short);
  });

  it('handles a normal paragraph', () => {
    const paragraph =
      'Language models split text into tokens before processing it. ' +
      'Common words may be a single token, while code and non-English text often use more.';
    const result = analyzeText(paragraph);

    expect(result.words).toBeGreaterThan(15);
    expect(result.characters).toBe(paragraph.length);
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('handles multiline text without treating newlines as words', () => {
    const text = 'first line\nsecond line\r\nthird line\n\nfourth line';
    const result = analyzeText(text);

    expect(result.words).toBe(8);
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('handles punctuation and symbols', () => {
    expect(estimateTokens('Hello, world! (Testing: 100%? — yes.)')).toBeGreaterThan(0);
    expect(estimateTokens('... !!! ??? ***')).toBeGreaterThan(0);
  });

  it('handles numbers', () => {
    expect(estimateTokens('12345 67890 3.14159 -42')).toBeGreaterThan(0);
  });

  it('handles URLs', () => {
    expect(
      estimateTokens('https://example.com/path?query=value&other=123#section')
    ).toBeGreaterThan(0);
  });

  it('handles source code', () => {
    const source = [
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}'
    ].join('\n');

    const result = analyzeText(source);
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.characters).toBe(source.length);
  });

  it('handles JSON', () => {
    const json = JSON.stringify({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'Hello world' }],
      temperature: 0.2
    });

    expect(estimateTokens(json)).toBeGreaterThan(0);
    expect(analyzeText(json).characters).toBe(json.length);
  });

  it('handles Unicode and non-ASCII text', () => {
    expect(estimateTokens('こんにちは世界')).toBeGreaterThan(0);
    expect(estimateTokens('Привет, мир! ça va?')).toBeGreaterThan(0);
    expect(estimateTokens('emoji 🙂🚀 and accents café')).toBeGreaterThan(0);
  });

  it('handles large input efficiently and returns a finite value', () => {
    const large = 'The quick brown fox jumps over the lazy dog. '.repeat(10_000);
    const result = analyzeText(large);

    expect(result.characters).toBe(large.trim().length);
    expect(result.words).toBe(90_000);
    expect(Number.isFinite(result.tokens)).toBe(true);
    expect(result.tokens).toBeGreaterThan(0);
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

  it('uses the shared word count from analyzeText', () => {
    const text = 'one two three';
    const result = calculateLlmCost(100, 50, 1.0, 2.0, text);
    expect(result.wordCount).toBe(analyzeText(text).words);
  });
});
