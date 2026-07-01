import {
  DEFAULT_SORT,
  SORT_MEASURES,
  type SortMeasure,
} from '@/lib/aggregate-config'
import { quoteIdentifier } from '@/lib/sql-identifiers'

export const HEATMAP_AXES = [
  'model',
  'task_id',
  'experiment_kind',
  'budget',
] as const

export type HeatmapAxis = (typeof HEATMAP_AXES)[number]

export const HEATMAP_FILTER_COLUMNS = HEATMAP_AXES

export const DEFAULT_HEATMAP_X: HeatmapAxis = 'experiment_kind'
export const DEFAULT_HEATMAP_Y: HeatmapAxis = 'model'
export const DEFAULT_HEATMAP_COLOR: SortMeasure = DEFAULT_SORT

export const HEATMAP_AXIS_LABELS: Record<HeatmapAxis, string> = {
  model: 'Model',
  task_id: 'Task',
  experiment_kind: 'Experiment kind',
  budget: 'Budget',
}

/** Enc-dec budget ratio from summary_json; direct rows bucket as "(none)". */
export const BUDGET_DIMENSION_SQL = `COALESCE(${quoteIdentifier('summary_json')}->>'budget_ratio', '(none)')`

/** URL param for predictions-table budget drill-down (not a physical column). */
export const BUDGET_URL_PARAM = 'budget'

export const HEATMAP_MAX_ROWS = 10_000

/** Semantic category order for budget axis; (none) = unbounded direct runs, last. */
export const BUDGET_VALUE_ORDER = [
  '0.25',
  '0.5',
  '0.75',
  '1.0',
  '1.5',
  '2.0',
  '(none)',
] as const

export const AXIS_VALUE_ORDERS: Partial<
  Record<HeatmapAxis, readonly string[]>
> = {
  budget: BUDGET_VALUE_ORDER,
}

export function isHeatmapAxis(value: string): value is HeatmapAxis {
  return (HEATMAP_AXES as readonly string[]).includes(value)
}

export function isHeatmapFilterColumn(value: string): value is HeatmapAxis {
  return isHeatmapAxis(value)
}

export function otherHeatmapAxis(
  axis: HeatmapAxis,
  taken: HeatmapAxis,
): HeatmapAxis {
  return HEATMAP_AXES.find(candidate => candidate !== taken) ?? axis
}

export function heatmapAxisLabel(axis: HeatmapAxis): string {
  return HEATMAP_AXIS_LABELS[axis]
}

export function heatmapTitle(xAxis: HeatmapAxis, yAxis: HeatmapAxis): string {
  return `${heatmapAxisLabel(yAxis)} × ${heatmapAxisLabel(xAxis)}`
}

export { SORT_MEASURES, type SortMeasure }
