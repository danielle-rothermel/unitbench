import {
  quoteIdentifier,
  qualifiedTableName,
  validateSqlIdentifier,
} from '@/lib/sql-identifiers'

export type ColumnKind =
  | 'text'
  | 'mono'
  | 'number'
  | 'cost'
  | 'date'
  | 'status'
  | 'json'

export type ColumnFilter = 'facet' | 'text' | 'range'

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

export type TableJoin = {
  table: TableName
  alias: string
  on: { local: string; remote: string }
  columns: TableColumn[]
}

export type DetailTables = {
  predictions: TableName
  details: TableName
}

export type TableConfig = {
  id: string
  label: string
  description: string
  table: TableName
  primaryKey: string
  defaultSort: TableSort
  detailRoute?: DetailRoute
  detailTables?: DetailTables
  localAlias?: string
  join?: TableJoin
  columns: TableColumn[]
}

export const DEFAULT_PREDICTIONS_TABLE_ID = 'published-predictions'

export const PUBLISHED_PREDICTION_DETAIL_TABLES: DetailTables = {
  predictions: { name: 'published_predictions' },
  details: { name: 'published_prediction_details' },
}

export const PUBLISHED_V1_PREDICTION_DETAIL_TABLES: DetailTables = {
  predictions: { name: 'published_v1_predictions' },
  details: { name: 'published_v1_prediction_details' },
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
      {
        key: 'display_name',
        label: 'Name',
        kind: 'text',
        truncate: true,
        filter: 'text',
      },
      { key: 'source', label: 'Source', filter: 'facet' },
      { key: 'experiment_kind', label: 'Kind', filter: 'facet' },
      { key: 'row_count', label: 'Rows', kind: 'number', sortable: true },
      { key: 'pass_count', label: 'Passed', kind: 'number', sortable: true },
      { key: 'fail_count', label: 'Failed', kind: 'number', sortable: true },
      { key: 'error_count', label: 'Errors', kind: 'number', sortable: true },
      {
        key: 'pending_count',
        label: 'Pending',
        kind: 'number',
        sortable: true,
      },
      {
        key: 'pass_rate',
        label: 'Pass rate',
        kind: 'number',
        sortable: true,
        filter: 'range',
      },
      {
        key: 'total_provider_cost',
        label: 'Total cost',
        kind: 'cost',
        sortable: true,
      },
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
    detailTables: PUBLISHED_PREDICTION_DETAIL_TABLES,
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
      { key: 'experiment_kind', label: 'Kind', filter: 'facet', sortable: true },
      { key: 'source', label: 'Source', filter: 'facet' },
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
      {
        key: 'generation_status',
        label: 'Generation',
        filter: 'facet',
        sortable: true,
      },
      {
        key: 'scoring_status',
        label: 'Scoring',
        filter: 'facet',
        sortable: true,
      },
      {
        key: 'harness_failure_count',
        label: 'Harness failures',
        kind: 'number',
        sortable: true,
        filter: 'range',
      },
      { key: 'score', label: 'Score', kind: 'number', sortable: true, filter: 'range' },
      {
        key: 'provider_cost',
        label: 'Cost',
        kind: 'cost',
        sortable: true,
        filter: 'range',
      },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'published-prediction-details',
    label: 'Prediction details',
    description:
      'Wide detail records with prompts, code, outputs, and diagnostics. Filter via prediction dimensions; open a row for full text and JSON.',
    table: { name: 'published_prediction_details' },
    localAlias: 'd',
    join: {
      table: { name: 'published_predictions' },
      alias: 'p',
      on: { local: 'prediction_id', remote: 'prediction_id' },
      columns: [
        {
          key: 'model',
          label: 'Model',
          kind: 'mono',
          truncate: true,
          sortable: true,
          filter: 'facet',
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
          key: 'result_state',
          label: 'Result',
          kind: 'status',
          sortable: true,
          filter: 'facet',
        },
        {
          key: 'harness_failure_count',
          label: 'Harness failures',
          kind: 'number',
          sortable: true,
          filter: 'range',
        },
        {
          key: 'experiment_kind',
          label: 'Kind',
          filter: 'facet',
          sortable: true,
        },
      ],
    },
    primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    detailRoute: 'prediction',
    detailTables: PUBLISHED_PREDICTION_DETAIL_TABLES,
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
  {
    id: 'published-v1-experiments',
    label: 'Published v1 experiments',
    description:
      'Experiment summaries from dr-dspy v1 projections with counts, pass rates, costs, and timestamps.',
    table: { name: 'published_v1_experiments' },
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
      {
        key: 'display_name',
        label: 'Name',
        kind: 'text',
        truncate: true,
        filter: 'text',
      },
      { key: 'source', label: 'Source', filter: 'facet' },
      { key: 'experiment_kind', label: 'Kind', filter: 'facet' },
      { key: 'row_count', label: 'Rows', kind: 'number', sortable: true },
      { key: 'pass_count', label: 'Passed', kind: 'number', sortable: true },
      { key: 'fail_count', label: 'Failed', kind: 'number', sortable: true },
      { key: 'error_count', label: 'Errors', kind: 'number', sortable: true },
      {
        key: 'pending_count',
        label: 'Pending',
        kind: 'number',
        sortable: true,
      },
      {
        key: 'pass_rate',
        label: 'Pass rate',
        kind: 'number',
        sortable: true,
        filter: 'range',
      },
      {
        key: 'total_provider_cost',
        label: 'Total cost',
        kind: 'cost',
        sortable: true,
      },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'published-v1-predictions',
    label: 'Published v1 predictions',
    description:
      'Compact v1 prediction rows for browsing tasks, models, statuses, and scores.',
    table: { name: 'published_v1_predictions' },
    primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    detailRoute: 'prediction',
    detailTables: PUBLISHED_V1_PREDICTION_DETAIL_TABLES,
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
      { key: 'experiment_kind', label: 'Kind', filter: 'facet', sortable: true },
      { key: 'source', label: 'Source', filter: 'facet' },
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
      {
        key: 'generation_status',
        label: 'Generation',
        filter: 'facet',
        sortable: true,
      },
      {
        key: 'scoring_status',
        label: 'Scoring',
        filter: 'facet',
        sortable: true,
      },
      {
        key: 'harness_failure_count',
        label: 'Harness failures',
        kind: 'number',
        sortable: true,
        filter: 'range',
      },
      { key: 'score', label: 'Score', kind: 'number', sortable: true, filter: 'range' },
      {
        key: 'provider_cost',
        label: 'Cost',
        kind: 'cost',
        sortable: true,
        filter: 'range',
      },
      { key: 'updated_at', label: 'Updated', kind: 'date', sortable: true },
    ],
  },
  {
    id: 'published-v1-prediction-details',
    label: 'Published v1 prediction details',
    description:
      'Wide v1 detail records with prompts, code, outputs, and diagnostics. Filter via prediction dimensions; open a row for full text and JSON.',
    table: { name: 'published_v1_prediction_details' },
    localAlias: 'd',
    join: {
      table: { name: 'published_v1_predictions' },
      alias: 'p',
      on: { local: 'prediction_id', remote: 'prediction_id' },
      columns: [
        {
          key: 'model',
          label: 'Model',
          kind: 'mono',
          truncate: true,
          sortable: true,
          filter: 'facet',
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
          key: 'result_state',
          label: 'Result',
          kind: 'status',
          sortable: true,
          filter: 'facet',
        },
        {
          key: 'harness_failure_count',
          label: 'Harness failures',
          kind: 'number',
          sortable: true,
          filter: 'range',
        },
        {
          key: 'experiment_kind',
          label: 'Kind',
          filter: 'facet',
          sortable: true,
        },
      ],
    },
    primaryKey: 'prediction_id',
    defaultSort: { column: 'updated_at', direction: 'desc' },
    detailRoute: 'prediction',
    detailTables: PUBLISHED_V1_PREDICTION_DETAIL_TABLES,
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
  return allTableColumns(config).some(column => column.key === columnName)
}

export function sortableColumnKeys(config: TableConfig): string[] {
  return allTableColumns(config)
    .filter(column => column.sortable)
    .map(column => column.key)
}

export function filterColumns(config: TableConfig): TableColumn[] {
  return allTableColumns(config).filter(column => column.filter)
}

export function allTableColumns(config: TableConfig): TableColumn[] {
  return [...config.columns, ...(config.join?.columns ?? [])]
}

export function facetColumnKeys(config: TableConfig): string[] {
  return allTableColumns(config)
    .filter(column => column.filter === 'facet')
    .map(column => column.key)
}

export function isJoinedColumn(config: TableConfig, key: string): boolean {
  return config.join?.columns.some(column => column.key === key) ?? false
}

export function tableFromClause(config: TableConfig): string {
  const base = qualifiedTableNameFromConfig(config)
  if (!config.join) return base
  const joinTable = qualifiedTableName(config.join.table)
  const localAlias = config.localAlias ?? 't'
  const joinAlias = config.join.alias
  validateTableAlias(localAlias)
  validateTableAlias(joinAlias)
  return `${base} AS ${quoteIdentifier(localAlias)} INNER JOIN ${joinTable} AS ${quoteIdentifier(joinAlias)} ON ${quoteIdentifier(localAlias)}.${quoteIdentifier(config.join.on.local)} = ${quoteIdentifier(joinAlias)}.${quoteIdentifier(config.join.on.remote)}`
}

function qualifiedTableNameFromConfig(config: TableConfig): string {
  const quotedName = quoteIdentifier(config.table.name)
  return config.table.schema
    ? `${quoteIdentifier(config.table.schema)}.${quotedName}`
    : quotedName
}

function validateTableAlias(alias: string): void {
  validateSqlIdentifier(alias)
}
