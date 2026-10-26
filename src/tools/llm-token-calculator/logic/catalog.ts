import { POPULAR_MODELS } from '../../../data/popularModels';
import type {
  LlmCatalog,
  LlmModel,
  LlmProviderOption,
  PopularModelConfig,
  ResolvedPopularModel
} from '../types';

export const LLM_CATALOG_SCHEMA_VERSION = 1;
export const LLM_CATALOG_FETCH_TIMEOUT_MS = 15_000;

const CATALOG_PATH = 'data/llm-models.json';
const catalogCache = new Map<string, Promise<LlmCatalog>>();

/**
 * Friendly ordering only. Providers are still discovered from the generated
 * catalog; unknown providers keep working and are sorted after these.
 */
const PROVIDER_PRIORITY = new Map([
  ['openai', 0],
  ['anthropic', 1],
  ['google', 2],
  ['deepseek', 3],
  ['mistral', 4],
  ['meta', 5],
  ['xai', 6],
  ['cohere', 7],
  ['groq', 8],
  ['together-ai', 9],
  ['fireworks-ai', 10],
  ['amazon-bedrock', 11],
  ['azure', 12],
  ['deepinfra', 13],
  ['perplexity', 14]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Model at index ${index} is missing a valid ${field}.`);
  }
  return value;
}

function readNullablePrice(value: unknown, field: string, index: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Model at index ${index} has an invalid ${field}.`);
  }
  return value;
}

function readContextWindow(value: unknown, index: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Model at index ${index} has an invalid contextWindow.`);
  }
  return Math.round(value);
}

function normalizeCatalogModel(value: unknown, index: number): LlmModel {
  if (!isRecord(value)) {
    throw new Error(`Model at index ${index} is not an object.`);
  }

  return {
    id: readString(value.id, 'id', index),
    providerId: readString(value.providerId, 'providerId', index),
    provider: readString(value.provider, 'provider', index),
    model: readString(value.model, 'model', index),
    displayName: readString(value.displayName, 'displayName', index),
    inputCostPerToken: readNullablePrice(value.inputCostPerToken, 'inputCostPerToken', index),
    outputCostPerToken: readNullablePrice(value.outputCostPerToken, 'outputCostPerToken', index),
    cacheReadInputCostPerToken: readNullablePrice(
      value.cacheReadInputCostPerToken,
      'cacheReadInputCostPerToken',
      index
    ),
    cacheCreationInputCostPerToken: readNullablePrice(
      value.cacheCreationInputCostPerToken,
      'cacheCreationInputCostPerToken',
      index
    ),
    contextWindow: readContextWindow(value.contextWindow, index),
    mode: typeof value.mode === 'string' ? value.mode : undefined
  };
}

/** Parse and validate the generated JSON before the UI uses it. */
export function parseLlmCatalog(payload: unknown): LlmCatalog {
  if (!isRecord(payload)) {
    throw new Error('The LLM pricing catalog is not a JSON object.');
  }

  if (payload.schemaVersion !== LLM_CATALOG_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported LLM pricing catalog schema version: ${String(payload.schemaVersion)}.`
    );
  }

  if (!Array.isArray(payload.models) || payload.models.length === 0) {
    throw new Error('The LLM pricing catalog does not contain any models.');
  }

  const models = payload.models.map((model, index) => normalizeCatalogModel(model, index));
  const ids = new Set<string>();

  for (const model of models) {
    if (ids.has(model.id)) {
      throw new Error(`The LLM pricing catalog contains a duplicate model ID: ${model.id}.`);
    }
    ids.add(model.id);
  }

  return {
    schemaVersion: LLM_CATALOG_SCHEMA_VERSION,
    source:
      typeof payload.source === 'string' && payload.source.trim()
        ? payload.source
        : 'LiteLLM model cost map',
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined,
    fetchedAt:
      typeof payload.fetchedAt === 'string' && payload.fetchedAt.trim()
        ? payload.fetchedAt
        : null,
    models
  };
}

export function getLlmCatalogUrl(baseUrl = import.meta.env.BASE_URL): string {
  const base = baseUrl && baseUrl.length > 0 ? baseUrl : '/';
  return `${base.endsWith('/') ? base : `${base}/`}${CATALOG_PATH}`;
}

/** Exposed for tests and non-cached callers. */
export async function fetchLlmCatalog(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<LlmCatalog> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_CATALOG_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Could not load the pricing catalog (HTTP ${response.status}).`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('The pricing catalog response was not valid JSON.');
    }

    return parseLlmCatalog(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Loading the pricing catalog timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Loads the local catalog once per browser session and shares the in-flight
 * promise between component mounts. Errors are not cached, so Retry works.
 */
export function loadLlmCatalog(baseUrl?: string): Promise<LlmCatalog> {
  const url = getLlmCatalogUrl(baseUrl);
  const cached = catalogCache.get(url);
  if (cached) return cached;

  const request = fetchLlmCatalog(url).catch((error) => {
    catalogCache.delete(url);
    throw error;
  });

  catalogCache.set(url, request);
  return request;
}

export function getProviderOptions(models: LlmModel[]): LlmProviderOption[] {
  const providers = new Map<string, LlmProviderOption>();

  for (const model of models) {
    const existing = providers.get(model.providerId);
    if (existing) {
      existing.modelCount += 1;
    } else {
      providers.set(model.providerId, {
        id: model.providerId,
        name: model.provider,
        modelCount: 1
      });
    }
  }

  return [...providers.values()].sort((a, b) => {
    const priorityA = PROVIDER_PRIORITY.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = PROVIDER_PRIORITY.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (priorityA !== priorityB) return priorityA - priorityB;
    if (a.modelCount !== b.modelCount) return b.modelCount - a.modelCount;
    return a.name.localeCompare(b.name, 'en');
  });
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchScore(model: LlmModel, query: string): number {
  if (!query) return 1;

  const displayName = normalizeSearchValue(model.displayName);
  const modelId = normalizeSearchValue(model.model);
  const id = normalizeSearchValue(model.id);
  const haystack = `${displayName} ${modelId} ${id} ${normalizeSearchValue(model.provider)}`;
  const tokens = query.split(' ').filter(Boolean);

  if (!tokens.every((token) => haystack.includes(token))) return 0;
  if (displayName.startsWith(query) || modelId.startsWith(query)) return 3;
  if (modelId.includes(query) || displayName.includes(query)) return 2;
  return 1;
}

/**
 * Search by display name or model ID. Multiple words must all match, which
 * keeps provider-specific searches useful for very large catalogs.
 */
export function searchModels(models: LlmModel[], query: string): LlmModel[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return models;

  return models
    .map((model) => ({ model, score: searchScore(model, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.model.displayName.localeCompare(b.model.displayName, 'en') ||
        a.model.id.localeCompare(b.model.id, 'en')
    )
    .map((entry) => entry.model);
}

export function filterModels(
  models: LlmModel[],
  providerId: string | null,
  query: string
): LlmModel[] {
  const providerModels =
    providerId === null ? models : models.filter((model) => model.providerId === providerId);
  return searchModels(providerModels, query);
}

export function resolvePopularModels(
  models: LlmModel[],
  config: PopularModelConfig[] = POPULAR_MODELS
): ResolvedPopularModel[] {
  const byId = new Map(models.map((model) => [model.id, model]));

  return config.flatMap((entry) => {
    const model = byId.get(entry.id);
    if (!model) return [];
    return [{ model, label: entry.label?.trim() || model.displayName }];
  });
}

export function getMissingPopularModelIds(
  models: LlmModel[],
  config: PopularModelConfig[] = POPULAR_MODELS
): string[] {
  const ids = new Set(models.map((model) => model.id));
  return config.filter((entry) => !ids.has(entry.id)).map((entry) => entry.id);
}

/**
 * Pick a sensible starting model: the first available popular model, otherwise
 * the shortest canonical-looking ID in the provider. Used initially and when
 * switching providers.
 */
export function pickDefaultModel(
  models: LlmModel[],
  popularModels: ResolvedPopularModel[],
  providerId?: string
): LlmModel | null {
  const pool = providerId
    ? models.filter((model) => model.providerId === providerId)
    : models;

  if (pool.length === 0) return null;

  const poolIds = new Set(pool.map((model) => model.id));
  const popularMatch = popularModels.find((entry) => poolIds.has(entry.model.id));
  if (popularMatch) return popularMatch.model;

  return [...pool].sort(
    (a, b) =>
      a.model.length - b.model.length ||
      a.displayName.localeCompare(b.displayName, 'en') ||
      a.id.localeCompare(b.id, 'en')
  )[0];
}

/**
 * Formats the catalog's ISO `fetchedAt` timestamp using the visitor's locale,
 * with a long month name so the date is unambiguous. Returns null when the
 * timestamp is missing or invalid rather than falling back to today's date.
 */
export function formatFetchedAt(
  value: string | null | undefined,
  locale?: string
): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function formatContextWindow(contextWindow: number | null | undefined): string | null {
  if (
    contextWindow === null ||
    contextWindow === undefined ||
    !Number.isFinite(contextWindow) ||
    contextWindow <= 0
  ) {
    return null;
  }

  const compact =
    contextWindow >= 1_000_000
      ? `${(contextWindow / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
      : contextWindow >= 1_000
        ? `${(contextWindow / 1_000).toFixed(1).replace(/\.0$/, '')}K`
        : String(contextWindow);

  return `${compact} tokens (${contextWindow.toLocaleString('en-US')})`;
}
