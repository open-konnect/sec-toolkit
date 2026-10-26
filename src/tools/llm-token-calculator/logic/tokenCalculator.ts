import {
  InteractionEstimate,
  InteractionEstimateInput,
  LlmTokenCalculation,
  PeriodEstimate,
  PeriodTokenUsage,
  TextTokenEstimate,
  TokenCostInput,
  TokenCostResult
} from '../types';

export const TOKENS_PER_MILLION = 1_000_000;
export const DAYS_PER_MONTH = 30;

/**
 * Approximate characters per token for mixed English prose and code.
 * This is a local heuristic, not a model-specific tokenizer.
 */
export const APPROX_CHARS_PER_TOKEN = 3.9;
/** Approximate tokens per whitespace-delimited word for mixed English text. */
export const APPROX_TOKENS_PER_WORD = 1.33;

function isWhitespaceCode(code: number): boolean {
  if (code <= 32) return true;

  return (
    code === 0x00a0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/**
 * Analyses text locally with a deterministic O(n) heuristic.
 *
 * The estimate blends two signals: roughly one token per 3.9 characters and
 * roughly 1.33 tokens per whitespace-delimited word. It is intentionally
 * approximate because real tokenization depends on the model and provider.
 * No network request or model-specific tokenizer is involved.
 */
export function analyzeText(text: string): TextTokenEstimate {
  const clean = text.trim();
  const characters = clean.length;

  if (characters === 0) {
    return { tokens: 0, words: 0, characters: 0 };
  }

  let words = 0;
  let insideWord = false;

  for (let index = 0; index < characters; index += 1) {
    if (isWhitespaceCode(clean.charCodeAt(index))) {
      insideWord = false;
    } else if (!insideWord) {
      words += 1;
      insideWord = true;
    }
  }

  const tokensFromCharacters = Math.ceil(characters / APPROX_CHARS_PER_TOKEN);
  const tokensFromWords = Math.ceil(words * APPROX_TOKENS_PER_WORD);
  const tokens = Math.max(1, Math.round((tokensFromCharacters + tokensFromWords) / 2));

  return { tokens, words, characters };
}

/** Estimates the token count for a single piece of text. */
export function estimateTokens(text: string): number {
  return analyzeText(text).tokens;
}

/**
 * Legacy prompt-based estimate using per-million rates. Kept so existing
 * consumers and tests continue to work.
 */
export function calculateLlmCost(
  inputTokens: number,
  outputTokens: number,
  inputRatePerM: number,
  outputRatePerM: number,
  rawText: string
): LlmTokenCalculation {
  const { words } = analyzeText(rawText);

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * inputRatePerM;
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * outputRatePerM;
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

function nonNegative(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Multiplies tokens by a catalog rate. A missing rate yields null only when
 * tokens actually need to be billed, so an empty input or output field can
 * still produce a useful partial estimate without pretending a nonzero price
 * is zero.
 */
function costForTokens(tokens: number, costPerToken: number | null): number | null {
  if (tokens === 0) return 0;
  if (costPerToken === null || !Number.isFinite(costPerToken) || costPerToken < 0) return null;
  return tokens * costPerToken;
}

/**
 * Calculates request cost using catalog rates expressed per token.
 *
 * Cached input tokens are treated as a subset of input tokens. When no cached
 * token count is supplied, all input tokens are billed at the normal input
 * rate. A missing price produces null rather than pretending the model is free.
 */
export function calculateTokenCost(input: TokenCostInput): TokenCostResult {
  const inputTokens = nonNegative(input.inputTokens);
  const outputTokens = nonNegative(input.outputTokens);
  const requestedCachedTokens = nonNegative(input.cachedInputTokens);
  const cachedInputTokens = Math.min(requestedCachedTokens, inputTokens);
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const cacheReadRate = input.cacheReadInputCostPerToken ?? null;

  const uncachedInputCost = costForTokens(uncachedInputTokens, input.inputCostPerToken);
  const cachedInputCost = costForTokens(cachedInputTokens, cacheReadRate);

  const inputCost =
    uncachedInputCost === null || cachedInputCost === null
      ? null
      : uncachedInputCost + cachedInputCost;
  const outputCost = costForTokens(outputTokens, input.outputCostPerToken);
  const totalCost = inputCost === null || outputCost === null ? null : inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost
  };
}

/** Estimates daily and monthly (30-day) spend from one request's cost. */
export function calculatePeriodEstimate(
  costPerRequest: number | null,
  requestsPerDay: number
): PeriodEstimate {
  if (costPerRequest === null || !Number.isFinite(costPerRequest) || costPerRequest < 0) {
    return { dailyCost: null, monthlyCost: null };
  }

  const requests = nonNegative(requestsPerDay);
  const dailyCost = costPerRequest * requests;

  return {
    dailyCost,
    monthlyCost: dailyCost * DAYS_PER_MONTH
  };
}

/** Scales one interaction's token counts to daily and 30-day totals. */
export function calculatePeriodTokenUsage(
  inputTokens: number,
  outputTokens: number,
  requestsPerDay: number
): PeriodTokenUsage {
  const requests = nonNegative(requestsPerDay);
  const safeInputTokens = nonNegative(inputTokens);
  const safeOutputTokens = nonNegative(outputTokens);

  const dailyInputTokens = safeInputTokens * requests;
  const dailyOutputTokens = safeOutputTokens * requests;

  return {
    dailyInputTokens,
    dailyOutputTokens,
    dailyTotalTokens: dailyInputTokens + dailyOutputTokens,
    monthlyInputTokens: dailyInputTokens * DAYS_PER_MONTH,
    monthlyOutputTokens: dailyOutputTokens * DAYS_PER_MONTH,
    monthlyTotalTokens: (dailyInputTokens + dailyOutputTokens) * DAYS_PER_MONTH
  };
}

/**
 * Estimates one prompt + sample-response interaction entirely locally.
 *
 * The sample output is measured directly rather than predicted from the
 * prompt. Empty text produces zero tokens for that side, so input-only and
 * output-only interactions remain useful.
 */
export function calculateInteractionEstimate(
  input: InteractionEstimateInput
): InteractionEstimate {
  const inputEstimate = analyzeText(input.inputText);
  const outputEstimate = analyzeText(input.outputText);
  const totalTokens = inputEstimate.tokens + outputEstimate.tokens;
  const requestsPerDay = input.requestsPerDay ?? 0;

  const cost = calculateTokenCost({
    inputTokens: inputEstimate.tokens,
    outputTokens: outputEstimate.tokens,
    cachedInputTokens: input.cachedInputTokens,
    inputCostPerToken: input.inputCostPerToken,
    outputCostPerToken: input.outputCostPerToken,
    cacheReadInputCostPerToken: input.cacheReadInputCostPerToken ?? null
  });

  return {
    input: inputEstimate,
    output: outputEstimate,
    totalTokens,
    totalCharacters: inputEstimate.characters + outputEstimate.characters,
    cost,
    periodCost: calculatePeriodEstimate(cost.totalCost, requestsPerDay),
    periodTokens: calculatePeriodTokenUsage(
      inputEstimate.tokens,
      outputEstimate.tokens,
      requestsPerDay
    )
  };
}

/** Currency formatting with sensible precision and no floating-point artifacts. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0.00';

  const absolute = Math.abs(value);
  if (absolute < 1e-8) return `$${value.toExponential(2)}`;

  if (absolute >= 0.01) {
    const maximumFractionDigits = absolute < 1 ? 4 : 2;
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits
    })}`;
  }

  const decimals = absolute < 0.0001 ? 8 : 6;
  const fixed = value.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  return `$${fixed}`;
}

/** Formats a per-token catalog rate as a readable price per 1M tokens. */
export function formatRatePerMillion(costPerToken: number | null | undefined): string {
  if (costPerToken === null || costPerToken === undefined || !Number.isFinite(costPerToken)) {
    return 'Pricing unavailable';
  }

  const perMillion = costPerToken * TOKENS_PER_MILLION;
  if (perMillion === 0) return '$0.00';

  const absolute = Math.abs(perMillion);
  if (absolute >= 1) {
    return `$${perMillion.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  const decimals = absolute >= 0.01 ? 4 : 8;
  const fixed = perMillion.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');

  return `$${fixed}`;
}

export function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  return Math.round(value).toLocaleString('en-US');
}
