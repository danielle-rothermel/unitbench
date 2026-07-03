import {
  buildFilterQueryParams,
  EXCLUDE_PREFIX,
  parseFilters,
  type AggregateFilters,
} from '@/lib/aggregate-filters'
import {
  BUDGET_URL_PARAM,
} from '@/lib/heatmap-config'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePagination,
} from '@/lib/pagination'
import {
  appendIncludeTestExpsParam,
  INCLUDE_TEST_EXPS_PARAM,
  parseHideTestExperiments,
} from '@/lib/test-experiment-filter'
import {
  filterColumns,
  sortableColumnKeys,
  type TableColumn,
  type TableConfig,
} from '@/lib/table-config'

export type SortDirection = 'asc' | 'desc'

export type RangeFilter = {
  min?: number
  max?: number
}

export type TableState = {
  page: number
  pageSize: number
  sort: string | null
  dir: SortDirection
  filters: Record<string, string>
  filterIn: Record<string, string[]>
  filterOut: Record<string, string[]>
  ranges: Record<string, RangeFilter>
  hideTestExperiments: boolean
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>

const SORT_PARAM = 'sort'
const DIR_PARAM = 'dir'
const PAGE_PARAM = 'page'
const PAGE_SIZE_PARAM = 'pageSize'
const DEFAULT_DIRECTION: SortDirection = 'desc'

const TABLE_RESERVED_PARAMS = new Set([
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  SORT_PARAM,
  DIR_PARAM,
  INCLUDE_TEST_EXPS_PARAM,
])

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

function textFilterColumns(config: TableConfig): TableColumn[] {
  return filterColumns(config).filter(column => column.filter === 'text')
}

function facetFilterColumns(config: TableConfig): string[] {
  return filterColumns(config)
    .filter(column => column.filter === 'facet')
    .map(column => column.key)
}

function rangeFilterColumns(config: TableConfig): string[] {
  return filterColumns(config)
    .filter(column => column.filter === 'range')
    .map(column => column.key)
}

function parseTextFilters(
  config: TableConfig,
  input: SearchParamsRecord,
): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const column of textFilterColumns(config)) {
    const value = firstValue(input[column.key])?.trim()
    if (value) filters[column.key] = value
  }
  const budget = firstValue(input[BUDGET_URL_PARAM])?.trim()
  if (budget) filters[BUDGET_URL_PARAM] = budget
  return filters
}

function parseRangeFilters(
  config: TableConfig,
  input: SearchParamsRecord,
): Record<string, RangeFilter> {
  const ranges: Record<string, RangeFilter> = {}
  for (const key of rangeFilterColumns(config)) {
    const minRaw = firstValue(input[`${key}_min`])
    const maxRaw = firstValue(input[`${key}_max`])
    const min =
      minRaw !== undefined && minRaw !== ''
        ? Number.parseFloat(minRaw)
        : undefined
    const max =
      maxRaw !== undefined && maxRaw !== ''
        ? Number.parseFloat(maxRaw)
        : undefined
    if (min !== undefined && Number.isFinite(min)) {
      ranges[key] = { ...ranges[key], min }
    }
    if (max !== undefined && Number.isFinite(max)) {
      ranges[key] = { ...ranges[key], max }
    }
  }
  return ranges
}

function tableFilterAllowlist(config: TableConfig): string[] {
  return [...facetFilterColumns(config), BUDGET_URL_PARAM]
}

export function parseTableState(
  config: TableConfig,
  input: SearchParamsRecord,
): TableState {
  const pagination = parsePagination(input)
  const { sort, dir } = parseSort(config, input)
  const facetFilters = parseFilters(input, {
    allowedColumns: tableFilterAllowlist(config),
    reservedParams: TABLE_RESERVED_PARAMS,
  })
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort,
    dir,
    filters: parseTextFilters(config, input),
    filterIn: facetFilters.filterIn,
    filterOut: facetFilters.filterOut,
    ranges: parseRangeFilters(config, input),
    hideTestExperiments: parseHideTestExperiments(input),
  }
}

export function buildTableQuery(state: TableState): URLSearchParams {
  const params = buildFilterQueryParams({
    filterIn: state.filterIn,
    filterOut: state.filterOut,
  })
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
  for (const [key, range] of Object.entries(state.ranges)) {
    if (range.min !== undefined) params.set(`${key}_min`, String(range.min))
    if (range.max !== undefined) params.set(`${key}_max`, String(range.max))
  }
  appendIncludeTestExpsParam(params, state.hideTestExperiments)
  return params
}

export function tableHref(tableId: string, state: TableState): string {
  const query = buildTableQuery(state).toString()
  return query ? `/tables/${tableId}?${query}` : `/tables/${tableId}`
}

export function tableFacetFilters(state: TableState): AggregateFilters {
  return {
    filterIn: state.filterIn,
    filterOut: state.filterOut,
  }
}

export { EXCLUDE_PREFIX }
