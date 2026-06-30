import {
  AGGREGATE_TABLE,
  buildAggregateTableConfig,
  isGroupByColumn,
  isSortMeasure,
  SORT_MEASURES,
  type GroupByColumn,
  type SortMeasure,
} from '@/lib/aggregate-config'
import {
  MissingDatabaseUrlError,
  neonSql,
  type SqlClient,
} from '@/lib/neon'
import { totalPages } from '@/lib/pagination'
import {
  orderByForSort,
  qualifiedTableName,
  quoteIdentifier,
} from '@/lib/sql-identifiers'
import type { AggregateFilters } from '@/lib/aggregate-filters'
import {
  modelFilterSql,
  modelGroupBySelectSql,
  modelGroupBySql,
} from '@/lib/canonical-model'
import type { TableRow } from '@/lib/table-data'

export type { AggregateFilters } from '@/lib/aggregate-filters'

export type SqlQuery = {
  text: string
  params: unknown[]
}

export type AggregateFacets = Record<string, string[]>

export type AggregateState = {
  groupBy: string[]
  sort: string
  dir: 'asc' | 'desc'
  page: number
  pageSize: number
  filterIn: Record<string, string[]>
  filterOut: Record<string, string[]>
}

export type AggregatePage =
  | {
      status: 'ok'
      state: AggregateState
      tableConfig: ReturnType<typeof buildAggregateTableConfig>
      rows: TableRow[]
      total: number
      totalPages: number
    }
  | {
      status: 'missing-url'
      state: AggregateState
      tableConfig: ReturnType<typeof buildAggregateTableConfig>
    }
  | {
      status: 'error'
      state: AggregateState
      tableConfig: ReturnType<typeof buildAggregateTableConfig>
      message: string
    }

export class InvalidAggregateQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAggregateQueryError'
  }
}

function queryWithParams<T extends TableRow>(
  sql: SqlClient,
  query: string,
  params: unknown[],
): Promise<T[]> {
  return sql.query(query, params) as Promise<T[]>
}

function countFromRows(rows: TableRow[]): number {
  const first = rows[0]
  const raw = first?.total
  if (typeof raw === 'number') return raw
  if (typeof raw === 'bigint') return Number(raw)
  if (typeof raw === 'string') return Number.parseInt(raw, 10)
  return 0
}

function validateGroupBy(groupBy: string[]): GroupByColumn[] {
  if (groupBy.length === 0) {
    throw new InvalidAggregateQueryError('At least one group-by column is required')
  }
  const columns: GroupByColumn[] = []
  for (const column of groupBy) {
    if (!isGroupByColumn(column)) {
      throw new InvalidAggregateQueryError(`Disallowed group-by column: ${column}`)
    }
    columns.push(column)
  }
  return columns
}

function validateSort(sort: string): void {
  if (!isSortMeasure(sort)) {
    throw new InvalidAggregateQueryError(`Disallowed sort measure: ${sort}`)
  }
}

function validateFilterColumn(column: string): GroupByColumn {
  if (!isGroupByColumn(column)) {
    throw new InvalidAggregateQueryError(`Disallowed filter column: ${column}`)
  }
  return column
}

function filterExpression(column: GroupByColumn): string {
  if (column === 'model') return modelFilterSql()
  return quoteIdentifier(column)
}

function buildWhere(filters: AggregateFilters): SqlQuery {
  const conditions: string[] = []
  const params: unknown[] = []

  for (const [rawColumn, values] of Object.entries(filters.filterIn)) {
    if (values.length === 0) continue
    const column = validateFilterColumn(rawColumn)
    params.push(values)
    conditions.push(
      `${filterExpression(column)} = ANY($${params.length}::text[])`,
    )
  }

  for (const [rawColumn, values] of Object.entries(filters.filterOut)) {
    if (values.length === 0) continue
    const column = validateFilterColumn(rawColumn)
    params.push(values)
    conditions.push(
      `(${filterExpression(column)} IS NULL OR ${filterExpression(column)} <> ALL($${params.length}::text[]))`,
    )
  }

  const text = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return { text, params }
}

function dimensionSelect(column: GroupByColumn): string {
  if (column === 'model') return modelGroupBySelectSql()
  return quoteIdentifier(column)
}

function dimensionGroupBy(column: GroupByColumn): string {
  if (column === 'model') return modelGroupBySql()
  return quoteIdentifier(column)
}

function selectExpressions(groupBy: GroupByColumn[]): string {
  const dimensions = groupBy.map(dimensionSelect).join(', ')
  const measures = [
    'count(*)::int AS n',
    'avg(score) AS avg_score',
    'stddev(score) AS stddev_score',
    'count(*) FILTER (WHERE result_state = \'passed\')::float / nullif(count(*), 0) AS pass_rate',
    'avg(provider_cost) AS avg_cost',
  ].join(', ')
  return dimensions ? `${dimensions}, ${measures}` : measures
}

function groupByClause(groupBy: GroupByColumn[]): string {
  return groupBy.map(dimensionGroupBy).join(', ')
}

function resultColumnList(groupBy: GroupByColumn[]): string {
  const dimensions = groupBy.map(column => quoteIdentifier(column))
  const measures = SORT_MEASURES.map(column => quoteIdentifier(column))
  return [...dimensions, ...measures].join(', ')
}

function buildClusteredOrderQuery(
  groupBy: GroupByColumn[],
  sort: SortMeasure,
  dir: 'asc' | 'desc',
  innerQuery: string,
  limitClause: string,
): string {
  const primary = quoteIdentifier(groupBy[0])
  const clusterAgg = dir === 'asc' ? 'MIN' : 'MAX'
  const sortCol = quoteIdentifier(sort)
  const clusterDirection = dir === 'asc' ? 'ASC' : 'DESC'
  const columns = resultColumnList(groupBy)
  const innerOrder = groupBy
    .slice(1)
    .map(column => `ranked.${quoteIdentifier(column)} ASC`)
    .join(', ')
  const orderBy = innerOrder
    ? `ranked._cluster_sort ${clusterDirection}, ${innerOrder}`
    : `ranked._cluster_sort ${clusterDirection}`

  return [
    `SELECT ${columns} FROM (`,
    `SELECT grouped.*, ${clusterAgg}(grouped.${sortCol}) OVER (PARTITION BY grouped.${primary}) AS _cluster_sort`,
    `FROM (${innerQuery}) AS grouped`,
    `) AS ranked`,
    `ORDER BY ${orderBy}`,
    limitClause,
  ].join(' ')
}

export function buildAggregateCountQuery(state: AggregateState): SqlQuery {
  const groupBy = validateGroupBy(state.groupBy)
  const where = buildWhere(state)
  const table = qualifiedTableName(AGGREGATE_TABLE)
  const grouped = groupByClause(groupBy)
  return {
    text: `SELECT count(*)::int AS total FROM (SELECT 1 FROM ${table}${where.text} GROUP BY ${grouped}) AS grouped`,
    params: where.params,
  }
}

export function buildAggregateQuery(state: AggregateState): SqlQuery {
  const groupBy = validateGroupBy(state.groupBy)
  validateSort(state.sort)
  const where = buildWhere(state)
  const table = qualifiedTableName(AGGREGATE_TABLE)
  const limitIndex = where.params.length + 1
  const offsetIndex = where.params.length + 2
  const offset = (state.page - 1) * state.pageSize
  const limitClause = `LIMIT $${limitIndex} OFFSET $${offsetIndex}`
  const innerQuery = [
    `SELECT ${selectExpressions(groupBy)}`,
    `FROM ${table}${where.text}`,
    `GROUP BY ${groupByClause(groupBy)}`,
  ].join(' ')
  const text =
    groupBy.length > 1
      ? buildClusteredOrderQuery(
          groupBy,
          state.sort as SortMeasure,
          state.dir,
          innerQuery,
          limitClause,
        )
      : [
          innerQuery,
          `ORDER BY ${orderByForSort(state.sort, state.dir)}`,
          limitClause,
        ].join(' ')
  return {
    text,
    params: [...where.params, state.pageSize, offset],
  }
}

export async function getAggregatePage(
  state: AggregateState,
): Promise<AggregatePage> {
  const tableConfig = buildAggregateTableConfig(state)
  try {
    const sql = neonSql()
    const countQuery = buildAggregateCountQuery(state)
    const selectQuery = buildAggregateQuery(state)
    const [countRows, rows] = await Promise.all([
      queryWithParams(sql, countQuery.text, countQuery.params),
      queryWithParams(sql, selectQuery.text, selectQuery.params),
    ])
    const total = countFromRows(countRows)
    return {
      status: 'ok',
      state,
      tableConfig,
      rows,
      total,
      totalPages: totalPages(total, state.pageSize),
    }
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return { status: 'missing-url', state, tableConfig }
    }
    return {
      status: 'error',
      state,
      tableConfig,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getAggregateFacets(): Promise<AggregateFacets> {
  const sql = neonSql()
  const table = qualifiedTableName(AGGREGATE_TABLE)
  const keys = ['model', 'experiment_kind'] as const
  const entries = await Promise.all(
    keys.map(async key => {
      if (key === 'model') {
        const rows = await queryWithParams<{ value: unknown }>(
          sql,
          `SELECT DISTINCT ${modelGroupBySql()} AS value FROM ${table} WHERE ${quoteIdentifier('model')} IS NOT NULL ORDER BY value ASC`,
          [],
        )
        return [key, rows.map(row => String(row.value))] as const
      }
      const id = quoteIdentifier(key)
      const rows = await queryWithParams<{ value: unknown }>(
        sql,
        `SELECT DISTINCT ${id} AS value FROM ${table} WHERE ${id} IS NOT NULL ORDER BY ${id} ASC`,
        [],
      )
      return [key, rows.map(row => String(row.value))] as const
    }),
  )
  return Object.fromEntries(entries)
}

export async function getHeatmapRows(
  filters: AggregateFilters,
): Promise<TableRow[]> {
  const heatmapState: AggregateState = {
    ...filters,
    groupBy: ['model', 'experiment_kind'],
    sort: 'avg_score',
    dir: 'asc',
    page: 1,
    pageSize: 100,
  }
  const query = buildAggregateQuery(heatmapState)
  const sql = neonSql()
  return queryWithParams(sql, query.text, query.params)
}
