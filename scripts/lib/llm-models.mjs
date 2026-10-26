/**
 * Shared, dependency-free normalization helpers for the build-time LLM pricing
 * catalog. This module is intentionally plain Node ESM so the fetch script and
 * the Vitest suite can exercise the exact same logic without installing
 * LiteLLM or touching the network.
 */

export const LLM_CATALOG_SCHEMA_VERSION = 1;

export const LLM_SOURCE_NAME = 'LiteLLM model cost map';
export const LLM_SOURCE_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
export const LLM_SOURCE_LINK =
  'https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json';

/** Modes that can be billed with ordinary input/output token pricing. */
export const TEXT_MODEL_MODES = new Set(['chat', 'completion', 'responses']);

/**
 * Provider aliases kept deliberately small: a readable identity for providers
 * that appear frequently, plus prefix rules for families such as vertex_ai-*.
 * Anything not listed is still imported with a humanized name and slugged ID.
 */
const PROVIDER_ALIASES = new Map([
  ['openai', { id: 'openai', name: 'OpenAI' }],
  ['text-completion-openai', { id: 'openai', name: 'OpenAI' }],
  ['chatgpt', { id: 'openai', name: 'OpenAI' }],
  ['anthropic', { id: 'anthropic', name: 'Anthropic' }],
  ['google', { id: 'google', name: 'Google' }],
  ['gemini', { id: 'google', name: 'Google' }],
  ['deepseek', { id: 'deepseek', name: 'DeepSeek' }],
  ['mistral', { id: 'mistral', name: 'Mistral' }],
  ['codestral', { id: 'mistral', name: 'Mistral' }],
  ['text-completion-codestral', { id: 'mistral', name: 'Mistral' }],
  ['meta', { id: 'meta', name: 'Meta' }],
  ['meta_llama', { id: 'meta', name: 'Meta' }],
  ['xai', { id: 'xai', name: 'xAI' }],
  ['cohere', { id: 'cohere', name: 'Cohere' }],
  ['cohere_chat', { id: 'cohere', name: 'Cohere' }],
  ['groq', { id: 'groq', name: 'Groq' }],
  ['together_ai', { id: 'together-ai', name: 'Together AI' }],
  ['fireworks_ai', { id: 'fireworks-ai', name: 'Fireworks AI' }],
  ['deepinfra', { id: 'deepinfra', name: 'DeepInfra' }],
  ['aihubmix', { id: 'aihubmix', name: 'AIHubMix' }],
  ['cerebras', { id: 'cerebras', name: 'Cerebras' }],
  ['cloudflare', { id: 'cloudflare', name: 'Cloudflare' }],
  ['coralbricks', { id: 'coralbricks', name: 'CoralBricks' }],
  ['databricks', { id: 'databricks', name: 'Databricks' }],
  ['anyscale', { id: 'anyscale', name: 'Anyscale' }],
  ['baseten', { id: 'baseten', name: 'Baseten' }],
  ['friendliai', { id: 'friendliai', name: 'FriendliAI' }],
  ['github_copilot', { id: 'github-copilot', name: 'GitHub Copilot' }],
  ['gmi', { id: 'gmi', name: 'GMI' }],
  ['hyperbolic', { id: 'hyperbolic', name: 'Hyperbolic' }],
  ['inferenceapis', { id: 'inferenceapis', name: 'Inference APIs' }],
  ['lambda_ai', { id: 'lambda-ai', name: 'Lambda' }],
  ['microsoft_365_copilot', { id: 'microsoft-365-copilot', name: 'Microsoft 365 Copilot' }],
  ['minimax', { id: 'minimax', name: 'MiniMax' }],
  ['moonshot', { id: 'moonshot', name: 'Moonshot AI' }],
  ['nebius', { id: 'nebius', name: 'Nebius' }],
  ['nlp_cloud', { id: 'nlp-cloud', name: 'NLP Cloud' }],
  ['novita', { id: 'novita', name: 'Novita AI' }],
  ['nvidia_nim', { id: 'nvidia-nim', name: 'NVIDIA NIM' }],
  ['oci', { id: 'oci', name: 'Oracle Cloud' }],
  ['ollama', { id: 'ollama', name: 'Ollama' }],
  ['ovhcloud', { id: 'ovhcloud', name: 'OVHcloud' }],
  ['perplexity', { id: 'perplexity', name: 'Perplexity' }],
  ['publicai', { id: 'publicai', name: 'PublicAI' }],
  ['replicate', { id: 'replicate', name: 'Replicate' }],
  ['sagemaker', { id: 'sagemaker', name: 'SageMaker' }],
  ['sambanova', { id: 'sambanova', name: 'SambaNova' }],
  ['scaleway', { id: 'scaleway', name: 'Scaleway' }],
  ['scx-ai', { id: 'scx-ai', name: 'SCX AI' }],
  ['snowflake', { id: 'snowflake', name: 'Snowflake' }],
  ['vercel_ai_gateway', { id: 'vercel-ai-gateway', name: 'Vercel AI Gateway' }],
  ['v0', { id: 'v0', name: 'v0' }],
  ['watsonx', { id: 'watsonx', name: 'IBM watsonx' }],
  ['zai', { id: 'zai', name: 'Z.ai' }],
  ['dashscope', { id: 'dashscope', name: 'Alibaba DashScope' }],
  ['qwencloud', { id: 'qwencloud', name: 'Qwen Cloud' }],
  ['qwen_ai_platform', { id: 'qwen-ai-platform', name: 'Qwen AI Platform' }],
  ['volcengine', { id: 'volcengine', name: 'Volcengine' }]
]);

const PROVIDER_PREFIX_ALIASES = [
  [/^vertex_ai(?:$|[-_])/, { id: 'google', name: 'Google' }],
  [/^azure(?:$|[-_])/, { id: 'azure', name: 'Microsoft Azure' }],
  [/^bedrock(?:$|[-_])/, { id: 'amazon-bedrock', name: 'Amazon Bedrock' }],
  [/^fireworks_ai(?:$|[-_])/, { id: 'fireworks-ai', name: 'Fireworks AI' }]
];

/** Roots used to strip an API-route prefix from a raw model key. */
const MODEL_PREFIX_ROOTS = new Set([
  'openai',
  'anthropic',
  'google',
  'gemini',
  'vertex_ai',
  'deepseek',
  'mistral',
  'meta',
  'xai',
  'cohere',
  'together_ai',
  'groq',
  'azure',
  'azure_ai',
  'bedrock',
  'fireworks_ai',
  'deepinfra',
  'cerebras',
  'cloudflare',
  'databricks',
  'anyscale'
]);

const MODEL_ACRONYMS = new Map([
  ['ai', 'AI'],
  ['ai21', 'AI21'],
  ['api', 'API'],
  ['deepseek', 'DeepSeek'],
  ['gpt', 'GPT'],
  ['llm', 'LLM'],
  ['glm', 'GLM'],
  ['ocr', 'OCR'],
  ['openai', 'OpenAI'],
  ['tts', 'TTS'],
  ['vl', 'VL'],
  ['moe', 'MoE'],
  ['gguf', 'GGUF'],
  ['xai', 'xAI']
]);

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return asTrimmedString(value).toLowerCase();
}

export function humanizeProviderName(value) {
  const cleaned = asTrimmedString(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!cleaned) return 'Unknown provider';

  return cleaned
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (MODEL_ACRONYMS.has(lower)) return MODEL_ACRONYMS.get(lower);
      if (/^\d/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

/**
 * Convert upstream provider identifiers into a stable ID plus a readable name.
 * Known aliases are normalized; unknown providers are still supported.
 */
export function normalizeProvider(rawProvider) {
  const key = normalizeKey(rawProvider);
  if (!key) return null;

  const alias = PROVIDER_ALIASES.get(key);
  if (alias) return { ...alias };

  for (const [pattern, mapped] of PROVIDER_PREFIX_ALIASES) {
    if (pattern.test(key)) return { ...mapped };
  }

  if (key.startsWith('text-completion-')) {
    const base = key.slice('text-completion-'.length);
    const id = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (id) return { id, name: humanizeProviderName(base) };
  }

  const id = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) return null;

  return { id, name: humanizeProviderName(key) };
}

/**
 * Turn a raw model key into a human-friendly label while preserving version
 * numbers and common acronyms.
 */
export function humanizeModelName(modelId) {
  const cleaned = asTrimmedString(modelId).replace(/[_:]+/g, '-').replace(/\//g, ' ');
  if (!cleaned) return 'Unknown model';

  // Keep version and date fragments readable instead of splitting every hyphen:
  // claude-sonnet-4-5 -> 4.5, gpt-4o-2024-08-06 -> 2024/08/06,
  // command-a-03-2025 -> 03/2025.
  const versioned = cleaned
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$1/$2/$3')
    .replace(/(^|[^\d])(\d{2})-(\d{4})(?!\d)/g, '$1$2/$3')
    .replace(/(^|[^\d])(\d)-(\d)(?!\d)/g, '$1$2.$3');

  const words = versioned
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (MODEL_ACRONYMS.has(lower)) return MODEL_ACRONYMS.get(lower);
      if (/^\d/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .filter((word, index, all) => index === 0 || word.toLowerCase() !== all[index - 1].toLowerCase());

  return words.join(' ').replace(/^GPT (?=\d)/, 'GPT-');
}

function stripModelPrefix(upstreamKey, rawProvider, providerId) {
  const prefixes = new Set([normalizeKey(rawProvider), normalizeKey(providerId)]);

  for (const root of MODEL_PREFIX_ROOTS) {
    if (prefixes.has(root) || normalizeKey(rawProvider).startsWith(`${root}_`)) {
      prefixes.add(root);
    }
  }

  let model = upstreamKey;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (prefix && model.toLowerCase().startsWith(`${prefix}/`)) {
        model = model.slice(prefix.length + 1);
        changed = true;
        break;
      }
    }
  }

  return model || upstreamKey;
}

/** Missing or malformed prices become null; zero is preserved as a real price. */
export function normalizePrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function normalizeContextWindow(raw) {
  const candidates = [raw.max_input_tokens, raw.max_tokens, raw.max_output_tokens];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      candidate > 0 &&
      Number.isInteger(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Normalize one LiteLLM entry. Returns null for non-text, malformed, or
 * completely unpriced entries.
 */
export function normalizeModelEntry(upstreamKey, raw) {
  if (!upstreamKey || upstreamKey === 'sample_spec') return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const mode = normalizeKey(raw.mode);
  if (!TEXT_MODEL_MODES.has(mode)) return null;

  const provider = normalizeProvider(raw.litellm_provider);
  if (!provider) return null;

  const inputCostPerToken = normalizePrice(raw.input_cost_per_token);
  const outputCostPerToken = normalizePrice(raw.output_cost_per_token);
  if (inputCostPerToken === null && outputCostPerToken === null) return null;

  const model = stripModelPrefix(upstreamKey, raw.litellm_provider, provider.id);
  const displayName = humanizeModelName(model);

  return {
    id: `${provider.id}/${model}`,
    providerId: provider.id,
    provider: provider.name,
    model,
    displayName,
    inputCostPerToken,
    outputCostPerToken,
    cacheReadInputCostPerToken: normalizePrice(raw.cache_read_input_token_cost),
    cacheCreationInputCostPerToken: normalizePrice(raw.cache_creation_input_token_cost),
    contextWindow: normalizeContextWindow(raw),
    mode,
    upstreamKey
  };
}

function completenessScore(model) {
  return (
    (model.cacheReadInputCostPerToken !== null ? 4 : 0) +
    (model.cacheCreationInputCostPerToken !== null ? 2 : 0) +
    (model.contextWindow !== null ? 1 : 0)
  );
}

function compareCandidates(a, b) {
  const scoreDifference = completenessScore(b) - completenessScore(a);
  if (scoreDifference !== 0) return scoreDifference;

  const lengthDifference = a.upstreamKey.length - b.upstreamKey.length;
  if (lengthDifference !== 0) return lengthDifference;

  return a.upstreamKey.localeCompare(b.upstreamKey);
}

function modelFingerprint(model) {
  return [
    model.providerId,
    model.model,
    model.inputCostPerToken,
    model.outputCostPerToken,
    model.cacheReadInputCostPerToken,
    model.cacheCreationInputCostPerToken,
    model.contextWindow
  ].join('|');
}

/**
 * Deduplicate exact upstream aliases (for example `gemini/gemini-2.5-pro` and
 * `gemini-2.5-pro`). Entries that share an ID but differ in pricing or context
 * are kept with a disambiguated ID rather than silently dropping a variant.
 */
export function dedupeModels(models) {
  const byFingerprint = new Map();

  for (const model of models) {
    const fingerprint = modelFingerprint(model);
    const existing = byFingerprint.get(fingerprint);

    if (!existing || compareCandidates(model, existing) < 0) {
      byFingerprint.set(fingerprint, model);
    }
  }

  const byId = new Map();
  for (const model of byFingerprint.values()) {
    const group = byId.get(model.id) ?? [];
    group.push(model);
    byId.set(model.id, group);
  }

  const usedIds = new Set();
  const result = [];

  for (const [baseId, group] of byId) {
    group.sort(compareCandidates);

    group.forEach((model, index) => {
      let id = index === 0 ? baseId : `${model.providerId}/${model.upstreamKey}`;
      let suffix = 2;

      while (usedIds.has(id)) {
        id = `${model.providerId}/${model.upstreamKey}~${suffix}`;
        suffix += 1;
      }

      usedIds.add(id);
      result.push({
        id,
        providerId: model.providerId,
        provider: model.provider,
        model: model.model,
        displayName: model.displayName,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
        cacheReadInputCostPerToken: model.cacheReadInputCostPerToken,
        cacheCreationInputCostPerToken: model.cacheCreationInputCostPerToken,
        contextWindow: model.contextWindow,
        mode: model.mode
      });
    });
  }

  return result.sort(
    (a, b) =>
      a.provider.localeCompare(b.provider, 'en') ||
      a.displayName.localeCompare(b.displayName, 'en') ||
      a.id.localeCompare(b.id, 'en')
  );
}

/**
 * Build the final catalog from the raw upstream map. `fetchedAt` must be
 * supplied by the caller so the timestamp reflects a successful fetch.
 */
export function buildModelCatalog(upstreamData, options = {}) {
  if (!upstreamData || typeof upstreamData !== 'object' || Array.isArray(upstreamData)) {
    throw new Error('Upstream model data must be a JSON object keyed by model name.');
  }

  const entries = Object.entries(upstreamData);
  if (entries.length === 0) {
    throw new Error('Upstream model data is empty.');
  }

  const models = [];
  for (const [upstreamKey, raw] of entries) {
    const normalized = normalizeModelEntry(upstreamKey, raw);
    if (normalized) models.push(normalized);
  }

  const deduped = dedupeModels(models);

  return {
    schemaVersion: LLM_CATALOG_SCHEMA_VERSION,
    source: options.source ?? LLM_SOURCE_NAME,
    sourceUrl: options.sourceUrl ?? LLM_SOURCE_LINK,
    fetchedAt: options.fetchedAt,
    models: deduped
  };
}

function isNullablePrice(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

/** Validate a catalog read back from disk before keeping it as a fallback. */
export function isUsableCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return false;
  if (catalog.schemaVersion !== LLM_CATALOG_SCHEMA_VERSION) return false;
  if (typeof catalog.fetchedAt !== 'string' || !catalog.fetchedAt.trim()) return false;
  if (Number.isNaN(Date.parse(catalog.fetchedAt))) return false;
  if (!Array.isArray(catalog.models) || catalog.models.length === 0) return false;

  const ids = new Set();

  for (const model of catalog.models) {
    if (!model || typeof model !== 'object' || Array.isArray(model)) return false;
    if (typeof model.id !== 'string' || model.id.length === 0 || ids.has(model.id)) return false;
    if (typeof model.providerId !== 'string' || model.providerId.length === 0) return false;
    if (typeof model.provider !== 'string' || model.provider.length === 0) return false;
    if (typeof model.model !== 'string' || model.model.length === 0) return false;
    if (typeof model.displayName !== 'string' || model.displayName.length === 0) return false;
    if (!isNullablePrice(model.inputCostPerToken)) return false;
    if (!isNullablePrice(model.outputCostPerToken)) return false;
    if (model.inputCostPerToken === null && model.outputCostPerToken === null) return false;
    if (!isNullablePrice(model.cacheReadInputCostPerToken)) return false;
    if (!isNullablePrice(model.cacheCreationInputCostPerToken)) return false;
    if (
      model.contextWindow !== null &&
      (typeof model.contextWindow !== 'number' ||
        !Number.isFinite(model.contextWindow) ||
        model.contextWindow <= 0)
    ) {
      return false;
    }

    ids.add(model.id);
  }

  return true;
}

/** Return configured popular IDs that are absent from the refreshed catalog. */
export function findMissingPopularModels(models, popularConfig) {
  if (!Array.isArray(popularConfig)) return [];
  const ids = new Set(models.map((model) => model.id));

  return popularConfig
    .map((entry) => (entry && typeof entry === 'object' ? entry.id : null))
    .filter((id) => typeof id === 'string' && id.length > 0 && !ids.has(id));
}
