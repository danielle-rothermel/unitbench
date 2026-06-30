import {
  DEFAULT_AGGREGATE_PAGE_SIZE,
  DEFAULT_GROUP_BY,
  DEFAULT_SORT,
  DEFAULT_SORT_DIR,
  isGroupByColumn,
  isSortMeasure,
  type SortMeasure,
} from '@/lib/aggregate-config'
import {
  buildFilterQueryParams,
  parseAggregateFilters,
  type SearchParamsRecord,
} from '@/lib/aggregate-filters'
import type { AggregateState } from '@/lib/aggregate-data'
import {
  DEFAULT_PAGE,
  MAX_PAGE_SIZE,
  parsePagination,
} from '@/lib/pagination'
import type { SortDirection, TableState } from '@/lib/table-params'

export type { SearchParamsRecord } from '@/lib/aggregate-filters'

const GROUP_BY_PARAM = 'groupBy'
const SORT_PARAM = 'sort'
const DIR_PARAM = 'dir'
const PAGE_PARAM = 'page'
const PAGE_SIZE_PARAM = 'pageSize'

function firstValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() || undefined
}

function parseGroupBy(input: SearchParamsRecord): string[] {
  const raw = firstValue(input[GROUP_BY_PARAM])
  if (!raw) return [...DEFAULT_GROUP_BY]
  const columns = raw
    .split(',')
    .map(item => item.trim())
    .filter(isGroupByColumn)
  return columns.length > 0 ? columns : [...DEFAULT_GROUP_BY]
}

function parseSort(input: SearchParamsRecord): {
  sort: SortMeasure
  dir: SortDirection
} {
  const requested = firstValue(input[SORT_PARAM])
  const sort = requested && isSortMeasure(requested) ? requested : DEFAULT_SORT
  const dir = firstValue(input[DIR_PARAM]) === 'desc' ? 'desc' : DEFAULT_SORT_DIR
  return { sort, dir }
}

function parsePaginationForAggregate(input: SearchParamsRecord): {
  page: number
  pageSize: number
} {
  const pagination = parsePagination(input)
  const rawPageSize = firstValue(input[PAGE_SIZE_PARAM])
  const parsedPageSize = rawPageSize
    ? Number.parseInt(rawPageSize, 10)
    : DEFAULT_AGGREGATE_PAGE_SIZE
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
      : DEFAULT_AGGREGATE_PAGE_SIZE
  return { page: pagination.page, pageSize }
}

export function parseAggregateState(
  input: SearchParamsRecord,
): AggregateState {
  const { page, pageSize } = parsePaginationForAggregate(input)
  const { sort, dir } = parseSort(input)
  const filters = parseAggregateFilters(input)
  return {
    groupBy: parseGroupBy(input),
    sort,
    dir,
    page,
    pageSize,
    ...filters,
  }
}

export function buildAggregateQueryParams(
  state: AggregateState,
): URLSearchParams {
  const params = buildFilterQueryParams(state)
  const defaultGroupBy = DEFAULT_GROUP_BY.join(',')
  const currentGroupBy = state.groupBy.join(',')
  if (currentGroupBy !== defaultGroupBy) {
    params.set(GROUP_BY_PARAM, currentGroupBy)
  }
  if (state.page !== DEFAULT_PAGE) params.set(PAGE_PARAM, String(state.page))
  if (state.pageSize !== DEFAULT_AGGREGATE_PAGE_SIZE) {
    params.set(PAGE_SIZE_PARAM, String(state.pageSize))
  }
  if (state.sort !== DEFAULT_SORT) params.set(SORT_PARAM, state.sort)
  if (state.dir !== DEFAULT_SORT_DIR) params.set(DIR_PARAM, state.dir)
  return params
}

export function aggregateHref(state: AggregateState): string {
  const query = buildAggregateQueryParams(state).toString()
  return query ? `/aggregate?${query}` : '/aggregate'
}

export function aggregateStateToTableState(state: AggregateState) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    dir: state.dir,
    filters: {},
  }
}

export function tableStateToAggregateState(
  aggregate: AggregateState,
  table: TableState,
): AggregateState {
  const sort =
    table.sort && isSortMeasure(table.sort) ? table.sort : DEFAULT_SORT
  return {
    ...aggregate,
    page: table.page,
    pageSize: table.pageSize,
    sort,
    dir: table.dir,
  }
}
