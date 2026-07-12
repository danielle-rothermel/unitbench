import { quoteIdentifier, validateSqlIdentifier } from '@/lib/sql-identifiers'

export type ColumnKind = 'text' | 'mono' | 'number' | 'cost' | 'date' | 'status' | 'json'
export type ColumnFilter = 'facet' | 'text' | 'range'
export type DetailRoute = 'prediction'
export type TablePlane = 'analysis' | 'detail'
export type TableName = { schema?: string; name: string }
export type TableColumn = {
  key: string
  label: string
  kind?: ColumnKind
  truncate?: boolean
  sortable?: boolean
  filter?: ColumnFilter
}
export type TableSort = { column: string; direction: 'asc' | 'desc' }
export type TableConfig = {
  id: string
  label: string
  description: string
  plane: TablePlane
  table: TableName
  primaryKey: string
  defaultSort: TableSort
  detailRoute?: DetailRoute
  columns: TableColumn[]
}

export const DEFAULT_PREDICTIONS_TABLE_ID = 'predictions'

export class UnknownTableError extends Error {
  constructor(tableId: string) {
    super(`Unknown table: ${tableId}`)
    this.name = 'UnknownTableError'
  }
}

const PREDICTION_COLUMNS = [
  { key: 'prediction_id', label: 'Prediction', kind: 'mono', truncate: true },
  { key: 'experiment_id', label: 'Experiment', kind: 'mono', truncate: true, filter: 'text' },
  { key: 'task_id', label: 'Task', kind: 'mono', truncate: true, sortable: true, filter: 'text' },
  { key: 'experiment_kind', label: 'Kind', filter: 'facet', sortable: true },
  { key: 'source', label: 'Source', filter: 'facet' },
  { key: 'model', label: 'Model', kind: 'mono', truncate: true, sortable: true, filter: 'facet' },
  { key: 'result_state', label: 'Result', kind: 'status', sortable: true, filter: 'facet' },
  { key: 'generation_status', label: 'Generation', sortable: true, filter: 'facet' },
  { key: 'scoring_status', label: 'Scoring', sortable: true, filter: 'facet' },
  { key: 'score', label: 'Score', kind: 'number', sortable: true, filter: 'range' },
  { key: 'provider_cost', label: 'Cost', kind: 'cost', sortable: true, filter: 'range' },
  { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
] satisfies TableColumn[]

export const TABLE_CONFIGS = [
  {
    id: 'experiments', label: 'Experiments', plane: 'analysis', table: { name: 'experiments' },
    description: 'Experiment summaries from the pinned Analysis bundle.', primaryKey: 'experiment_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    columns: [
      { key: 'experiment_id', label: 'Experiment', kind: 'mono', truncate: true, filter: 'text' },
      { key: 'display_name', label: 'Name', truncate: true, filter: 'text' },
      { key: 'experiment_kind', label: 'Kind', filter: 'facet' },
      { key: 'row_count', label: 'Rows', kind: 'number', sortable: true },
      { key: 'pass_rate', label: 'Pass rate', kind: 'number', sortable: true, filter: 'range' },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'predictions', label: 'Predictions', plane: 'analysis', table: { name: 'predictions' },
    description: 'Prediction rows from one pinned Analysis bundle.', primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' }, detailRoute: 'prediction', columns: PREDICTION_COLUMNS,
  },
  {
    id: 'detail-predictions', label: 'Detail predictions', plane: 'detail', table: { name: 'detail_predictions' },
    description: 'Root-cascaded predictions from one pinned Detail bundle.', primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' }, detailRoute: 'prediction', columns: PREDICTION_COLUMNS,
  },
] satisfies TableConfig[]

export function getTableConfigs(): TableConfig[] { return [...TABLE_CONFIGS] }
export function getTableConfig(tableId: string): TableConfig {
  const config = TABLE_CONFIGS.find(table => table.id === tableId)
  if (!config) throw new UnknownTableError(tableId)
  return config
}
export function isConfiguredColumn(config: TableConfig, columnName: string): boolean { return config.columns.some(column => column.key === columnName) }
export function sortableColumnKeys(config: TableConfig): string[] { return config.columns.filter(column => column.sortable).map(column => column.key) }
export function filterColumns(config: TableConfig): TableColumn[] { return config.columns.filter(column => column.filter) }
export function allTableColumns(config: TableConfig): TableColumn[] { return config.columns }
export function facetColumnKeys(config: TableConfig): string[] { return config.columns.filter(column => column.filter === 'facet').map(column => column.key) }
export function isJoinedColumn(config: TableConfig, key: string): boolean {
  void config
  void key
  return false
}
export function tableFromClause(config: TableConfig): string { validateSqlIdentifier(config.table.name); return quoteIdentifier(config.table.name) }
