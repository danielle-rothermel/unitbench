/**
 * Seeded percentile-bootstrap CIs over raw BootstrapSampleRow[] (R5, REL-6).
 *
 * Resampling runs client-side over the frozen fixture rows; BootstrapCiSummary
 * is this helper's output contract (computed, never stored). Only `passed` is
 * resampled — pass-rate CIs per the issue; `score` is ignored (binary today,
 * fractional-score futures are out of scope here).
 *
 * Determinism: each group draws from its own PRNG stream seeded by
 * `config.seed` xor an fnv1a hash of the group key, and rows are pre-sorted by
 * (model, task_id, sample_index). Results are therefore independent of input
 * row order and of which other groups are present in `rows`.
 * Design doc: docs/planning/viz-components/v0/workstreams/r5-bootstrap-variance.md.
 */

import type { BootstrapCiSummary, BootstrapSampleRow } from '@/fixtures/bootstrap'
import { createRng } from '@/fixtures/rng'

/** How rows are grouped before resampling. */
export const BOOTSTRAP_GROUPINGS = ['model', 'task', 'model_task', 'overall'] as const
export type BootstrapGrouping = (typeof BOOTSTRAP_GROUPINGS)[number]

export type BootstrapCiConfig = {
  seed: number
  /** Bootstrap replicate count; default 2000. */
  n_resamples: number
  /** Two-sided percentile CI level; default 0.95. */
  confidence_level: number
  /**
   * Per-group draw size for each replicate (m-out-of-n bootstrap). This is the
   * "compare across N" knob: replicates of size N drawn with replacement from
   * the group's observed rows, so CI width ~ 1/sqrt(N). null = the group's own
   * row count (classic bootstrap). N > available is allowed — it treats the
   * observed rate as the truth and is labeled "extrapolated" in the UI.
   */
  n_per_group: number | null
}

export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapCiConfig = {
  seed: 17,
  n_resamples: 2000,
  confidence_level: 0.95,
  n_per_group: null,
}

/** One batch of the compare-across-N sweep. */
export type CiByN = { n: number; summaries: BootstrapCiSummary[] }

/** Observed per-group facts the UI needs alongside summaries (available n, etc.). */
export type GroupObservation = {
  model: string | null
  task_id: string | null
  n_available: number
  /** null when n_available === 0. */
  observed_pass_rate: number | null
}

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/** Stable identity for a (possibly aggregated) group; also the PRNG stream key. */
export function bootstrapGroupKey(model: string | null, task_id: string | null): string {
  return `${model}|${task_id}`
}

/** Human-readable group label shared by the charts. */
export function bootstrapGroupLabel(model: string | null, task_id: string | null): string {
  if (model !== null && task_id !== null) return `${model} · ${task_id}`
  return model ?? task_id ?? 'overall'
}

/** Three-decimal pass-rate formatting, matching ScoreHeatmap's formatMeasure. */
export function formatPassRate(value: number): string {
  return value.toFixed(3)
}

function mixSeed(seed: number, groupKey: string): number {
  return ((seed >>> 0) ^ fnv1a(groupKey)) >>> 0
}

function validateBootstrapConfig(config: BootstrapCiConfig): void {
  if (!Number.isInteger(config.seed)) {
    throw new Error(`bootstrap seed must be an integer, got ${config.seed}`)
  }
  if (!Number.isInteger(config.n_resamples) || config.n_resamples < 1) {
    throw new Error(`n_resamples must be an integer >= 1, got ${config.n_resamples}`)
  }
  if (!(config.confidence_level > 0 && config.confidence_level < 1)) {
    throw new Error(
      `confidence_level must be inside (0, 1), got ${config.confidence_level}`,
    )
  }
  if (
    config.n_per_group !== null &&
    (!Number.isInteger(config.n_per_group) || config.n_per_group < 1)
  ) {
    throw new Error(
      `n_per_group must be null or an integer >= 1, got ${config.n_per_group}`,
    )
  }
}

function compareRows(a: BootstrapSampleRow, b: BootstrapSampleRow): number {
  if (a.model !== b.model) return a.model < b.model ? -1 : 1
  if (a.task_id !== b.task_id) return a.task_id < b.task_id ? -1 : 1
  return a.sample_index - b.sample_index
}

type RowGroup = {
  model: string | null
  task_id: string | null
  /** passed as 0/1, in (model, task_id, sample_index) order. */
  values: number[]
}

function groupIdentity(
  row: BootstrapSampleRow,
  grouping: BootstrapGrouping,
): { model: string | null; task_id: string | null } {
  switch (grouping) {
    case 'model':
      return { model: row.model, task_id: null }
    case 'task':
      return { model: null, task_id: row.task_id }
    case 'model_task':
      return { model: row.model, task_id: row.task_id }
    case 'overall':
      return { model: null, task_id: null }
  }
}

/** Groups pre-sorted rows; map iteration order is the sorted group order. */
function collectGroups(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
): Map<string, RowGroup> {
  const sorted = [...rows].sort(compareRows)
  const groups = new Map<string, RowGroup>()
  for (const row of sorted) {
    const { model, task_id } = groupIdentity(row, grouping)
    const key = bootstrapGroupKey(model, task_id)
    let group = groups.get(key)
    if (group === undefined) {
      group = { model, task_id, values: [] }
      groups.set(key, group)
    }
    group.values.push(row.passed ? 1 : 0)
  }
  return groups
}

/** Type-7 quantile (linear interpolation) over ascending-sorted values. */
function quantileType7(sortedValues: readonly number[], q: number): number {
  const position = (sortedValues.length - 1) * q
  const lowIndex = Math.floor(position)
  const highIndex = Math.ceil(position)
  const lowValue = sortedValues[lowIndex]
  const highValue = sortedValues[highIndex]
  return lowValue + (position - lowIndex) * (highValue - lowValue)
}

function summarizeGroup(group: RowGroup, config: BootstrapCiConfig): BootstrapCiSummary {
  const available = group.values.length
  const drawSize = config.n_per_group ?? available
  const rng = createRng(mixSeed(config.seed, bootstrapGroupKey(group.model, group.task_id)))
  const rates = new Array<number>(config.n_resamples)
  for (let replicate = 0; replicate < config.n_resamples; replicate += 1) {
    let passTotal = 0
    for (let draw = 0; draw < drawSize; draw += 1) {
      passTotal += group.values[Math.floor(rng() * available)]
    }
    rates[replicate] = passTotal / drawSize
  }
  rates.sort((a, b) => a - b)
  const alpha = (1 - config.confidence_level) / 2
  const observedPassTotal = group.values.reduce((total, value) => total + value, 0)
  return {
    model: group.model,
    task_id: group.task_id,
    n_samples: drawSize,
    observed_pass_rate: observedPassTotal / available,
    ci_low: quantileType7(rates, alpha),
    ci_high: quantileType7(rates, 1 - alpha),
    confidence_level: config.confidence_level,
    n_resamples: config.n_resamples,
    seed: config.seed,
  }
}

/**
 * Group rows, resample each group deterministically, return one summary per
 * non-empty group (a pass-rate CI over zero samples is undefined; use
 * observeGroups to surface empty groups). Percentile CI, type-7 interpolation.
 */
export function computeBootstrapCis(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
  config: BootstrapCiConfig,
): BootstrapCiSummary[] {
  validateBootstrapConfig(config)
  const groups = collectGroups(rows, grouping)
  return [...groups.values()].map(group => summarizeGroup(group, config))
}

/**
 * Convenience for the compare-across-N view: computeBootstrapCis once per N in
 * the ladder, tagging each batch.
 */
export function computeCisAcrossN(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
  config: Omit<BootstrapCiConfig, 'n_per_group'>,
  nLadder: readonly number[],
): CiByN[] {
  return nLadder.map(n => ({
    n,
    summaries: computeBootstrapCis(rows, grouping, { ...config, n_per_group: n }),
  }))
}

/**
 * Observed facts per group. For 'model_task' the full model × task cross
 * product is reported, so combinations with zero rows still appear
 * (n_available: 0) even though computeBootstrapCis omits them.
 */
export function observeGroups(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
): GroupObservation[] {
  const groups = collectGroups(rows, grouping)
  const observations = [...groups.values()].map(group => ({
    model: group.model,
    task_id: group.task_id,
    n_available: group.values.length,
    observed_pass_rate:
      group.values.reduce((total, value) => total + value, 0) / group.values.length,
  }))
  if (grouping !== 'model_task') return observations

  const present = new Map(
    observations.map(observation => [
      bootstrapGroupKey(observation.model, observation.task_id),
      observation,
    ]),
  )
  const models = [...new Set(rows.map(row => row.model))].sort()
  const taskIds = [...new Set(rows.map(row => row.task_id))].sort()
  const crossProduct: GroupObservation[] = []
  for (const model of models) {
    for (const task_id of taskIds) {
      const observation = present.get(bootstrapGroupKey(model, task_id))
      crossProduct.push(
        observation ?? { model, task_id, n_available: 0, observed_pass_rate: null },
      )
    }
  }
  return crossProduct
}
