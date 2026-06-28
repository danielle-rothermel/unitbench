import {
  MissingDatabaseUrlError,
  neonSql,
  type SqlClient,
} from '@/lib/neon'
import { totalPages } from '@/lib/pagination'
import {
  facetColumnKeys,
  getTableConfig,
  type TableConfig,
} from '@/lib/table-config'
import {
  orderByForSort,
  orderBySql,
  qualifiedTableName,
  quoteIdentifier,
  selectedColumnSql,
} from '@/lib/sql-identifiers'
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

function buildWhere(config: TableConfig, state: TableState): SqlQuery {
  const conditions: string[] = []
  const params: unknown[] = []
  const byKey = new Map(config.columns.map(column => [column.key, column]))
  for (const [key, value] of Object.entries(state.filters)) {
    const column = byKey.get(key)
    if (!column?.filter) continue
    if (column.filter === 'text') {
      params.push(`%${value}%`)
      conditions.push(`${quoteIdentifier(key)} ILIKE $${params.length}`)
    } else {
      params.push(value)
      conditions.push(`${quoteIdentifier(key)} = $${params.length}`)
    }
  }
  const text = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return { text, params }
}

function orderByClause(config: TableConfig, state: TableState): string {
  return state.sort ? orderByForSort(state.sort, state.dir) : orderBySql(config)
}

export function buildCountQuery(
  config: TableConfig,
  state: TableState,
): SqlQuery {
  const where = buildWhere(config, state)
  return {
    text: `SELECT count(*)::int AS total FROM ${qualifiedTableName(config.table)}${where.text}`,
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
    `FROM ${qualifiedTableName(config.table)}${where.text}`,
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

export async function getTableFacets(
  config: TableConfig,
): Promise<TableFacets> {
  const keys = facetColumnKeys(config)
  if (keys.length === 0) return {}
  const sql = neonSql()
  const table = qualifiedTableName(config.table)
  const entries = await Promise.all(
    keys.map(async key => {
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
