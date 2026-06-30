import {
  buildFilterQueryParams,
  parseAggregateFilters,
  type AggregateFilters,
  type SearchParamsRecord,
} from '@/lib/aggregate-filters'

export type HeatmapState = AggregateFilters

export function parseHeatmapState(input: SearchParamsRecord): HeatmapState {
  return parseAggregateFilters(input)
}

export function buildHeatmapQuery(state: HeatmapState): URLSearchParams {
  return buildFilterQueryParams(state)
}

export function heatmapHref(state: HeatmapState): string {
  const query = buildHeatmapQuery(state).toString()
  return query ? `/aggregate/heatmap?${query}` : '/aggregate/heatmap'
}
