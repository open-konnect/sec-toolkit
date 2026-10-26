import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { LlmModel } from '../types';
import { searchModels } from '../logic/catalog';
import { formatRatePerMillion } from '../logic/tokenCalculator';

const MAX_VISIBLE_OPTIONS = 100;

export interface ModelComboboxProps {
  id: string;
  models: LlmModel[];
  selectedModel: LlmModel | null;
  providerName: string;
  onSelect: (model: LlmModel) => void;
}

/**
 * Accessible, dependency-free searchable model selector. The option list is
 * capped so a provider with hundreds of models never renders an unbounded DOM.
 */
export const ModelCombobox: React.FC<ModelComboboxProps> = ({
  id,
  models,
  selectedModel,
  providerName,
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const listboxId = `${id}-listbox`;
  const filteredModels = useMemo(() => searchModels(models, query), [models, query]);
  const visibleModels = useMemo(
    () => filteredModels.slice(0, MAX_VISIBLE_OPTIONS),
    [filteredModels]
  );

  useEffect(() => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }, [models]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeOption = document.getElementById(`${id}-option-${activeIndex}`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, id, open]);

  const selectModel = (model: LlmModel) => {
    onSelect(model);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const moveActive = (direction: 1 | -1) => {
    if (!open) {
      setOpen(true);
      setActiveIndex(visibleModels.length > 0 ? 0 : -1);
      return;
    }

    if (visibleModels.length === 0) return;

    setActiveIndex((current) => {
      if (current < 0) return direction > 0 ? 0 : visibleModels.length - 1;
      return (current + direction + visibleModels.length) % visibleModels.length;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        if (open && visibleModels.length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open && visibleModels.length > 0) {
          event.preventDefault();
          setActiveIndex(visibleModels.length - 1);
        }
        break;
      case 'Enter':
        if (open && activeIndex >= 0 && visibleModels[activeIndex]) {
          event.preventDefault();
          selectModel(visibleModels[activeIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  const activeOptionId =
    open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={`Search ${providerName} models...`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-16 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear model search"
            onClick={() => {
              setQuery('');
              setOpen(true);
              setActiveIndex(0);
            }}
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={open ? 'Close model list' : 'Open model list'}
          onClick={() => {
            setOpen((current) => !current);
            setActiveIndex(0);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <p className="mt-1 truncate text-[11px] text-slate-500">
        {selectedModel ? (
          <>
            Selected: <span className="text-slate-300">{selectedModel.displayName}</span>
          </>
        ) : (
          'No model selected'
        )}
      </p>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${providerName} models`}
            className="max-h-72 overflow-y-auto py-1"
          >
            {visibleModels.length === 0 ? (
              <li className="px-3 py-4 text-xs text-slate-400">
                {models.length === 0
                  ? 'No models are available for this provider.'
                  : `No models match “${query}”. Try a different name or model ID.`}
              </li>
            ) : (
              visibleModels.map((model, index) => {
                const selected = selectedModel?.id === model.id;

                return (
                  <li
                    key={model.id}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectModel(model)}
                    className={`flex cursor-pointer items-start justify-between gap-3 px-3 py-2 ${
                      index === activeIndex ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                        <span className="truncate">{model.displayName}</span>
                        {selected && (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        {model.model}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[10px] text-slate-400">
                      {model.inputCostPerToken === null
                        ? 'Input n/a'
                        : `${formatRatePerMillion(model.inputCostPerToken)} in`}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
            {filteredModels.length === 0
              ? 'No matching models'
              : `Showing ${visibleModels.length} of ${filteredModels.length} model${
                  filteredModels.length === 1 ? '' : 's'
                }${filteredModels.length > visibleModels.length ? ' — keep typing to narrow the list' : ''}`}
          </div>
        </div>
      )}
    </div>
  );
};
