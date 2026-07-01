import { EXCLUDE_PREFIX } from '@/lib/aggregate-filters'
import { aggregateHref, parseAggregateState } from '@/lib/aggregate-params'
import type { AggregateState } from '@/lib/aggregate-data'
import { BUDGET_URL_PARAM, type HeatmapAxis } from '@/lib/heatmap-config'
import type { HeatmapState } from '@/lib/heatmap-params'
import { getTableConfig } from '@/lib/table-config'
import {
  buildTableQuery,
  parseTableState,
  type TableState,
} from '@/lib/table-params'

export const PREDICTIONS_TABLE_ID = 'published-predictions'

export type PredictionsTableHrefOptions = {
  sort?: { column: string; dir: 'asc' | 'desc' }
  exclude?: Record<string, string[]>
  textFilters?: Record<string, string>
  page?: number
}

function appendExcludeParams(
  params: URLSearchParams,
  exclude: Record<string, string[]>,
): void {
  for (const [key, values] of Object.entries(exclude)) {
    for (const value of values) {
      params.append(`${EXCLUDE_PREFIX}${key}`, value)
    }
  }
}

export function predictionsTableHref(
  filters: Record<string, string | string[]>,
  options?: PredictionsTableHrefOptions,
): string {
  const config = getTableConfig(PREDICTIONS_TABLE_ID)
  const input: Record<string, string | string[] | undefined> = { ...filters }

  if (options?.textFilters) {
    for (const [key, value] of Object.entries(options.textFilters)) {
      input[key] = value
    }
  }

  let state = parseTableState(config, input)
  if (options?.page) state = { ...state, page: options.page }
  if (options?.sort) {
    state = {
      ...state,
      sort: options.sort.column,
      dir: options.sort.dir,
      page: 1,
    }
  }

  const params = buildTableQuery(state)
  if (options?.exclude) appendExcludeParams(params, options.exclude)

  const query = params.toString()
  return query
    ? `/tables/${PREDICTIONS_TABLE_ID}?${query}`
    : `/tables/${PREDICTIONS_TABLE_ID}`
}

function axisFilterKey(axis: HeatmapAxis): string {
  return axis === 'budget' ? BUDGET_URL_PARAM : axis
}

export function aggregateRowPredictionsHref(
  aggregateState: AggregateState,
  row: Record<string, unknown>,
): string {
  const filters: Record<string, string | string[]> = {}

  for (const column of aggregateState.groupBy) {
    const value = row[column]
    if (value != null && value !== '') filters[column] = String(value)
  }

  for (const [key, values] of Object.entries(aggregateState.filterIn)) {
    if (values.length === 1) filters[key] = values[0]!
    else if (values.length > 1) filters[key] = values
  }

  return predictionsTableHref(filters, {
    sort: { column: 'score', dir: 'asc' },
    exclude: aggregateState.filterOut,
  })
}

export function heatmapCellPredictionsHref(
  state: HeatmapState,
  yVal: string,
  xVal: string,
): string {
  const filters: Record<string, string | string[]> = {}

  filters[axisFilterKey(state.y)] = yVal
  filters[axisFilterKey(state.x)] = xVal

  for (const [key, values] of Object.entries(state.filterIn)) {
    if (values.length === 1) filters[key] = values[0]!
    else if (values.length > 1) filters[key] = values
  }

  return predictionsTableHref(filters, {
    sort: { column: 'score', dir: 'asc' },
    exclude: state.filterOut,
  })
}

export function experimentPredictionsHref(experimentId: string): string {
  return predictionsTableHref({}, { textFilters: { experiment_id: experimentId } })
}

export function hasActiveTableFilters(state: TableState): boolean {
  return (
    Object.keys(state.filters).length > 0 ||
    Object.keys(state.filterIn).length > 0 ||
    Object.keys(state.filterOut).length > 0 ||
    Object.keys(state.ranges).length > 0
  )
}

export function predictionsExploreAggregateHref(state: TableState): string {
  const params: Record<string, string | string[] | undefined> = {
    groupBy: 'model,experiment_kind',
  }

  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params[key] = value
  }
  for (const [key, values] of Object.entries(state.filterIn)) {
    if (values.length > 0) params[key] = values
  }
  for (const [key, values] of Object.entries(state.filterOut)) {
    for (const value of values) {
      const paramKey = `${EXCLUDE_PREFIX}${key}`
      const existing = params[paramKey]
      if (!existing) params[paramKey] = value
      else if (Array.isArray(existing)) existing.push(value)
      else params[paramKey] = [existing, value]
    }
  }

  return aggregateHref(parseAggregateState(params))
}
