import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildModelCatalog,
  dedupeModels,
  findMissingPopularModels,
  humanizeModelName,
  isUsableCatalog,
  normalizeModelEntry,
  normalizePrice,
  normalizeProvider
} from '../scripts/lib/llm-models.mjs';
import {
  fetchLlmCatalog,
  formatContextWindow,
  formatFetchedAt,
  getLlmCatalogUrl,
  getMissingPopularModelIds,
  getProviderOptions,
  parseLlmCatalog,
  pickDefaultModel,
  resolvePopularModels,
  searchModels
} from '../src/tools/llm-token-calculator/logic/catalog';
import {
  analyzeText,
  calculateInteractionEstimate,
  calculatePeriodEstimate,
  calculatePeriodTokenUsage,
  calculateTokenCost,
  formatRatePerMillion,
  formatTokenCount,
  formatUsd
} from '../src/tools/llm-token-calculator/logic/tokenCalculator';
import type { LlmModel } from '../src/tools/llm-token-calculator/types';
import popularModelsConfig from '../src/data/popularModels.json';

const scriptPath = fileURLToPath(new URL('../scripts/fetch-llm-models.mjs', import.meta.url));
const realCatalogPath = fileURLToPath(
  new URL('../public/data/llm-models.json', import.meta.url)
);

function makeModel(overrides: Partial<LlmModel> = {}): LlmModel {
  return {
    id: 'openai/gpt-test',
    providerId: 'openai',
    provider: 'OpenAI',
    model: 'gpt-test',
    displayName: 'GPT Test',
    inputCostPerToken: 0.000001,
    outputCostPerToken: 0.000002,
    cacheReadInputCostPerToken: null,
    cacheCreationInputCostPerToken: null,
    contextWindow: 128_000,
    mode: 'chat',
    ...overrides
  };
}

function rawEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'chat',
    litellm_provider: 'openai',
    input_cost_per_token: 0.000001,
    output_cost_per_token: 0.000002,
    ...overrides
  };
}

const validPayload = {
  schemaVersion: 1,
  source: 'LiteLLM model cost map',
  sourceUrl: 'https://example.com/prices.json',
  fetchedAt: '2026-10-26T15:00:00.000Z',
  models: [makeModel()]
};

const tempDirs: string[] = [];
const servers: Server[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'llm-catalog-test-'));
  tempDirs.push(dir);
  return dir;
}

function startServer(
  handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    servers.push(server);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine test server port.'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}/model_prices.json`);
    });
  });
}

interface ScriptResult {
  status: number | null;
  output: string;
}

function runFetchScript(env: Record<string, string>): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ...env }
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, output }));
  });
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('provider normalization', () => {
  it('normalizes common provider aliases', () => {
    expect(normalizeProvider('openai')).toEqual({ id: 'openai', name: 'OpenAI' });
    expect(normalizeProvider('text-completion-openai')).toEqual({
      id: 'openai',
      name: 'OpenAI'
    });
    expect(normalizeProvider('cohere_chat')).toEqual({ id: 'cohere', name: 'Cohere' });
    expect(normalizeProvider('xai')).toEqual({ id: 'xai', name: 'xAI' });
    expect(normalizeProvider('together_ai')).toEqual({ id: 'together-ai', name: 'Together AI' });
  });

  it('maps vertex and azure families to stable provider IDs', () => {
    expect(normalizeProvider('vertex_ai-anthropic_models')).toEqual({
      id: 'google',
      name: 'Google'
    });
    expect(normalizeProvider('vertex_ai-language-models')).toEqual({
      id: 'google',
      name: 'Google'
    });
    expect(normalizeProvider('azure_ai')).toEqual({ id: 'azure', name: 'Microsoft Azure' });
    expect(normalizeProvider('bedrock_converse')).toEqual({
      id: 'amazon-bedrock',
      name: 'Amazon Bedrock'
    });
  });

  it('keeps unknown providers with a slugged ID and readable name', () => {
    expect(normalizeProvider('acme_labs')).toEqual({ id: 'acme-labs', name: 'Acme Labs' });
    expect(normalizeProvider('  Example-Provider ')).toEqual({
      id: 'example-provider',
      name: 'Example Provider'
    });
    expect(normalizeProvider('')).toBeNull();
  });
});

describe('model normalization and display names', () => {
  it('humanizes acronyms, versions, and duplicate words', () => {
    expect(humanizeModelName('gpt-5-mini')).toBe('GPT-5 Mini');
    expect(humanizeModelName('deepseek-chat')).toBe('DeepSeek Chat');
    expect(humanizeModelName('claude-sonnet-4-5')).toBe('Claude Sonnet 4.5');
    expect(humanizeModelName('gpt-4o-2024-08-06')).toBe('GPT-4o 2024/08/06');
    expect(humanizeModelName('meta-llama/Llama-3.3-70B-Instruct-Turbo')).toBe(
      'Meta Llama 3.3 70B Instruct Turbo'
    );
  });

  it('normalizes a text entry, strips provider prefixes, and keeps cache pricing', () => {
    const entry = normalizeModelEntry(
      'openai/gpt-test',
      rawEntry({
        cache_read_input_token_cost: 0.0000001,
        cache_creation_input_token_cost: 0.0000002,
        max_input_tokens: 200_000
      })
    );

    expect(entry).toMatchObject({
      id: 'openai/gpt-test',
      providerId: 'openai',
      provider: 'OpenAI',
      model: 'gpt-test',
      displayName: 'GPT Test',
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002,
      cacheReadInputCostPerToken: 0.0000001,
      cacheCreationInputCostPerToken: 0.0000002,
      contextWindow: 200_000,
      mode: 'chat'
    });
  });

  it('ignores non-text modes, malformed entries, and entries with no price', () => {
    expect(normalizeModelEntry('embed', rawEntry({ mode: 'embedding' }))).toBeNull();
    expect(normalizeModelEntry('image', rawEntry({ mode: 'image_generation' }))).toBeNull();
    expect(normalizeModelEntry('sample_spec', rawEntry())).toBeNull();
    expect(normalizeModelEntry('broken', null)).toBeNull();
    expect(
      normalizeModelEntry(
        'free-info',
        rawEntry({ input_cost_per_token: undefined, output_cost_per_token: undefined })
      )
    ).toBeNull();
  });
});

describe('price normalization', () => {
  it('turns missing or invalid prices into null and preserves zero', () => {
    expect(normalizePrice(undefined)).toBeNull();
    expect(normalizePrice(null)).toBeNull();
    expect(normalizePrice('0.5')).toBeNull();
    expect(normalizePrice(-1)).toBeNull();
    expect(normalizePrice(Number.NaN)).toBeNull();
    expect(normalizePrice(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizePrice(0)).toBe(0);
    expect(normalizePrice(0.000001)).toBe(0.000001);
  });

  it('does not treat a zero price as missing in the calculator', () => {
    const result = calculateTokenCost({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      inputCostPerToken: 0,
      outputCostPerToken: 0
    });

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe('deduplication', () => {
  it('collapses exact aliases and keeps one canonical ID', () => {
    const catalog = buildModelCatalog(
      {
        'openai/gpt-test': rawEntry(),
        'gpt-test': rawEntry(),
        'openai/gpt-test-alias': rawEntry({ output_cost_per_token: 0.000003 })
      },
      { fetchedAt: '2026-10-26T15:00:00.000Z' }
    );

    expect(catalog.models.filter((model) => model.model === 'gpt-test')).toHaveLength(1);
    expect(catalog.models.map((model) => model.id)).toContain('openai/gpt-test');
  });

  it('keeps different-priced variants with unique IDs', () => {
    const catalog = buildModelCatalog(
      {
        'openai/gpt-test': rawEntry({ input_cost_per_token: 0.000001 }),
        'gpt-test': rawEntry({ input_cost_per_token: 0.000002 })
      },
      { fetchedAt: '2026-10-26T15:00:00.000Z' }
    );

    const ids = catalog.models.map((model) => model.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(catalog.models.map((model) => model.inputCostPerToken).sort()).toEqual([
      0.000001,
      0.000002
    ]);
  });

  it('dedupeModels returns sorted, unique IDs', () => {
    const models = [
      normalizeModelEntry('zeta/x', rawEntry({ litellm_provider: 'zeta' })),
      normalizeModelEntry('alpha/x', rawEntry({ litellm_provider: 'alpha' })),
      normalizeModelEntry('alpha/x', rawEntry({ litellm_provider: 'alpha' }))
    ].filter((model): model is NonNullable<typeof model> => model !== null);

    const deduped = dedupeModels(models);
    const ids = deduped.map((model) => model.id);

    expect(ids).toEqual([...ids].sort((a, b) => {
      const providerA = deduped.find((model) => model.id === a)?.provider ?? '';
      const providerB = deduped.find((model) => model.id === b)?.provider ?? '';
      return providerA.localeCompare(providerB, 'en') || a.localeCompare(b, 'en');
    }));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('provider and search filtering', () => {
  const models = [
    makeModel({ id: 'openai/gpt-5', model: 'gpt-5', displayName: 'GPT-5' }),
    makeModel({ id: 'openai/gpt-5-mini', model: 'gpt-5-mini', displayName: 'GPT-5 Mini' }),
    makeModel({ id: 'openai/o3', model: 'o3', displayName: 'O3' }),
    makeModel({
      id: 'anthropic/claude-sonnet-4-5',
      providerId: 'anthropic',
      provider: 'Anthropic',
      model: 'claude-sonnet-4-5',
      displayName: 'Claude Sonnet 4.5'
    }),
    makeModel({
      id: 'acme/vision-one',
      providerId: 'acme',
      provider: 'Acme Labs',
      model: 'vision-one',
      displayName: 'Vision One'
    })
  ];

  it('derives provider counts and puts known providers first', () => {
    const providers = getProviderOptions(models);

    expect(providers.map((provider) => provider.id)).toEqual([
      'openai',
      'anthropic',
      'acme'
    ]);
    expect(providers[0]).toMatchObject({ name: 'OpenAI', modelCount: 3 });
    expect(providers[2]).toMatchObject({ name: 'Acme Labs', modelCount: 1 });
  });

  it('searches by model name or ID and requires every query word', () => {
    expect(searchModels(models, 'gpt').map((model) => model.id)).toEqual([
      'openai/gpt-5',
      'openai/gpt-5-mini'
    ]);
    expect(searchModels(models, 'claude 4.5').map((model) => model.id)).toEqual([
      'anthropic/claude-sonnet-4-5'
    ]);
    expect(searchModels(models, 'anthropic sonnet')).toHaveLength(1);
    expect(searchModels(models, 'no such model')).toHaveLength(0);
    expect(searchModels(models, '')).toHaveLength(models.length);
  });
});

describe('popular model resolution', () => {
  const models = [
    makeModel({ id: 'openai/gpt-5', displayName: 'GPT-5' }),
    makeModel({
      id: 'anthropic/claude-sonnet-4-5',
      providerId: 'anthropic',
      provider: 'Anthropic',
      model: 'claude-sonnet-4-5',
      displayName: 'Claude Sonnet 4.5'
    })
  ];

  it('resolves configured labels and silently omits missing IDs', () => {
    const resolved = resolvePopularModels(models, [
      { id: 'openai/gpt-5', label: 'GPT-5 Quick Pick' },
      { id: 'missing/model' },
      { id: 'anthropic/claude-sonnet-4-5' }
    ]);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toEqual({ model: models[0], label: 'GPT-5 Quick Pick' });
    expect(resolved[1].label).toBe('Claude Sonnet 4.5');
  });

  it('reports missing popular IDs without failing', () => {
    const config = [{ id: 'openai/gpt-5' }, { id: 'missing/model' }];

    expect(getMissingPopularModelIds(models, config)).toEqual(['missing/model']);
    expect(findMissingPopularModels(models, config)).toEqual(['missing/model']);
    expect(findMissingPopularModels(models, config)).not.toContain('openai/gpt-5');
  });

  it('picks a popular model by default, then falls back inside a provider', () => {
    const popular = resolvePopularModels(models, [
      { id: 'anthropic/claude-sonnet-4-5' }
    ]);

    expect(pickDefaultModel(models, popular)?.id).toBe('anthropic/claude-sonnet-4-5');
    expect(pickDefaultModel(models, popular, 'openai')?.id).toBe('openai/gpt-5');
    expect(pickDefaultModel(models, popular, 'missing-provider')).toBeNull();
  });
});

describe('catalog parsing and loading', () => {
  it('parses a valid catalog and keeps its fetchedAt date', () => {
    const catalog = parseLlmCatalog(validPayload);

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.models).toHaveLength(1);
    expect(catalog.fetchedAt).toBe('2026-10-26T15:00:00.000Z');
  });

  it('represents a missing fetchedAt as null instead of inventing a date', () => {
    const { fetchedAt: _fetchedAt, ...withoutDate } = validPayload;
    const catalog = parseLlmCatalog(withoutDate);

    expect(catalog.fetchedAt).toBeNull();
    expect(formatFetchedAt(catalog.fetchedAt)).toBeNull();
  });

  it('falls back to a source name when source metadata is missing', () => {
    const { source: _source, ...withoutSource } = validPayload;
    expect(parseLlmCatalog(withoutSource).source).toBe('LiteLLM model cost map');
  });

  it('rejects wrong schema versions, empty catalogs, duplicate IDs, and invalid prices', () => {
    expect(() => parseLlmCatalog({ ...validPayload, schemaVersion: 2 })).toThrow(
      /schema version/i
    );
    expect(() => parseLlmCatalog({ ...validPayload, models: [] })).toThrow(/any models/i);
    expect(() =>
      parseLlmCatalog({ ...validPayload, models: [makeModel(), makeModel()] })
    ).toThrow(/duplicate model ID/i);
    expect(() =>
      parseLlmCatalog({
        ...validPayload,
        models: [makeModel({ inputCostPerToken: -1 })]
      })
    ).toThrow(/invalid inputCostPerToken/i);
    expect(() =>
      parseLlmCatalog({
        ...validPayload,
        models: [makeModel({ outputCostPerToken: 'free' as unknown as number })]
      })
    ).toThrow(/invalid outputCostPerToken/i);
  });

  it('fetches and validates JSON while surfacing HTTP errors', async () => {
    const okFetch = async () =>
      new Response(JSON.stringify(validPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

    await expect(fetchLlmCatalog('/data/llm-models.json', okFetch as typeof fetch)).resolves.toMatchObject({
      models: expect.any(Array)
    });

    const errorFetch = async () => new Response('nope', { status: 503 });
    await expect(
      fetchLlmCatalog('/data/llm-models.json', errorFetch as typeof fetch)
    ).rejects.toThrow(/HTTP 503/);

    const invalidJsonFetch = async () =>
      new Response('<html>not json</html>', { status: 200 });
    await expect(
      fetchLlmCatalog('/data/llm-models.json', invalidJsonFetch as typeof fetch)
    ).rejects.toThrow(/not valid JSON/);
  });

  it('builds a base-aware catalog URL', () => {
    expect(getLlmCatalogUrl('/')).toBe('/data/llm-models.json');
    expect(getLlmCatalogUrl('/preview/')).toBe('/preview/data/llm-models.json');
    expect(getLlmCatalogUrl('')).toBe('/data/llm-models.json');
  });
});

describe('token cost and period calculations', () => {
  it('calculates uncached input and output costs per request', () => {
    const result = calculateTokenCost({
      inputTokens: 10_000,
      outputTokens: 2_000,
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002
    });

    expect(result.cachedInputTokens).toBe(0);
    expect(result.uncachedInputTokens).toBe(10_000);
    expect(result.inputCost).toBeCloseTo(0.01);
    expect(result.outputCost).toBeCloseTo(0.004);
    expect(result.totalCost).toBeCloseTo(0.014);
  });

  it('bills cached tokens at the cache-read rate and the rest at the input rate', () => {
    const result = calculateTokenCost({
      inputTokens: 1_000,
      outputTokens: 500,
      cachedInputTokens: 400,
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002,
      cacheReadInputCostPerToken: 0.0000001
    });

    expect(result.cachedInputTokens).toBe(400);
    expect(result.uncachedInputTokens).toBe(600);
    expect(result.cachedInputCost).toBeCloseTo(0.00004);
    expect(result.inputCost).toBeCloseTo(0.00064);
    expect(result.outputCost).toBeCloseTo(0.001);
    expect(result.totalCost).toBeCloseTo(0.00164);
  });

  it('clamps cached tokens to the input count and rejects negative values', () => {
    const result = calculateTokenCost({
      inputTokens: 100,
      outputTokens: -10,
      cachedInputTokens: 250,
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002,
      cacheReadInputCostPerToken: 0.0000001
    });

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(0);
    expect(result.cachedInputTokens).toBe(100);
    expect(result.uncachedInputTokens).toBe(0);
  });

  it('returns null totals when a required price is missing', () => {
    const missingOutput = calculateTokenCost({
      inputTokens: 100,
      outputTokens: 100,
      inputCostPerToken: 0.000001,
      outputCostPerToken: null
    });
    expect(missingOutput.inputCost).not.toBeNull();
    expect(missingOutput.outputCost).toBeNull();
    expect(missingOutput.totalCost).toBeNull();

    const missingCacheRate = calculateTokenCost({
      inputTokens: 100,
      outputTokens: 10,
      cachedInputTokens: 50,
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002,
      cacheReadInputCostPerToken: null
    });
    expect(missingCacheRate.inputCost).toBeNull();
    expect(missingCacheRate.totalCost).toBeNull();
  });

  it('estimates daily and 30-day spend', () => {
    expect(calculatePeriodEstimate(0.01, 100)).toEqual({
      dailyCost: 1,
      monthlyCost: 30
    });
    expect(calculatePeriodEstimate(0.01, 0)).toEqual({ dailyCost: 0, monthlyCost: 0 });
    expect(calculatePeriodEstimate(null, 100)).toEqual({
      dailyCost: null,
      monthlyCost: null
    });
    expect(calculatePeriodEstimate(0.01, -5)).toEqual({ dailyCost: 0, monthlyCost: 0 });
  });

  it('scales token counts to daily and 30-day usage', () => {
    expect(calculatePeriodTokenUsage(100, 50, 10)).toEqual({
      dailyInputTokens: 1_000,
      dailyOutputTokens: 500,
      dailyTotalTokens: 1_500,
      monthlyInputTokens: 30_000,
      monthlyOutputTokens: 15_000,
      monthlyTotalTokens: 45_000
    });
    expect(calculatePeriodTokenUsage(100, 50, 0).dailyTotalTokens).toBe(0);
    expect(calculatePeriodTokenUsage(-100, 50, -2).dailyTotalTokens).toBe(0);
    expect(calculatePeriodTokenUsage(100, 50, 1).monthlyTotalTokens).toBe(4_500);
  });

  it('formats rates, costs, and token counts for display', () => {
    expect(formatRatePerMillion(0.00000125)).toBe('$1.25');
    expect(formatRatePerMillion(null)).toBe('Pricing unavailable');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(1.23456)).toBe('$1.23');
    expect(formatUsd(0.000123)).toBe('$0.000123');
    expect(formatUsd(null)).toBe('—');
    expect(formatTokenCount(1234567)).toBe('1,234,567');
  });
});

describe('interaction estimates from a prompt and sample output', () => {
  const rates = {
    inputCostPerToken: 0.000001,
    outputCostPerToken: 0.000002
  };

  it('estimates input, output, total, and per-request cost from the supplied text', () => {
    const inputText = 'Explain why token counts differ between models.';
    const outputText =
      'Tokenizers split text differently, so the same sentence can use a different number of tokens.';

    const result = calculateInteractionEstimate({
      inputText,
      outputText,
      ...rates,
      requestsPerDay: 1
    });

    expect(result.input).toEqual(analyzeText(inputText));
    expect(result.output).toEqual(analyzeText(outputText));
    expect(result.totalTokens).toBe(result.input.tokens + result.output.tokens);
    expect(result.totalCharacters).toBe(
      result.input.characters + result.output.characters
    );
    expect(result.cost.inputCost).toBeCloseTo(result.input.tokens * rates.inputCostPerToken);
    expect(result.cost.outputCost).toBeCloseTo(
      result.output.tokens * rates.outputCostPerToken
    );
    expect(result.cost.totalCost).toBeCloseTo(
      result.cost.inputCost! + result.cost.outputCost!
    );
    expect(result.periodTokens.dailyTotalTokens).toBe(result.totalTokens);
  });

  it('handles input-only text and leaves output at zero', () => {
    const result = calculateInteractionEstimate({
      inputText: 'Only the prompt was provided.',
      outputText: '',
      ...rates,
      requestsPerDay: 10
    });

    expect(result.input.tokens).toBeGreaterThan(0);
    expect(result.output).toEqual({ tokens: 0, words: 0, characters: 0 });
    expect(result.totalTokens).toBe(result.input.tokens);
    expect(result.cost.inputCost).toBeGreaterThan(0);
    expect(result.cost.outputCost).toBe(0);
    expect(result.cost.totalCost).toBeCloseTo(result.cost.inputCost!);
    expect(result.periodTokens.dailyOutputTokens).toBe(0);
  });

  it('handles output-only text and leaves input at zero', () => {
    const result = calculateInteractionEstimate({
      inputText: '',
      outputText: 'Only the sample response was provided.',
      ...rates,
      requestsPerDay: 10
    });

    expect(result.input).toEqual({ tokens: 0, words: 0, characters: 0 });
    expect(result.output.tokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBe(result.output.tokens);
    expect(result.cost.inputCost).toBe(0);
    expect(result.cost.outputCost).toBeGreaterThan(0);
    expect(result.cost.totalCost).toBeCloseTo(result.cost.outputCost!);
    expect(result.periodTokens.dailyInputTokens).toBe(0);
  });

  it('returns a zero estimate when both text fields are empty', () => {
    const result = calculateInteractionEstimate({
      inputText: '',
      outputText: '   ',
      ...rates,
      requestsPerDay: 100
    });

    expect(result.totalTokens).toBe(0);
    expect(result.totalCharacters).toBe(0);
    expect(result.cost.totalCost).toBe(0);
    expect(result.periodCost).toEqual({ dailyCost: 0, monthlyCost: 0 });
    expect(result.periodTokens.monthlyTotalTokens).toBe(0);
  });

  it('scales tokens and costs for daily and monthly request counts', () => {
    const inputText = 'A short prompt for scaling.';
    const outputText = 'A sample response used to check daily and monthly totals.';
    const requestsPerDay = 250;

    const single = calculateInteractionEstimate({
      inputText,
      outputText,
      ...rates,
      requestsPerDay: 1
    });
    const scaled = calculateInteractionEstimate({
      inputText,
      outputText,
      ...rates,
      requestsPerDay
    });

    expect(scaled.periodTokens.dailyInputTokens).toBe(single.input.tokens * requestsPerDay);
    expect(scaled.periodTokens.dailyOutputTokens).toBe(single.output.tokens * requestsPerDay);
    expect(scaled.periodTokens.dailyTotalTokens).toBe(single.totalTokens * requestsPerDay);
    expect(scaled.periodTokens.monthlyTotalTokens).toBe(
      single.totalTokens * requestsPerDay * 30
    );
    expect(scaled.periodCost.dailyCost).toBeCloseTo(single.cost.totalCost! * requestsPerDay);
    expect(scaled.periodCost.monthlyCost).toBeCloseTo(
      single.cost.totalCost! * requestsPerDay * 30
    );
  });

  it('recalculates token and cost totals when the prompt or sample output changes', () => {
    const outputText = 'A fixed sample response.';
    const shortPrompt = calculateInteractionEstimate({
      inputText: 'Short prompt.',
      outputText,
      ...rates
    });
    const longPrompt = calculateInteractionEstimate({
      inputText: 'A substantially longer prompt with many more words to measure.',
      outputText,
      ...rates
    });

    expect(longPrompt.input.tokens).toBeGreaterThan(shortPrompt.input.tokens);
    expect(longPrompt.totalTokens).toBeGreaterThan(shortPrompt.totalTokens);
    expect(longPrompt.cost.inputCost).toBeGreaterThan(shortPrompt.cost.inputCost!);
    expect(longPrompt.cost.outputCost).toBe(shortPrompt.cost.outputCost);

    const longerOutput = calculateInteractionEstimate({
      inputText: 'Short prompt.',
      outputText: `${outputText} ${outputText} ${outputText}`,
      ...rates
    });

    expect(longerOutput.output.tokens).toBeGreaterThan(shortPrompt.output.tokens);
    expect(longerOutput.cost.outputCost).toBeGreaterThan(shortPrompt.cost.outputCost!);
  });

  it('recalculates cost when models have different input and output prices', () => {
    const inputText = 'Compare pricing across two catalog models.';
    const outputText = 'The same text should cost different amounts at different rates.';

    const cheaperInput = calculateInteractionEstimate({
      inputText,
      outputText,
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.00001
    });
    const cheaperOutput = calculateInteractionEstimate({
      inputText,
      outputText,
      inputCostPerToken: 0.000005,
      outputCostPerToken: 0.000002
    });

    expect(cheaperInput.cost.inputCost).not.toBe(cheaperOutput.cost.inputCost);
    expect(cheaperInput.cost.outputCost).not.toBe(cheaperOutput.cost.outputCost);
    expect(cheaperInput.cost.totalCost).not.toBe(cheaperOutput.cost.totalCost);
  });

  it('keeps useful partial estimates when an unused side has no price', () => {
    const inputOnly = calculateInteractionEstimate({
      inputText: 'Prompt text with a known input price.',
      outputText: '',
      inputCostPerToken: 0.000001,
      outputCostPerToken: null
    });

    expect(inputOnly.cost.inputCost).toBeGreaterThan(0);
    expect(inputOnly.cost.outputCost).toBe(0);
    expect(inputOnly.cost.totalCost).toBeCloseTo(inputOnly.cost.inputCost!);

    const outputOnly = calculateInteractionEstimate({
      inputText: '',
      outputText: 'Sample output with a known output price.',
      inputCostPerToken: null,
      outputCostPerToken: 0.000002
    });

    expect(outputOnly.cost.inputCost).toBe(0);
    expect(outputOnly.cost.outputCost).toBeGreaterThan(0);
    expect(outputOnly.cost.totalCost).toBeCloseTo(outputOnly.cost.outputCost!);
  });

  it('does not treat a missing price as $0 for nonzero tokens', () => {
    const result = calculateInteractionEstimate({
      inputText: 'This input has tokens that need a price.',
      outputText: 'This output has tokens that need a price.',
      inputCostPerToken: 0.000001,
      outputCostPerToken: null
    });

    expect(result.cost.inputCost).not.toBeNull();
    expect(result.cost.outputCost).toBeNull();
    expect(result.cost.totalCost).toBeNull();
    expect(result.periodCost).toEqual({ dailyCost: null, monthlyCost: null });
  });

  it('returns zero rather than null for empty text with missing prices', () => {
    const result = calculateInteractionEstimate({
      inputText: '',
      outputText: '',
      inputCostPerToken: null,
      outputCostPerToken: null
    });

    expect(result.cost.inputCost).toBe(0);
    expect(result.cost.outputCost).toBe(0);
    expect(result.cost.totalCost).toBe(0);
  });

  it('forwards and clamps cached input tokens through the interaction estimate', () => {
    const inputText = 'word '.repeat(500);

    const result = calculateInteractionEstimate({
      inputText,
      outputText: '',
      inputCostPerToken: 0.000001,
      outputCostPerToken: 0.000002,
      cacheReadInputCostPerToken: 0.0000001,
      cachedInputTokens: 1_000_000
    });

    expect(result.cost.cachedInputTokens).toBe(result.input.tokens);
    expect(result.cost.uncachedInputTokens).toBe(0);
    expect(result.cost.cachedInputCost).toBeCloseTo(
      result.input.tokens * 0.0000001
    );
    expect(result.cost.inputCost).toBeCloseTo(result.cost.cachedInputCost!);
  });
});

describe('catalog date and context formatting', () => {
  it('formats fetchedAt with a long month in UTC', () => {
    expect(formatFetchedAt('2026-10-26T15:00:00.000Z', 'en-US')).toBe('October 26, 2026');
    expect(formatFetchedAt('2020-01-01T00:00:00.000Z', 'en-US')).toBe('January 1, 2020');
  });

  it('returns null for missing or invalid dates rather than using today', () => {
    expect(formatFetchedAt(null)).toBeNull();
    expect(formatFetchedAt(undefined)).toBeNull();
    expect(formatFetchedAt('')).toBeNull();
    expect(formatFetchedAt('not-a-date')).toBeNull();
  });

  it('formats optional context windows', () => {
    expect(formatContextWindow(null)).toBeNull();
    expect(formatContextWindow(0)).toBeNull();
    expect(formatContextWindow(128_000)).toBe('128K tokens (128,000)');
    expect(formatContextWindow(1_000_000)).toBe('1M tokens (1,000,000)');
    expect(formatContextWindow(1_048_576)).toBe('1.05M tokens (1,048,576)');
  });
});

describe('generated catalog', () => {
  it('is valid, includes the configured popular models, and has a fetch date', () => {
    expect(existsSync(realCatalogPath)).toBe(true);

    const catalog = parseLlmCatalog(JSON.parse(readFileSync(realCatalogPath, 'utf8')));
    const ids = new Set(catalog.models.map((model) => model.id));

    expect(catalog.models.length).toBeGreaterThan(100);
    expect(getProviderOptions(catalog.models).length).toBeGreaterThan(10);
    expect(formatFetchedAt(catalog.fetchedAt)).not.toBeNull();

    for (const popular of popularModelsConfig) {
      expect(ids.has(popular.id), `missing popular model ${popular.id}`).toBe(true);
    }
  });
});

describe('build-time refresh fallback', () => {
  it('only treats a complete, dated, duplicate-free catalog as usable', () => {
    expect(isUsableCatalog(validPayload)).toBe(true);
    expect(isUsableCatalog({ ...validPayload, fetchedAt: 'not-a-date' })).toBe(false);
    expect(isUsableCatalog({ ...validPayload, fetchedAt: '' })).toBe(false);
    expect(isUsableCatalog({ ...validPayload, models: [] })).toBe(false);
    expect(
      isUsableCatalog({ ...validPayload, models: [makeModel(), makeModel()] })
    ).toBe(false);
    expect(
      isUsableCatalog({
        ...validPayload,
        models: [makeModel({ outputCostPerToken: -0.1 })]
      })
    ).toBe(false);
  });

  it('keeps a stale valid dataset unchanged when the refresh fails', async () => {
    const dir = makeTempDir();
    const outputPath = path.join(dir, 'llm-models.json');
    const popularPath = path.join(dir, 'popular.json');
    const previous = JSON.stringify(validPayload);
    writeFileSync(outputPath, previous, 'utf8');
    writeFileSync(popularPath, JSON.stringify([{ id: 'openai/gpt-test' }]), 'utf8');

    const sourceUrl = await startServer((_request, response) => {
      response.statusCode = 503;
      response.end('upstream unavailable');
    });

    const result = await runFetchScript({
      LLM_MODELS_SOURCE_URL: sourceUrl,
      LLM_MODELS_OUTPUT_PATH: outputPath,
      LLM_MODELS_POPULAR_PATH: popularPath,
      LLM_MODELS_FETCH_TIMEOUT_MS: '2000'
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain('Using the previous valid dataset');
    expect(result.output).toContain('2026-10-26T15:00:00.000Z');
    expect(result.output).toContain('Popular models validated against the kept dataset: 1/1 present.');
    expect(readFileSync(outputPath, 'utf8')).toBe(previous);
    expect(isUsableCatalog(JSON.parse(previous))).toBe(true);
  }, 15_000);

  it('fails clearly when the refresh fails and no valid dataset exists', async () => {
    const dir = makeTempDir();
    const outputPath = path.join(dir, 'llm-models.json');
    const popularPath = path.join(dir, 'popular.json');
    writeFileSync(popularPath, '[]', 'utf8');

    const sourceUrl = await startServer((_request, response) => {
      response.statusCode = 503;
      response.end('upstream unavailable');
    });

    const result = await runFetchScript({
      LLM_MODELS_SOURCE_URL: sourceUrl,
      LLM_MODELS_OUTPUT_PATH: outputPath,
      LLM_MODELS_POPULAR_PATH: popularPath,
      LLM_MODELS_FETCH_TIMEOUT_MS: '2000'
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('no valid previous dataset was found');
    expect(result.output).toContain('npm run fetch:llm-models');
    expect(existsSync(outputPath)).toBe(false);
  }, 15_000);

  it('writes a refreshed catalog and warns about missing popular models', async () => {
    const dir = makeTempDir();
    const outputPath = path.join(dir, 'llm-models.json');
    const popularPath = path.join(dir, 'popular.json');
    writeFileSync(
      popularPath,
      JSON.stringify([{ id: 'openai/test-model-0' }, { id: 'openai/not-in-catalog' }]),
      'utf8'
    );

    const upstream = Object.fromEntries(
      Array.from({ length: 60 }, (_value, index) => [
        `test-model-${index}`,
        rawEntry({ input_cost_per_token: 0.000001 + index / 1_000_000_000 })
      ])
    );

    const sourceUrl = await startServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(upstream));
    });

    const result = await runFetchScript({
      LLM_MODELS_SOURCE_URL: sourceUrl,
      LLM_MODELS_OUTPUT_PATH: outputPath,
      LLM_MODELS_POPULAR_PATH: popularPath,
      LLM_MODELS_FETCH_TIMEOUT_MS: '2000'
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain('Normalized 60 text models');

    const written = JSON.parse(readFileSync(outputPath, 'utf8'));
    expect(written.models).toHaveLength(60);
    expect(written.schemaVersion).toBe(1);
    expect(written.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.output).toContain('popular model "openai/not-in-catalog" is not present');
    expect(result.output).toContain('Popular models validated: 1/2 present.');
  }, 15_000);
});
