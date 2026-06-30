import {
  buildFilterQueryParams,
  parseFilters,
  type AggregateFilters,
  type SearchParamsRecord,
} from '@/lib/aggregate-filters'
import { isSortMeasure } from '@/lib/aggregate-config'
import {
  DEFAULT_HEATMAP_COLOR,
  DEFAULT_HEATMAP_X,
  DEFAULT_HEATMAP_Y,
  HEATMAP_FILTER_COLUMNS,
  isHeatmapAxis,
  type HeatmapAxis,
  type SortMeasure,
} from '@/lib/heatmap-config'

export type HeatmapState = AggregateFilters & {
  x: HeatmapAxis
  y: HeatmapAxis
  color: SortMeasure
}

export const HEATMAP_RESERVED_PARAMS = new Set([
  'x',
  'y',
  'color',
  'groupBy',
  'sort',
  'dir',
  'page',
  'pageSize',
])

function parseAxis(
  raw: string | string[] | undefined,
  fallback: HeatmapAxis,
): HeatmapAxis {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && isHeatmapAxis(value)) return value
  return fallback
}

function parseColor(
  raw: string | string[] | undefined,
): SortMeasure {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && isSortMeasure(value)) return value
  return DEFAULT_HEATMAP_COLOR
}

function normalizeAxes(x: HeatmapAxis, y: HeatmapAxis): { x: HeatmapAxis; y: HeatmapAxis } {
  if (x === y) {
    return { x, y: DEFAULT_HEATMAP_Y === x ? DEFAULT_HEATMAP_X : DEFAULT_HEATMAP_Y }
  }
  return { x, y }
}

export function parseHeatmapState(input: SearchParamsRecord): HeatmapState {
  const filters = parseFilters(input, {
    allowedColumns: HEATMAP_FILTER_COLUMNS,
    reservedParams: HEATMAP_RESERVED_PARAMS,
  })
  const x = parseAxis(input.x, DEFAULT_HEATMAP_X)
  const y = parseAxis(input.y, DEFAULT_HEATMAP_Y)
  const axes = normalizeAxes(x, y)
  return {
    ...filters,
    ...axes,
    color: parseColor(input.color),
  }
}

export function buildHeatmapQuery(state: HeatmapState): URLSearchParams {
  const params = buildFilterQueryParams(state)
  if (state.x !== DEFAULT_HEATMAP_X) params.set('x', state.x)
  if (state.y !== DEFAULT_HEATMAP_Y) params.set('y', state.y)
  if (state.color !== DEFAULT_HEATMAP_COLOR) params.set('color', state.color)
  return params
}

export function heatmapHref(state: HeatmapState): string {
  const query = buildHeatmapQuery(state).toString()
  return query ? `/aggregate/heatmap?${query}` : '/aggregate/heatmap'
}
