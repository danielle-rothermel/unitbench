import type { TableConfig, TableName } from '@/lib/table-config'

export const AGGREGATE_TABLE: TableName = { name: 'predictions' }

export const GROUP_BY_COLUMNS = [
  'model',
  'task_id',
  'experiment_kind',
  'result_state',
  'source',
] as const

export type GroupByColumn = (typeof GROUP_BY_COLUMNS)[number]

export const SORT_MEASURES = [
  'n',
  'avg_score',
  'stddev_score',
  'pass_rate',
  'avg_cost',
] as const

export type SortMeasure = (typeof SORT_MEASURES)[number]

export const FILTER_COLUMNS = ['model', 'experiment_kind'] as const

export type FilterColumn = (typeof FILTER_COLUMNS)[number]

export const DEFAULT_GROUP_BY: GroupByColumn[] = ['model']
export const DEFAULT_SORT: SortMeasure = 'avg_score'
export const DEFAULT_SORT_DIR = 'asc' as const
export const DEFAULT_AGGREGATE_PAGE_SIZE = 100

const GROUP_BY_LABELS: Record<GroupByColumn, string> = {
  model: 'Model',
  task_id: 'Task',
  experiment_kind: 'Experiment kind',
  result_state: 'Result state',
  source: 'Source',
}

const MEASURE_LABELS: Record<SortMeasure, string> = {
  n: 'N',
  avg_score: 'Average Binary Pass Rate',
  stddev_score: 'Stddev score',
  pass_rate: 'Average % Pass Rate',
  avg_cost: 'Avg cost',
}

export function measureLabel(measure: SortMeasure): string {
  return MEASURE_LABELS[measure]
}

export type AggregateStateShape = {
  groupBy: string[]
  sort: string
  dir: 'asc' | 'desc'
}

export function isGroupByColumn(value: string): value is GroupByColumn {
  return (GROUP_BY_COLUMNS as readonly string[]).includes(value)
}

export function isSortMeasure(value: string): value is SortMeasure {
  return (SORT_MEASURES as readonly string[]).includes(value)
}

export function isFilterColumn(value: string): value is FilterColumn {
  return (FILTER_COLUMNS as readonly string[]).includes(value)
}

export function buildAggregateTableConfig(
  state: AggregateStateShape,
): TableConfig {
  const groupColumns = state.groupBy.filter(isGroupByColumn).map(key => ({
    key,
    label: GROUP_BY_LABELS[key],
    kind: 'mono' as const,
    sortable: false,
    truncate: true,
  }))

  const measureColumns = SORT_MEASURES.map(key => ({
    key,
    label: MEASURE_LABELS[key],
    kind: 'number' as const,
    sortable: false,
  }))

  return {
    id: 'aggregate',
    label: 'Aggregation',
    plane: 'analysis',
    description: 'Grouped aggregates over the pinned prediction bundle.',
    table: AGGREGATE_TABLE,
    primaryKey: state.groupBy[0] ?? 'model',
    defaultSort: { column: DEFAULT_SORT, direction: DEFAULT_SORT_DIR },
    columns: [...groupColumns, ...measureColumns],
  }
}
