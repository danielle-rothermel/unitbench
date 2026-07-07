import {
  FIXTURE_MODELS,
  experimentKindForLayout,
  fixtureExperimentId,
  fixtureTaskIds,
  type ExperimentKind,
} from '@/fixtures/primitives'
import { chance, createRng, floatBetween } from '@/fixtures/rng'

/**
 * One scored prediction — the resampling unit (R5). Literally the projection
 * of published_predictions a bootstrap needs; resampling runs client-side
 * over these rows so CIs can be recomputed at any N.
 */
export type BootstrapSampleRow = {
  experiment_id: string
  experiment_kind: ExperimentKind
  model: string
  task_id: string
  sample_index: number
  /** result_state === 'passed' */
  passed: boolean
  /** Binary today; kept for fractional-score futures. */
  score: number | null
}

/** Output contract of the shared bootstrap helper (computed, not stored). */
export type BootstrapCiSummary = {
  /** null = aggregated across models. */
  model: string | null
  /** null = aggregated across tasks. */
  task_id: string | null
  /** N actually used in this resample config. */
  n_samples: number
  observed_pass_rate: number
  ci_low: number
  ci_high: number
  confidence_level: number
  n_resamples: number
  /** Deterministic reruns. */
  seed: number
}

export type BootstrapFixtureOptions = {
  seed?: number
  models?: readonly string[]
  taskCount?: number
  samplesPerTask?: number
}

export function makeBootstrapSampleRows(
  options: BootstrapFixtureOptions = {},
): BootstrapSampleRow[] {
  const {
    seed = 1,
    models = FIXTURE_MODELS,
    taskCount = 24,
    samplesPerTask = 3,
  } = options
  const rng = createRng(seed)
  const experiment_id = fixtureExperimentId('encdec', 'coarse-budget-01')
  const experiment_kind = experimentKindForLayout('encdec')
  const rows: BootstrapSampleRow[] = []
  for (const model of models) {
    for (const task_id of fixtureTaskIds(taskCount)) {
      // Per-task difficulty so pass/fail correlates within a task, as in real data
      const taskPassRate = floatBetween(rng, 0.1, 0.95)
      for (let sample_index = 0; sample_index < samplesPerTask; sample_index += 1) {
        const passed = chance(rng, taskPassRate)
        rows.push({
          experiment_id,
          experiment_kind,
          model,
          task_id,
          sample_index,
          passed,
          score: passed ? 1.0 : 0.0,
        })
      }
    }
  }
  return rows
}
