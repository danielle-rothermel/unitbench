import { modelFilterSql, modelFilterSqlQualified } from '@/lib/canonical-model'
import {
  buildFacetWhereParts,
} from '@/lib/facet-filters'
import {
  MissingDatabaseUrlError,
  neonSql,
  type SqlClient,
} from '@/lib/neon'
import { BUDGET_DIMENSION_SQL, BUDGET_URL_PARAM } from '@/lib/heatmap-config'
import { totalPages } from '@/lib/pagination'
import {
  allTableColumns,
  facetColumnKeys,
  getTableConfig,
  isJoinedColumn,
  tableFromClause,
  type TableConfig,
} from '@/lib/table-config'
import {
  quoteIdentifier,
} from '@/lib/sql-identifiers'
import {
  buildTestExperimentWhereParts,
} from '@/lib/test-experiment-filter'
import {
  parseTableState,
  type SearchParamsRecord,
  type TableState,
} from '@/lib/table-params'

export type TableRow = Record<string, unknown>

export type SqlQuery = {
  text: string
  params: unknown[]
}

export type TableFacets = Record<string, string[]>

export type TablePage =
  | {
      status: 'ok'
      config: TableConfig
      state: TableState
      rows: TableRow[]
      total: number
      totalPages: number
    }
  | {
      status: 'missing-url'
      config: TableConfig
      state: TableState
    }
  | {
      status: 'error'
      config: TableConfig
      state: TableState
      message: string
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

function filterExpression(config: TableConfig, column: string): string {
  if (column === BUDGET_URL_PARAM) return BUDGET_DIMENSION_SQL
  if (column === 'model') {
    if (config.join) return modelFilterSqlQualified(config.join.alias)
    return modelFilterSql()
  }
  if (isJoinedColumn(config, column)) {
    return `${quoteIdentifier(config.join!.alias)}.${quoteIdentifier(column)}`
  }
  if (config.localAlias) {
    return `${quoteIdentifier(config.localAlias)}.${quoteIdentifier(column)}`
  }
  return quoteIdentifier(column)
}

function columnExpression(config: TableConfig, key: string): string {
  return filterExpression(config, key)
}

function selectedColumnSql(config: TableConfig): string {
  return allTableColumns(config)
    .map(column => {
      if (isJoinedColumn(config, column.key)) {
        const alias = config.join!.alias
        if (column.key === 'model') {
          return `${modelFilterSqlQualified(alias)} AS ${quoteIdentifier(column.key)}`
        }
        return `${quoteIdentifier(alias)}.${quoteIdentifier(column.key)} AS ${quoteIdentifier(column.key)}`
      }
      if (config.localAlias) {
        return `${quoteIdentifier(config.localAlias)}.${quoteIdentifier(column.key)} AS ${quoteIdentifier(column.key)}`
      }
      return quoteIdentifier(column.key)
    })
    .join(', ')
}

function facetAllowlist(config: TableConfig): string[] {
  return [...facetColumnKeys(config), BUDGET_URL_PARAM]
}

function testExperimentWhereParts(
  config: TableConfig,
  hide: boolean,
  paramOffset: number,
) {
  if (config.id === 'published-experiments') {
    return buildTestExperimentWhereParts({
      hide,
      paramOffset,
      experimentIdExpr: quoteIdentifier('experiment_id'),
      displayNameExpr: quoteIdentifier('display_name'),
    })
  }
  if (config.localAlias) {
    return buildTestExperimentWhereParts({
      hide,
      paramOffset,
      experimentIdExpr: `${quoteIdentifier(config.localAlias)}.${quoteIdentifier('experiment_id')}`,
    })
  }
  return buildTestExperimentWhereParts({
    hide,
    paramOffset,
    experimentIdExpr: quoteIdentifier('experiment_id'),
  })
}

function buildWhere(config: TableConfig, state: TableState): SqlQuery {
  const conditions: string[] = []
  const params: unknown[] = []
  const byKey = new Map(allTableColumns(config).map(column => [column.key, column]))

  for (const [key, value] of Object.entries(state.filters)) {
    if (key === BUDGET_URL_PARAM) {
      params.push(value)
      conditions.push(`${BUDGET_DIMENSION_SQL} = $${params.length}`)
      continue
    }
    const column = byKey.get(key)
    if (!column || column.filter !== 'text') continue
    params.push(`%${value}%`)
    conditions.push(`${filterExpression(config, key)} ILIKE $${params.length}`)
  }

  const facetParts = buildFacetWhereParts(
    { filterIn: state.filterIn, filterOut: state.filterOut },
    facetAllowlist(config),
    column => filterExpression(config, column),
    params.length,
  )
  conditions.push(...facetParts.conditions)
  params.push(...facetParts.params)

  for (const [key, range] of Object.entries(state.ranges)) {
    const column = byKey.get(key)
    if (!column || column.filter !== 'range') continue
    const expression = filterExpression(config, key)
    if (range.min !== undefined) {
      params.push(range.min)
      conditions.push(`${expression} >= $${params.length}`)
    }
    if (range.max !== undefined) {
      params.push(range.max)
      conditions.push(`${expression} <= $${params.length}`)
    }
  }

  const testParts = testExperimentWhereParts(
    config,
    state.hideTestExperiments,
    params.length,
  )
  conditions.push(...testParts.conditions)
  params.push(...testParts.params)

  const text = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return { text, params }
}

function orderByClause(config: TableConfig, state: TableState): string {
  const direction = state.dir === 'asc' ? 'ASC' : 'DESC'
  if (!state.sort) {
    return `${columnExpression(config, config.defaultSort.column)} ${
      config.defaultSort.direction === 'asc' ? 'ASC' : 'DESC'
    }`
  }
  return `${columnExpression(config, state.sort)} ${direction}`
}

export function buildCountQuery(
  config: TableConfig,
  state: TableState,
): SqlQuery {
  const where = buildWhere(config, state)
  return {
    text: `SELECT count(*)::int AS total FROM ${tableFromClause(config)}${where.text}`,
    params: where.params,
  }
}

export function buildSelectQuery(
  config: TableConfig,
  state: TableState,
): SqlQuery {
  const where = buildWhere(config, state)
  const limitIndex = where.params.length + 1
  const offsetIndex = where.params.length + 2
  const offset = (state.page - 1) * state.pageSize
  const text = [
    `SELECT ${selectedColumnSql(config)}`,
    `FROM ${tableFromClause(config)}${where.text}`,
    `ORDER BY ${orderByClause(config, state)}`,
    `LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
  ].join(' ')
  return { text, params: [...where.params, state.pageSize, offset] }
}

export async function getTablePage(
  tableId: string,
  input: SearchParamsRecord,
): Promise<TablePage> {
  const config = getTableConfig(tableId)
  const state = parseTableState(config, input)
  try {
    const sql = neonSql()
    const countQuery = buildCountQuery(config, state)
    const selectQuery = buildSelectQuery(config, state)
    const [countRows, rows] = await Promise.all([
      queryWithParams(sql, countQuery.text, countQuery.params),
      queryWithParams(sql, selectQuery.text, selectQuery.params),
    ])
    const total = countFromRows(countRows)
    return {
      status: 'ok',
      config,
      state,
      rows,
      total,
      totalPages: totalPages(total, state.pageSize),
    }
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return { status: 'missing-url', config, state }
    }
    return {
      status: 'error',
      config,
      state,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function facetSelectExpression(config: TableConfig, key: string): string {
  if (key === 'model' && config.join) {
    return modelFilterSqlQualified(config.join.alias)
  }
  if (key === 'model') return modelFilterSql()
  return filterExpression(config, key)
}

export async function getTableFacets(
  config: TableConfig,
  state: TableState,
): Promise<TableFacets> {
  const keys = facetColumnKeys(config)
  if (keys.length === 0) return {}
  const sql = neonSql()
  const fromClause = tableFromClause(config)
  const entries = await Promise.all(
    keys.map(async key => {
      const expression = facetSelectExpression(config, key)
      const testParts = testExperimentWhereParts(
        config,
        state.hideTestExperiments,
        0,
      )
      const conditions = [`${expression} IS NOT NULL`, ...testParts.conditions]
      const where = ` WHERE ${conditions.join(' AND ')}`
      const rows = await queryWithParams<{ value: unknown }>(
        sql,
        `SELECT DISTINCT ${expression} AS value FROM ${fromClause}${where} ORDER BY value ASC`,
        testParts.params,
      )
      return [key, rows.map(row => String(row.value))] as const
    }),
  )
  return Object.fromEntries(entries)
}
