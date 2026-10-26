import { LlmModelPreset, LlmTokenCalculation } from '../types';

export const POPULAR_LLM_MODELS: LlmModelPreset[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: 128000,
    inputCostPerMillion: 2.50,
    outputCostPerMillion: 10.00
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: 200000,
    inputCostPerMillion: 3.00,
    outputCostPerMillion: 15.00
  },
  {
    id: 'gemini-1-5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    contextWindow: 2000000,
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.00
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    contextWindow: 200000,
    inputCostPerMillion: 0.80,
    outputCostPerMillion: 4.00
  },
  {
    id: 'llama-3-1-70b',
    name: 'Llama 3.1 70B (Hosted)',
    provider: 'Open Source',
    contextWindow: 128000,
    inputCostPerMillion: 0.88,
    outputCostPerMillion: 0.88
  }
];

/**
 * Estimates token counts based on standard Byte-Pair Encoding heuristics:
 * In English prose/code, 1 token is approximately 3.8 to 4.0 characters (or ~0.75 words).
 */
export function estimateTokens(text: string): { tokens: number; words: number } {
  if (!text || !text.trim()) {
    return { tokens: 0, words: 0 };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  // BPE heuristic: average 3.9 characters per token for mixed English text and code
  const tokensFromChars = Math.ceil(clean.length / 3.9);
  const tokensFromWords = Math.ceil(words * 1.33);

  // Take the blend of character-based and word-based estimation
  const tokens = Math.max(1, Math.round((tokensFromChars + tokensFromWords) / 2));

  return { tokens, words };
}

/**
 * Calculates estimated API pricing for input and anticipated output.
 */
export function calculateLlmCost(
  inputTokens: number,
  outputTokens: number,
  inputRatePerM: number,
  outputRatePerM: number,
  rawText: string
): LlmTokenCalculation {
  const { words } = estimateTokens(rawText);

  const inputCost = (inputTokens / 1_000_000) * inputRatePerM;
  const outputCost = (outputTokens / 1_000_000) * outputRatePerM;
  const totalCost = inputCost + outputCost;

  return {
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    inputCost,
    outputCost,
    totalCost,
    characterCount: rawText.length,
    wordCount: words
  };
}
