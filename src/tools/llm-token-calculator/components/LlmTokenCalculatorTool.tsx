import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Cpu,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PrivacyNotice } from '../../../components/ui/PrivacyNotice';
import { analytics } from '../../../lib/analytics';
import { ModelCombobox } from './ModelCombobox';
import {
  filterModels,
  formatContextWindow,
  formatFetchedAt,
  getProviderOptions,
  loadLlmCatalog,
  pickDefaultModel,
  resolvePopularModels
} from '../logic/catalog';
import {
  calculateInteractionEstimate,
  formatRatePerMillion,
  formatTokenCount,
  formatUsd
} from '../logic/tokenCalculator';
import type {
  LlmCatalog,
  LlmModel,
  ResolvedPopularModel,
  TextTokenEstimate
} from '../types';

const DEFAULT_REQUESTS_PER_DAY = 100;

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function CatalogMeta({
  catalog,
  providerCount
}: {
  catalog: LlmCatalog;
  providerCount: number;
}) {
  const updatedDate = formatFetchedAt(catalog.fetchedAt);
  const sourceUrl =
    catalog.sourceUrl ||
    'https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json';

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CalendarDays className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        <span className="text-slate-400">Pricing data</span>
        <span className="font-semibold text-slate-200">
          {updatedDate ? `Updated on ${updatedDate}` : 'Update date unavailable'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>
          Source:{' '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-300 underline decoration-emerald-700 underline-offset-2 hover:text-emerald-200"
          >
            {catalog.source}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </span>
        <span className="hidden sm:inline text-slate-600" aria-hidden="true">
          •
        </span>
        <span>
          {formatTokenCount(catalog.models.length)} models · {providerCount} providers
        </span>
      </div>
    </div>
  );
}

function PopularModels({
  models,
  selectedModelId,
  onSelect
}: {
  models: ResolvedPopularModel[];
  selectedModelId: string | null;
  onSelect: (model: LlmModel) => void;
}) {
  if (models.length === 0) return null;

  return (
    <section
      aria-labelledby="popular-models-heading"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        <h2 id="popular-models-heading" className="text-sm font-semibold text-white">
          Popular Models
        </h2>
        <span className="text-[11px] text-slate-500">Quick picks from the current catalog</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {models.map(({ model, label }) => {
          const selected = selectedModelId === model.id;
          const pricingUnavailable =
            model.inputCostPerToken === null && model.outputCostPerToken === null;

          return (
            <button
              key={model.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(model)}
              className={`rounded-lg border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                selected
                  ? 'border-emerald-500 bg-emerald-950/40 shadow-sm shadow-emerald-950/30'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{label}</span>
                  <span className="block truncate text-[10px] font-mono text-slate-400">
                    {model.provider}
                  </span>
                </div>
                {selected ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Cpu className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono text-slate-400">
                {model.inputCostPerToken !== null && (
                  <span>{formatRatePerMillion(model.inputCostPerToken)} in</span>
                )}
                {model.outputCostPerToken !== null && (
                  <span>{formatRatePerMillion(model.outputCostPerToken)} out</span>
                )}
                {pricingUnavailable && <span>Pricing unavailable</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-xs font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function SelectedModelSummary({ model }: { model: LlmModel }) {
  const contextWindow = formatContextWindow(model.contextWindow);

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Selected model
          </span>
          <h3 className="truncate text-base font-semibold text-white">{model.displayName}</h3>
          <p className="break-all font-mono text-[10px] text-slate-500">{model.id}</p>
        </div>
        <Badge variant="info">{model.provider}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Detail
          label="Input"
          value={
            model.inputCostPerToken === null
              ? 'Pricing unavailable'
              : `${formatRatePerMillion(model.inputCostPerToken)} / 1M tokens`
          }
        />
        <Detail
          label="Output"
          value={
            model.outputCostPerToken === null
              ? 'Pricing unavailable'
              : `${formatRatePerMillion(model.outputCostPerToken)} / 1M tokens`
          }
        />
        {contextWindow && <Detail label="Context window" value={contextWindow} />}
        {model.cacheReadInputCostPerToken !== null && (
          <Detail
            label="Cached input"
            value={`${formatRatePerMillion(model.cacheReadInputCostPerToken)} / 1M tokens`}
          />
        )}
        {model.cacheCreationInputCostPerToken !== null && (
          <Detail
            label="Cache write"
            value={`${formatRatePerMillion(model.cacheCreationInputCostPerToken)} / 1M tokens`}
          />
        )}
      </dl>
    </div>
  );
}

function TextSampleField({
  id,
  label,
  helper,
  placeholder,
  value,
  estimate,
  onChange
}: {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  estimate: TextTokenEstimate;
  onChange: (value: string) => void;
}) {
  const helperId = `${id}-help`;
  const countId = `${id}-count`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <label
            htmlFor={id}
            className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300"
          >
            {label}
          </label>
          <p id={helperId} className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {helper}
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-400">
          ≈ {formatTokenCount(estimate.tokens)} tokens
        </span>
      </div>

      <textarea
        id={id}
        rows={7}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        aria-describedby={`${helperId} ${countId}`}
        className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      <p id={countId} className="mt-2 text-[11px] text-slate-500">
        {formatTokenCount(estimate.characters)} characters ·{' '}
        {formatTokenCount(estimate.words)} words · ≈ {formatTokenCount(estimate.tokens)} tokens
      </p>
    </div>
  );
}

function CostCard({
  label,
  value,
  accent = false
}: {
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <span
        className={`block text-[10px] font-mono uppercase tracking-wider ${
          accent ? 'text-emerald-400' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 block font-mono font-bold ${
          accent ? 'text-2xl text-emerald-300' : 'text-xl text-white'
        }`}
      >
        {value === null ? 'Pricing unavailable' : formatUsd(value)}
      </span>
    </div>
  );
}

export const LlmTokenCalculatorTool: React.FC = () => {
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [requestsPerDay, setRequestsPerDay] = useState(DEFAULT_REQUESTS_PER_DAY);
  const [cachedInputEnabled, setCachedInputEnabled] = useState(false);
  const [cachedInputTokens, setCachedInputTokens] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setCatalog(null);
    setCatalogError(null);

    loadLlmCatalog()
      .then((loadedCatalog) => {
        if (!cancelled) setCatalog(loadedCatalog);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCatalogError(
          error instanceof Error ? error.message : 'An unexpected error occurred while loading pricing data.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const popularModels = useMemo(
    () => (catalog ? resolvePopularModels(catalog.models) : []),
    [catalog]
  );

  const defaultModel = useMemo(
    () => (catalog ? pickDefaultModel(catalog.models, popularModels) : null),
    [catalog, popularModels]
  );

  const selectedModel = useMemo(() => {
    if (!catalog) return null;
    return catalog.models.find((model) => model.id === selectedModelId) ?? defaultModel;
  }, [catalog, defaultModel, selectedModelId]);

  const providerOptions = useMemo(
    () => (catalog ? getProviderOptions(catalog.models) : []),
    [catalog]
  );

  const providerModels = useMemo(() => {
    if (!catalog || !selectedModel) return [];
    return filterModels(catalog.models, selectedModel.providerId, '');
  }, [catalog, selectedModel]);

  const cacheReadRate = selectedModel?.cacheReadInputCostPerToken ?? null;
  const hasCachedPricing = cacheReadRate !== null;
  const effectiveCachedTokens =
    cachedInputEnabled && hasCachedPricing ? cachedInputTokens : 0;

  const interaction = useMemo(
    () =>
      calculateInteractionEstimate({
        inputText,
        outputText,
        cachedInputTokens: effectiveCachedTokens,
        inputCostPerToken: selectedModel?.inputCostPerToken ?? null,
        outputCostPerToken: selectedModel?.outputCostPerToken ?? null,
        cacheReadInputCostPerToken: cacheReadRate,
        requestsPerDay
      }),
    [
      cacheReadRate,
      effectiveCachedTokens,
      inputText,
      outputText,
      requestsPerDay,
      selectedModel?.inputCostPerToken,
      selectedModel?.outputCostPerToken
    ]
  );

  const cost = interaction.cost;
  const periodEstimate = interaction.periodCost;
  const bothTextFieldsEmpty =
    interaction.input.characters === 0 && interaction.output.characters === 0;

  const resetCachedInput = () => {
    setCachedInputEnabled(false);
    setCachedInputTokens(0);
  };

  const handlePopularSelect = (model: LlmModel) => {
    setSelectedModelId(model.id);
    resetCachedInput();
    analytics.track('tool_used', {
      tool: 'llm-token-calculator',
      action: 'select_popular_model'
    });
  };

  const handleModelSelect = (model: LlmModel) => {
    setSelectedModelId(model.id);
    resetCachedInput();
    analytics.track('tool_used', {
      tool: 'llm-token-calculator',
      action: 'select_model'
    });
  };

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!catalog) return;

    const nextProviderId = event.target.value;
    const nextModel = pickDefaultModel(catalog.models, popularModels, nextProviderId);
    setSelectedModelId(nextModel?.id ?? null);
    resetCachedInput();
  };

  if (catalogError) {
    return (
      <div className="space-y-6">
        <PrivacyNotice />
        <div
          role="alert"
          className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-5"
        >
          <h2 className="text-sm font-semibold text-rose-200">
            Could not load the model pricing catalog
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-rose-100/90">{catalogError}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            The calculator needs <code className="font-mono text-rose-200">/data/llm-models.json</code>{' '}
            from this static site. No prompts or token counts were sent anywhere.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!catalog || !selectedModel) {
    return (
      <div className="space-y-6">
        <PrivacyNotice />
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center"
        >
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-200">Loading the model pricing catalog…</span>
          <p className="max-w-md text-xs leading-relaxed text-slate-400">
            Fetching the generated local dataset once. All cost calculations still run in your
            browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PrivacyNotice />

      <CatalogMeta catalog={catalog} providerCount={providerOptions.length} />

      <PopularModels
        models={popularModels}
        selectedModelId={selectedModel.id}
        onSelect={handlePopularSelect}
      />

      <section
        aria-labelledby="model-selection-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="model-selection-heading" className="text-sm font-semibold text-white">
              Or select a model
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose a provider, then search its catalog by display name or model ID.
            </p>
          </div>
          <span className="font-mono text-[10px] text-slate-500">
            {formatTokenCount(catalog.models.length)} models · {providerOptions.length} providers
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="llm-provider"
              className="mb-1 block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300"
            >
              Provider
            </label>
            <select
              id="llm-provider"
              value={selectedModel.providerId}
              onChange={handleProviderChange}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.modelCount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="llm-model-search"
              className="mb-1 block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300"
            >
              Model
            </label>
            <ModelCombobox
              id="llm-model-search"
              models={providerModels}
              selectedModel={selectedModel}
              providerName={selectedModel.provider}
              onSelect={handleModelSelect}
            />
          </div>
        </div>

        <SelectedModelSummary model={selectedModel} />
      </section>

      <section aria-labelledby="token-calculator-heading" className="space-y-4">
        <div>
          <h2 id="token-calculator-heading" className="text-sm font-semibold text-white">
            Estimate tokens from real text
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Paste the prompt you sent and a sample response you received. Both sides are measured
            directly in your browser, so you do not need to predict output length.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextSampleField
            id="llm-input-text"
            label="Input / Prompt"
            helper="Paste the prompt or input you sent to the LLM."
            placeholder="Paste your prompt here..."
            value={inputText}
            estimate={interaction.input}
            onChange={setInputText}
          />
          <TextSampleField
            id="llm-output-text"
            label="Sample Output"
            helper="Paste the response you received from the LLM."
            placeholder="Paste the LLM response here..."
            value={outputText}
            estimate={interaction.output}
            onChange={setOutputText}
          />
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Your prompt and response stay in your browser. Nothing is sent to a server, tokenizer
          API, LiteLLM, or any AI provider.
        </p>

        {bothTextFieldsEmpty && (
          <p
            role="status"
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400"
          >
            Paste a prompt, a sample response, or both to estimate token usage and cost. You do not
            need to fill in both fields.
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Estimated token usage for the supplied prompt and sample response
            </caption>
            <thead className="bg-slate-950/70 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Token usage
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Characters
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Words
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Estimated tokens
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <th scope="row" className="px-4 py-2.5 font-medium text-slate-200">
                  Input
                </th>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  {formatTokenCount(interaction.input.characters)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  {formatTokenCount(interaction.input.words)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">
                  {formatTokenCount(interaction.input.tokens)}
                </td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-2.5 font-medium text-slate-200">
                  Output
                </th>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  {formatTokenCount(interaction.output.characters)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  {formatTokenCount(interaction.output.words)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">
                  {formatTokenCount(interaction.output.tokens)}
                </td>
              </tr>
              <tr className="bg-slate-950/40">
                <th scope="row" className="px-4 py-2.5 font-semibold text-white">
                  Total
                </th>
                <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                  {formatTokenCount(interaction.totalCharacters)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                  {formatTokenCount(interaction.input.words + interaction.output.words)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-300">
                  {formatTokenCount(interaction.totalTokens)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Estimated token count. Actual token usage may differ because tokenization varies by model
          and provider. The local heuristic blends roughly 3.9 characters per token with 1.33 tokens
          per word; it is not a model-specific tokenizer.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <label
              htmlFor="llm-requests-per-day"
              className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300"
            >
              Requests per day
            </label>
            <input
              id="llm-requests-per-day"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={requestsPerDay}
              onChange={(event) => setRequestsPerDay(parseNonNegativeInteger(event.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-lg font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Used only for the estimated daily and 30-day totals below.
            </p>
          </div>

          {hasCachedPricing ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="flex items-start gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                <input
                  type="checkbox"
                  checked={cachedInputEnabled}
                  onChange={(event) => {
                    setCachedInputEnabled(event.target.checked);
                    if (!event.target.checked) setCachedInputTokens(0);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Cached input</span>
              </label>

              {cachedInputEnabled ? (
                <div className="mt-2 space-y-1.5">
                  <label htmlFor="llm-cached-input-tokens" className="text-[11px] text-slate-400">
                    Cached input tokens
                  </label>
                  <input
                    id="llm-cached-input-tokens"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={cachedInputTokens}
                    onChange={(event) =>
                      setCachedInputTokens(parseNonNegativeInteger(event.target.value))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Billed at {formatRatePerMillion(cacheReadRate)} / 1M cached tokens. Cached
                    tokens are counted as part of the estimated input tokens above.
                  </p>
                  {cachedInputTokens > interaction.input.tokens && (
                    <p className="text-[11px] text-amber-300">
                      Cached tokens exceed the estimated input token count; the calculation uses
                      only the input amount.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  This model lists cached-input pricing at {formatRatePerMillion(cacheReadRate)} / 1M
                  tokens. Enable it to split cached and uncached input tokens.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                Cached input
              </span>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                This model does not publish cached-input pricing in the catalog, so the calculator
                does not estimate a cached rate for it.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <CostCard label="Estimated input cost" value={cost.inputCost} />
          <CostCard label="Estimated output cost" value={cost.outputCost} />
          <CostCard label="Estimated total per request" value={cost.totalCost} accent />
        </div>

        {cost.cachedInputTokens > 0 && cost.cachedInputCost !== null && (
          <p className="text-[11px] text-slate-400">
            Cached input: {formatTokenCount(cost.cachedInputTokens)} tokens at{' '}
            {formatUsd(cost.cachedInputCost)}; uncached input:{' '}
            {formatTokenCount(cost.uncachedInputTokens)} tokens.
          </p>
        )}

        {cost.totalCost === null && (
          <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
            One or more prices needed for this calculation are unavailable in the catalog. The
            affected cost is left blank rather than treating a missing price as $0.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <CostCard
            label={`Estimated daily cost (${formatTokenCount(requestsPerDay)} requests)`}
            value={periodEstimate.dailyCost}
          />
          <CostCard label="Estimated monthly cost (30 days)" value={periodEstimate.monthlyCost} />
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          At {formatTokenCount(requestsPerDay)}{' '}
          {requestsPerDay === 1 ? 'request' : 'requests'} per day:{' '}
          {formatTokenCount(interaction.periodTokens.dailyInputTokens)} input +{' '}
          {formatTokenCount(interaction.periodTokens.dailyOutputTokens)} output ={' '}
          {formatTokenCount(interaction.periodTokens.dailyTotalTokens)} tokens/day;{' '}
          {formatTokenCount(interaction.periodTokens.monthlyTotalTokens)} tokens over 30 days.
        </p>
      </section>

      <section
        aria-labelledby="estimate-explanation-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <h2 id="estimate-explanation-heading" className="text-sm font-semibold text-white">
          How this estimate works
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-slate-200">What is being estimated?</dt>
            <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">
              The token counts come from your actual prompt and sample response, measured locally.
              The selected model&apos;s catalog prices then turn those counts into input, output,
              and total cost estimates.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-200">
              Why use a sample response?
            </dt>
            <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Analyzing the response you actually received is more useful than guessing how long a
              future response might be. The calculator never predicts output length from the prompt.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-200">Are the token counts exact?</dt>
            <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">
              No. Unless a model-specific tokenizer is used, the counts are approximate. Different
              models and providers can tokenize the same text into different numbers of tokens.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-200">Why can billing differ?</dt>
            <dd className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Provider bills can include system messages, conversation history, cached tokens,
              reasoning tokens, tool calls, multimodal inputs, and provider-specific billing rules
              beyond the visible prompt and response.
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Pricing is provided for estimation purposes and may differ from actual provider billing.
        This is not an official billing calculator for OpenAI, Anthropic, Google, or any other
        provider. Actual invoices can include cache writes, batch or priority tiers, long-context
        rates, tool charges, negotiated discounts, and taxes.
      </p>
    </div>
  );
};
