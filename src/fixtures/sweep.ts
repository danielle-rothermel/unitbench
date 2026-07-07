import {
  EXPERIMENT_KINDS,
  FIXTURE_MODELS,
  fixtureTaskIds,
  type ExperimentKind,
} from '@/fixtures/primitives'
import { createRng, intBetween, round, type Rng } from '@/fixtures/rng'

/**
 * One row of a grouped aggregate over published_predictions (R1).
 *
 * Measure names extend aggregate-config SORT_MEASURES. rate_limit_count and
 * the latency measures lead the Neon schema: they exist upstream
 * (FailureMetadataPayload.failure_class, NodeAttemptRecord timestamps) and
 * D3 surfaces them via additive summary_json keys.
 */
export type SweepMetricsRow = {
  // group keys — null when not part of the grouping
  model: string | null
  task_id: string | null
  experiment_kind: ExperimentKind | null

  n: number
  pass_count: number
  fail_count: number
  pending_count: number
  error_count: number
  rate_limit_count: number
  pass_rate: number | null
  avg_score: number | null
  stddev_score: number | null
  avg_cost: number | null
  total_cost: number | null
  avg_latency_ms: number | null
  p95_latency_ms: number | null
}

export const SWEEP_GROUP_KEYS = ['model', 'task_id', 'experiment_kind'] as const
export type SweepGroupKey = (typeof SWEEP_GROUP_KEYS)[number]

export type SweepFixtureOptions = {
  seed?: number
  groupBy?: SweepGroupKey[]
  models?: readonly string[]
  taskCount?: number
  samplesPerGroup?: number
}

type GroupValues = {
  model: string | null
  task_id: string | null
  experiment_kind: ExperimentKind | null
}

function groupCombinations(
  groupBy: SweepGroupKey[],
  models: readonly string[],
  taskIds: string[],
): GroupValues[] {
  const modelValues = groupBy.includes('model') ? models : [null]
  const taskValues = groupBy.includes('task_id') ? taskIds : [null]
  const kindValues = groupBy.includes('experiment_kind') ? EXPERIMENT_KINDS : [null]
  const combinations: GroupValues[] = []
  for (const model of modelValues) {
    for (const task_id of taskValues) {
      for (const experiment_kind of kindValues) {
        combinations.push({ model, task_id, experiment_kind })
      }
    }
  }
  return combinations
}

function makeMeasures(rng: Rng, n: number): Omit<SweepMetricsRow, keyof GroupValues> {
  const errorCount = intBetween(rng, 0, Math.floor(n * 0.12))
  const pendingCount = intBetween(rng, 0, Math.floor(n * 0.03))
  const scored = n - errorCount - pendingCount
  const passCount = intBetween(rng, 0, scored)
  const failCount = scored - passCount
  const passRate = n > 0 ? round(passCount / n, 4) : null
  const avgLatency = intBetween(rng, 2_000, 15_000)
  return {
    n,
    pass_count: passCount,
    fail_count: failCount,
    pending_count: pendingCount,
    error_count: errorCount,
    rate_limit_count: intBetween(rng, 0, errorCount),
    pass_rate: passRate,
    avg_score: passRate,
    stddev_score: scored > 1 ? round(Math.sqrt((passRate ?? 0) * (1 - (passRate ?? 0))), 4) : null,
    avg_cost: round(0.0005 + rng() * 0.009, 6),
    total_cost: round(n * (0.0005 + rng() * 0.009), 4),
    avg_latency_ms: avgLatency,
    p95_latency_ms: avgLatency + intBetween(rng, 1_000, 20_000),
  }
}

export function makeSweepMetricsRows(options: SweepFixtureOptions = {}): SweepMetricsRow[] {
  const {
    seed = 1,
    groupBy = ['model'],
    models = FIXTURE_MODELS,
    taskCount = 12,
    samplesPerGroup = 96,
  } = options
  const rng = createRng(seed)
  return groupCombinations(groupBy, models, fixtureTaskIds(taskCount)).map(group => ({
    ...group,
    ...makeMeasures(rng, samplesPerGroup),
  }))
}
