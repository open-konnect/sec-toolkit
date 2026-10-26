/**
 * One text-capable model from the generated build-time pricing catalog.
 * Missing prices are represented as null, never as zero.
 */
export interface LlmModel {
  id: string;
  providerId: string;
  provider: string;
  model: string;
  displayName: string;
  inputCostPerToken: number | null;
  outputCostPerToken: number | null;
  cacheReadInputCostPerToken: number | null;
  cacheCreationInputCostPerToken: number | null;
  contextWindow: number | null;
  mode?: string;
}

export interface LlmCatalog {
  schemaVersion: number;
  source: string;
  sourceUrl?: string;
  /** ISO timestamp of the last successful build-time refresh. */
  fetchedAt: string | null;
  models: LlmModel[];
}

export interface LlmProviderOption {
  id: string;
  name: string;
  modelCount: number;
}

export interface PopularModelConfig {
  id: string;
  label?: string;
}

export interface ResolvedPopularModel {
  model: LlmModel;
  label: string;
}

/** Legacy prompt-based calculator result, kept for backwards compatibility. */
export interface LlmTokenCalculation {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  characterCount: number;
  wordCount: number;
}

export interface TokenCostInput {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  inputCostPerToken: number | null;
  outputCostPerToken: number | null;
  cacheReadInputCostPerToken?: number | null;
}

export interface TokenCostResult {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  inputCost: number | null;
  cachedInputCost: number | null;
  outputCost: number | null;
  totalCost: number | null;
}

export interface PeriodEstimate {
  dailyCost: number | null;
  monthlyCost: number | null;
}

/** Local heuristic analysis of one piece of user-supplied text. */
export interface TextTokenEstimate {
  tokens: number;
  words: number;
  characters: number;
}

/** Token totals scaled by an expected number of requests per day. */
export interface PeriodTokenUsage {
  dailyInputTokens: number;
  dailyOutputTokens: number;
  dailyTotalTokens: number;
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  monthlyTotalTokens: number;
}

export interface InteractionEstimateInput {
  inputText: string;
  outputText: string;
  inputCostPerToken: number | null;
  outputCostPerToken: number | null;
  cacheReadInputCostPerToken?: number | null;
  cachedInputTokens?: number;
  requestsPerDay?: number;
}

/** Everything the calculator needs for one prompt + sample-response analysis. */
export interface InteractionEstimate {
  input: TextTokenEstimate;
  output: TextTokenEstimate;
  totalTokens: number;
  totalCharacters: number;
  cost: TokenCostResult;
  periodCost: PeriodEstimate;
  periodTokens: PeriodTokenUsage;
}
