import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePagination,
} from '@/lib/pagination'
import {
  filterColumns,
  sortableColumnKeys,
  type TableConfig,
} from '@/lib/table-config'

export type SortDirection = 'asc' | 'desc'

export type TableState = {
  page: number
  pageSize: number
  sort: string | null
  dir: SortDirection
  filters: Record<string, string>
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>

const SORT_PARAM = 'sort'
const DIR_PARAM = 'dir'
const PAGE_PARAM = 'page'
const PAGE_SIZE_PARAM = 'pageSize'
const DEFAULT_DIRECTION: SortDirection = 'desc'

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseSort(
  config: TableConfig,
  input: SearchParamsRecord,
): { sort: string | null; dir: SortDirection } {
  const requested = firstValue(input[SORT_PARAM])
  const allowed = sortableColumnKeys(config)
  if (!requested || !allowed.includes(requested)) {
    return { sort: null, dir: DEFAULT_DIRECTION }
  }
  const dir = firstValue(input[DIR_PARAM]) === 'asc' ? 'asc' : 'desc'
  return { sort: requested, dir }
}

function parseFilters(
  config: TableConfig,
  input: SearchParamsRecord,
): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const column of filterColumns(config)) {
    const value = firstValue(input[column.key])?.trim()
    if (value) filters[column.key] = value
  }
  return filters
}

export function parseTableState(
  config: TableConfig,
  input: SearchParamsRecord,
): TableState {
  const pagination = parsePagination(input)
  const { sort, dir } = parseSort(config, input)
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort,
    dir,
    filters: parseFilters(config, input),
  }
}

export function buildTableQuery(state: TableState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.page !== DEFAULT_PAGE) params.set(PAGE_PARAM, String(state.page))
  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set(PAGE_SIZE_PARAM, String(state.pageSize))
  }
  if (state.sort) {
    params.set(SORT_PARAM, state.sort)
    params.set(DIR_PARAM, state.dir)
  }
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value)
  }
  return params
}

export function tableHref(tableId: string, state: TableState): string {
  const query = buildTableQuery(state).toString()
  return query ? `/tables/${tableId}?${query}` : `/tables/${tableId}`
}
