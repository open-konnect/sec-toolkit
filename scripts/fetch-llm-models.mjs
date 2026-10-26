#!/usr/bin/env node
/**
 * Refreshes the build-time LLM model and pricing catalog.
 *
 * Flow:
 *   LiteLLM public cost map -> fetch -> validate -> normalize -> dedupe
 *   -> public/data/llm-models.json
 *
 * The browser never calls LiteLLM. If a refresh fails, an existing valid
 * dataset is kept byte-for-byte so its `fetchedAt` date remains truthful.
 */

import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LLM_SOURCE_LINK,
  LLM_SOURCE_NAME,
  LLM_SOURCE_URL,
  buildModelCatalog,
  findMissingPopularModels,
  isUsableCatalog
} from './lib/llm-models.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = process.env.LLM_MODELS_OUTPUT_PATH
  ? path.resolve(process.env.LLM_MODELS_OUTPUT_PATH)
  : path.join(root, 'public', 'data', 'llm-models.json');
const popularConfigPath = process.env.LLM_MODELS_POPULAR_PATH
  ? path.resolve(process.env.LLM_MODELS_POPULAR_PATH)
  : path.join(root, 'src', 'data', 'popularModels.json');
const sourceUrl = process.env.LLM_MODELS_SOURCE_URL?.trim() || LLM_SOURCE_URL;
const tempPath = `${outputPath}.tmp`;

const FETCH_TIMEOUT_MS = Number(process.env.LLM_MODELS_FETCH_TIMEOUT_MS || 30_000);
const MINIMUM_USABLE_MODELS = 50;

function formatForMessage(value) {
  if (!value) return 'unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString()} (${date.toISOString().slice(0, 10)})`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPreviousCatalog() {
  if (!(await exists(outputPath))) return null;

  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8'));
    if (!isUsableCatalog(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readPopularConfig() {
  try {
    const parsed = JSON.parse(await readFile(popularConfigPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(
      `Warning: could not read popular model configuration at ${path.relative(root, popularConfigPath)}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

async function fetchUpstream() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'developer-security-toolkit-build'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    const body = await response.text();
    if (!body.trim()) {
      throw new Error('upstream returned an empty response body');
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      throw new Error(`upstream response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        `upstream JSON was not a model map (received ${
          Array.isArray(parsed) ? 'an array' : parsed === null ? 'null' : typeof parsed
        })`
      );
    }

    const entryCount = Object.keys(parsed).length;
    if (entryCount < MINIMUM_USABLE_MODELS) {
      throw new Error(
        `upstream JSON did not contain a usable model map (received ${entryCount} keys)`
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function keepPreviousCatalog(previous, reason) {
  console.warn('Warning: Unable to refresh LLM pricing data.');
  console.warn(`Reason: ${reason}`);
  console.warn(`Using the previous valid dataset from ${formatForMessage(previous.fetchedAt)}.`);
  console.warn(`Kept ${path.relative(root, outputPath)} unchanged.`);

  const popularConfig = await readPopularConfig();
  const missingPopular = findMissingPopularModels(previous.models, popularConfig);

  for (const id of missingPopular) {
    console.warn(
      `Warning: popular model "${id}" is not present in the kept dataset; it will be omitted from the Popular Models section.`
    );
  }

  if (popularConfig.length > 0) {
    const matched = popularConfig.length - missingPopular.length;
    console.warn(`Popular models validated against the kept dataset: ${matched}/${popularConfig.length} present.`);
  }
}

function reportCatalog(catalog, popularConfig) {
  const providers = new Set(catalog.models.map((model) => model.providerId));
  const missingPopular = findMissingPopularModels(catalog.models, popularConfig);

  console.log(`Normalized ${catalog.models.length} text models from ${providers.size} providers.`);
  console.log(`Catalog timestamp (fetchedAt): ${catalog.fetchedAt}`);

  for (const id of missingPopular) {
    console.warn(
      `Warning: popular model "${id}" is not present in the refreshed catalog; it will be omitted from the Popular Models section.`
    );
  }

  if (popularConfig.length > 0) {
    const matched = popularConfig.length - missingPopular.length;
    console.log(`Popular models validated: ${matched}/${popularConfig.length} present.`);
  }
}

async function main() {
  let upstream;
  try {
    upstream = await fetchUpstream();
  } catch (error) {
    const previous = await readPreviousCatalog();
    if (previous) {
      await keepPreviousCatalog(
        previous,
        `could not fetch ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    console.error('Error: Unable to refresh LLM pricing data, and no valid previous dataset was found.');
    console.error(`Upstream source: ${sourceUrl}`);
    console.error(`Expected local dataset: ${path.relative(root, outputPath)}`);
    console.error('');
    console.error('The build was stopped instead of producing an empty model catalog.');
    console.error('Check network access to raw.githubusercontent.com, then retry:');
    console.error('  npm run fetch:llm-models');
    console.error('  npm run build');
    process.exitCode = 1;
    return;
  }

  const fetchedAt = new Date().toISOString();
  let catalog;

  try {
    catalog = buildModelCatalog(upstream, {
      fetchedAt,
      source: LLM_SOURCE_NAME,
      sourceUrl: LLM_SOURCE_LINK
    });
  } catch (error) {
    const previous = await readPreviousCatalog();
    if (previous) {
      await keepPreviousCatalog(
        previous,
        `upstream data could not be normalized: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    console.error('Error: Unable to normalize LLM pricing data, and no valid previous dataset was found.');
    console.error(`Reason: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Expected local dataset: ${path.relative(root, outputPath)}`);
    console.error('Retry with: npm run fetch:llm-models');
    process.exitCode = 1;
    return;
  }

  if (catalog.models.length < MINIMUM_USABLE_MODELS) {
    const previous = await readPreviousCatalog();
    if (previous) {
      await keepPreviousCatalog(
        previous,
        `refreshed catalog contained only ${catalog.models.length} usable models`
      );
      return;
    }

    console.error(
      `Error: Refreshed catalog contained only ${catalog.models.length} usable models, which is too few to publish.`
    );
    console.error(`Expected local dataset: ${path.relative(root, outputPath)}`);
    console.error('The build was stopped instead of producing a mostly-empty model catalog.');
    process.exitCode = 1;
    return;
  }

  const popularConfig = await readPopularConfig();

  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(catalog)}\n`, 'utf8');
    await rename(tempPath, outputPath);
  } catch (error) {
    const previous = await readPreviousCatalog();
    const reason = `could not write the refreshed catalog: ${error instanceof Error ? error.message : String(error)}`;

    if (previous) {
      await keepPreviousCatalog(previous, reason);
      return;
    }

    console.error('Error: Unable to write the LLM pricing catalog, and no valid previous dataset was found.');
    console.error(`Reason: ${reason}`);
    console.error(`Expected local dataset: ${path.relative(root, outputPath)}`);
    process.exitCode = 1;
    return;
  }

  reportCatalog(catalog, popularConfig);
  console.log(`Wrote ${path.relative(root, outputPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
