import {
  buildFilterQueryParams,
  parseFilters,
  type AggregateFilters,
  type SearchParamsRecord,
} from '@/lib/aggregate-filters'
import { isSortMeasure } from '@/lib/aggregate-config'
import {
  appendIncludeTestExpsParam,
  INCLUDE_TEST_EXPS_PARAM,
  parseHideTestExperiments,
} from '@/lib/test-experiment-filter'
import {
  DEFAULT_HEATMAP_COLOR,
  DEFAULT_HEATMAP_X,
  DEFAULT_HEATMAP_Y,
  HEATMAP_FILTER_COLUMNS,
  isHeatmapAxis,
  type HeatmapAxis,
  type SortMeasure,
} from '@/lib/heatmap-config'

export type AxisOrderSpec =
  | { kind: 'measure'; direction: 'asc' | 'desc' }
  | { kind: 'value' }
  | {
      kind: 'group'
      groupBy: 'provider' | 'experiment_kind'
      direction: 'asc' | 'desc'
    }

export type HeatmapState = AggregateFilters & {
  x: HeatmapAxis
  y: HeatmapAxis
  color: SortMeasure
  hideTestExperiments: boolean
  /** Y-axis category keys; category keys must not contain literal commas. */
  rowOrder?: string[]
  /** X-axis category keys; category keys must not contain literal commas. */
  colOrder?: string[]
  /** Rule-based Y-axis order (e.g. measure:desc, value, group:provider). */
  rowSort?: AxisOrderSpec
  /** Rule-based X-axis order. */
  colSort?: AxisOrderSpec
}

export const HEATMAP_RESERVED_PARAMS = new Set([
  'x',
  'y',
  'color',
  'rowOrder',
  'colOrder',
  'rowSort',
  'colSort',
  'groupBy',
  'sort',
  'dir',
  'page',
  'pageSize',
  INCLUDE_TEST_EXPS_PARAM,
])

const GROUP_BY_VALUES = new Set(['provider', 'experiment_kind'])

export function parseAxisOrderSpec(
  raw: string | string[] | undefined,
): AxisOrderSpec | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return undefined

  if (value === 'value') return { kind: 'value' }

  if (value === 'measure' || value === 'measure:asc') {
    return { kind: 'measure', direction: 'asc' }
  }
  if (value === 'measure:desc') {
    return { kind: 'measure', direction: 'desc' }
  }

  if (value.startsWith('group:')) {
    const parts = value.split(':')
    const groupBy = parts[1]
    if (!groupBy || !GROUP_BY_VALUES.has(groupBy)) return undefined
    const direction = parts[2] === 'desc' ? 'desc' : 'asc'
    return {
      kind: 'group',
      groupBy: groupBy as 'provider' | 'experiment_kind',
      direction,
    }
  }

  return undefined
}

export function serializeAxisOrderSpec(
  spec: AxisOrderSpec | undefined,
): string | undefined {
  if (!spec) return undefined
  switch (spec.kind) {
    case 'value':
      return 'value'
    case 'measure':
      return spec.direction === 'desc' ? 'measure:desc' : 'measure:asc'
    case 'group':
      return spec.direction === 'desc'
        ? `group:${spec.groupBy}:desc`
        : `group:${spec.groupBy}`
  }
}

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

/** Comma-joined category keys; keys must not contain literal commas. */
function parseOrderParam(
  raw: string | string[] | undefined,
): string[] | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return undefined
  const keys = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return keys.length > 0 ? keys : undefined
}

function serializeOrderParam(keys: string[] | undefined): string | undefined {
  if (!keys || keys.length === 0) return undefined
  return keys.join(',')
}

export function parseHeatmapState(input: SearchParamsRecord): HeatmapState {
  const filters = parseFilters(input, {
    allowedColumns: HEATMAP_FILTER_COLUMNS,
    reservedParams: HEATMAP_RESERVED_PARAMS,
  })
  const x = parseAxis(input.x, DEFAULT_HEATMAP_X)
  const y = parseAxis(input.y, DEFAULT_HEATMAP_Y)
  const axes = normalizeAxes(x, y)
  const rowOrder = parseOrderParam(input.rowOrder)
  const colOrder = parseOrderParam(input.colOrder)
  const rowSort = parseAxisOrderSpec(input.rowSort)
  const colSort = parseAxisOrderSpec(input.colSort)
  return {
    ...filters,
    ...axes,
    color: parseColor(input.color),
    hideTestExperiments: parseHideTestExperiments(input),
    ...(rowOrder ? { rowOrder } : {}),
    ...(colOrder ? { colOrder } : {}),
    ...(rowSort ? { rowSort } : {}),
    ...(colSort ? { colSort } : {}),
  }
}

export function buildHeatmapQuery(state: HeatmapState): URLSearchParams {
  const params = buildFilterQueryParams(state)
  if (state.x !== DEFAULT_HEATMAP_X) params.set('x', state.x)
  if (state.y !== DEFAULT_HEATMAP_Y) params.set('y', state.y)
  if (state.color !== DEFAULT_HEATMAP_COLOR) params.set('color', state.color)
  const rowOrder = serializeOrderParam(state.rowOrder)
  if (rowOrder) params.set('rowOrder', rowOrder)
  const colOrder = serializeOrderParam(state.colOrder)
  if (colOrder) params.set('colOrder', colOrder)
  const rowSort = serializeAxisOrderSpec(state.rowSort)
  if (rowSort) params.set('rowSort', rowSort)
  const colSort = serializeAxisOrderSpec(state.colSort)
  if (colSort) params.set('colSort', colSort)
  appendIncludeTestExpsParam(params, state.hideTestExperiments)
  return params
}

export function heatmapHref(state: HeatmapState): string {
  const query = buildHeatmapQuery(state).toString()
  return query ? `/aggregate/heatmap?${query}` : '/aggregate/heatmap'
}
