/**
 * Shared internals for the sweep-metrics charts (R1, REL-2).
 *
 * Colocated with the charts (not src/lib/) to keep R1's file isolation; if a
 * later component needs these, promote them in a shared-file pass.
 * Plan: docs/planning/viz-components/v0/workstreams/r1-sweep-dashboard.md.
 */
import type { SweepGroupKey, SweepMetricsRow } from '@/fixtures'

/** The two keys the dashboard slices by; derived from the fixture's group keys. */
export type SweepSliceKey = Extract<SweepGroupKey, 'model' | 'task_id'>

/** Shared shape for every per-group chart. */
export type SweepChartProps = {
  /** One grouping (per-model, per-task, or a filtered slice of model×task rows). */
  rows: SweepMetricsRow[]
  /** Which nullable group key labels each row. */
  groupKey: SweepSliceKey
  /** Section header, story-style ("Where errors cluster"). */
  title: string
  /** Group value to emphasize (the current slice). */
  highlightValue?: string | null
}

/**
 * Label for a row of any grouping. Prefers the chart's own group key, then
 * falls back model → task_id → experiment_kind → 'all', so all-null-keys rows
 * never render "null"/"undefined".
 */
export function sweepGroupLabel(row: SweepMetricsRow, groupKey: SweepSliceKey): string {
  return row[groupKey] ?? row.model ?? row.task_id ?? row.experiment_kind ?? 'all'
}

/** Stable React key across slices; labels can repeat, the key triple cannot. */
export function sweepRowKey(row: SweepMetricsRow): string {
  return `${row.model}|${row.task_id}|${row.experiment_kind}`
}

/** Percent width for a bar; returns 0 for null/NaN/max<=0 (never emits NaN styles). */
export function barPercent(value: number | null, max: number): number {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, (value / max) * 100))
}

/** Max of a measure across rows, ignoring nulls; 0 when nothing is finite. */
export function measureMax(
  rows: SweepMetricsRow[],
  pick: (row: SweepMetricsRow) => number | null,
): number {
  let max = 0
  for (const row of rows) {
    const value = pick(row)
    if (value !== null && Number.isFinite(value) && value > max) {
      max = value
    }
  }
  return max
}

/** '8.4 s' / '412 ms' / '—' for null. format.ts has no duration helper; local on purpose. */
export function formatMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value < 1_000) return `${Math.round(value)} ms`
  return `${(value / 1_000).toFixed(1)} s`
}

/** Stable sort: desc by measure, nulls last, ties by label (deterministic renders). */
export function sortRowsByMeasure(
  rows: SweepMetricsRow[],
  groupKey: SweepSliceKey,
  pick: (row: SweepMetricsRow) => number | null,
): SweepMetricsRow[] {
  const isSortable = (value: number | null): value is number =>
    value !== null && Number.isFinite(value)
  return [...rows].sort((a, b) => {
    const aValue = pick(a)
    const bValue = pick(b)
    const aSortable = isSortable(aValue)
    const bSortable = isSortable(bValue)
    if (aSortable !== bSortable) return aSortable ? -1 : 1
    if (aSortable && bSortable && aValue !== bValue) return bValue - aValue
    return sweepGroupLabel(a, groupKey).localeCompare(sweepGroupLabel(b, groupKey))
  })
}

/** Distinct non-null values of a slice key, sorted, for the dashboard selects. */
export function sweepSliceValues(rows: SweepMetricsRow[], key: SweepSliceKey): string[] {
  const values = new Set<string>()
  for (const row of rows) {
    const value = row[key]
    if (value !== null) values.add(value)
  }
  return [...values].sort((a, b) => a.localeCompare(b))
}
