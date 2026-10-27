/**
 * Maps engine progress onto the reader-facing step list.
 *
 * The engine reports coarse phases. The steps below are a plain-language view
 * of the same work; during the check phase the five check steps advance in
 * proportion to completed checks, so the position is approximate.
 */

import { AssessmentProgress } from '../../types';

export const PROGRESS_STEP_LABELS = [
  'Discovering pages',
  'Building page inventory',
  'Discovering resources and site files',
  'Checking transport security',
  'Analyzing headers',
  'Analyzing forms',
  'Analyzing JavaScript',
  'Analyzing third-party resources',
  'Building findings',
  'Building asset inventory',
  'Building report'
] as const;

export type ProgressStepState = 'done' | 'active' | 'pending';

export interface ProgressStep {
  label: string;
  state: ProgressStepState;
}

export interface ProgressView {
  steps: ProgressStep[];
  /** 0-100, approximate. */
  percent: number;
}

const CHECK_STEPS_START = 3;
const CHECK_STEPS_COUNT = 5;

function activeIndexFor(progress: AssessmentProgress): number {
  switch (progress.phase) {
    case 'starting':
      return 0;
    case 'discovering':
      return progress.pagesAnalyzed > 0 ? 1 : 0;
    case 'probing':
      return 2;
    case 'checking': {
      const fraction =
        progress.totalChecks > 0 ? Math.min(1, progress.checksCompleted / progress.totalChecks) : 0;
      return CHECK_STEPS_START + Math.min(CHECK_STEPS_COUNT - 1, Math.floor(fraction * CHECK_STEPS_COUNT));
    }
    case 'aggregating':
      return 8;
    case 'complete':
      return PROGRESS_STEP_LABELS.length;
  }
}

export function progressView(progress: AssessmentProgress | null): ProgressView {
  const active = progress ? activeIndexFor(progress) : 0;
  const steps = PROGRESS_STEP_LABELS.map((label, index): ProgressStep => ({
    label,
    state: index < active ? 'done' : index === active ? 'active' : 'pending'
  }));
  const percent = Math.round(((active + (active < steps.length ? 0.5 : 0)) / steps.length) * 100);
  return { steps, percent: Math.min(100, percent) };
}
