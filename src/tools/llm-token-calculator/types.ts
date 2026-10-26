export interface LlmModelPreset {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface LlmTokenCalculation {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  characterCount: number;
  wordCount: number;
}
