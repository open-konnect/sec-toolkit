import popularModelsConfig from './popularModels.json';
import type { PopularModelConfig } from '../tools/llm-token-calculator/types';

/**
 * Quick-pick models shown above the provider selector.
 *
 * Edit `popularModels.json` to change this list. Every ID must match an `id`
 * in `public/data/llm-models.json`. The build-time fetch script validates the
 * IDs, warns about missing entries, and the UI omits anything it cannot find.
 */
export const POPULAR_MODELS: PopularModelConfig[] = popularModelsConfig;
