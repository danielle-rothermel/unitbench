export type ColumnKind =
  | 'text'
  | 'mono'
  | 'number'
  | 'date'
  | 'status'
  | 'json'

export type ColumnFilter = 'facet' | 'text'

export type DetailRoute = 'prediction'

export type TableName = {
  schema?: string
  name: string
}

export type TableColumn = {
  key: string
  label: string
  kind?: ColumnKind
  truncate?: boolean
  sortable?: boolean
  filter?: ColumnFilter
}

export type TableSort = {
  column: string
  direction: 'asc' | 'desc'
}

export type TableConfig = {
  id: string
  label: string
  description: string
  table: TableName
  primaryKey: string
  defaultSort: TableSort
  detailRoute?: DetailRoute
  columns: TableColumn[]
}

export class UnknownTableError extends Error {
  constructor(tableId: string) {
    super(`Unknown table: ${tableId}`)
    this.name = 'UnknownTableError'
  }
}

export const TABLE_CONFIGS = [
  {
    id: 'published-experiments',
    label: 'Published experiments',
    description:
      'Curated experiment summaries with counts, pass rates, costs, and timestamps.',
    table: { name: 'published_experiments' },
    primaryKey: 'experiment_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    columns: [
      {
        key: 'experiment_id',
        label: 'Experiment',
        kind: 'mono',
        truncate: true,
        filter: 'text',
      },
      { key: 'source', label: 'Source', filter: 'facet' },
      { key: 'experiment_kind', label: 'Kind', filter: 'facet' },
      { key: 'row_count', label: 'Rows', kind: 'number', sortable: true },
      { key: 'pass_rate', label: 'Pass rate', kind: 'number', sortable: true },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'published-predictions',
    label: 'Published predictions',
    description:
      'Compact prediction rows for browsing tasks, models, statuses, and scores.',
    table: { name: 'published_predictions' },
    primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    detailRoute: 'prediction',
    columns: [
      {
        key: 'prediction_id',
        label: 'Prediction',
        kind: 'mono',
        truncate: true,
      },
      {
        key: 'experiment_id',
        label: 'Experiment',
        kind: 'mono',
        truncate: true,
        filter: 'text',
      },
      {
        key: 'task_id',
        label: 'Task',
        kind: 'mono',
        truncate: true,
        sortable: true,
        filter: 'text',
      },
      {
        key: 'model',
        label: 'Model',
        kind: 'mono',
        truncate: true,
        sortable: true,
        filter: 'facet',
      },
      {
        key: 'result_state',
        label: 'Result',
        kind: 'status',
        sortable: true,
        filter: 'facet',
      },
      { key: 'score', label: 'Score', kind: 'number', sortable: true },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'published-prediction-details',
    label: 'Prediction details',
    description:
      'Wide detail records with prompts, code, outputs, diagnostics, and metrics JSON.',
    table: { name: 'published_prediction_details' },
    primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    detailRoute: 'prediction',
    columns: [
      {
        key: 'prediction_id',
        label: 'Prediction',
        kind: 'mono',
        truncate: true,
      },
      {
        key: 'experiment_id',
        label: 'Experiment',
        kind: 'mono',
        truncate: true,
        filter: 'text',
      },
      { key: 'input_kind', label: 'Input', filter: 'facet' },
      { key: 'output_kind', label: 'Output', filter: 'facet' },
      { key: 'metrics_json', label: 'Metrics', kind: 'json', truncate: true },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
] satisfies TableConfig[]

export function getTableConfigs(): TableConfig[] {
  return [...TABLE_CONFIGS]
}

export function getTableConfig(tableId: string): TableConfig {
  const config = TABLE_CONFIGS.find(table => table.id === tableId)
  if (!config) throw new UnknownTableError(tableId)
  return config
}

export function isConfiguredColumn(
  config: TableConfig,
  columnName: string,
): boolean {
  return config.columns.some(column => column.key === columnName)
}

export function sortableColumnKeys(config: TableConfig): string[] {
  return config.columns
    .filter(column => column.sortable)
    .map(column => column.key)
}

export function filterColumns(config: TableConfig): TableColumn[] {
  return config.columns.filter(column => column.filter)
}

export function facetColumnKeys(config: TableConfig): string[] {
  return config.columns
    .filter(column => column.filter === 'facet')
    .map(column => column.key)
}
