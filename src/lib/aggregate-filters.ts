import { FILTER_COLUMNS } from '@/lib/aggregate-config'
import { INCLUDE_TEST_EXPS_PARAM } from '@/lib/test-experiment-filter'

export type AggregateFilters = {
  filterIn: Record<string, string[]>
  filterOut: Record<string, string[]>
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>

export const EXCLUDE_PREFIX = 'exclude.'

export const AGGREGATE_RESERVED_PARAMS = new Set([
  'groupBy',
  'sort',
  'dir',
  'page',
  'pageSize',
  INCLUDE_TEST_EXPS_PARAM,
])

function allValues(value: string | string[] | undefined): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : [value])
    .map(item => item.trim())
    .filter(Boolean)
}

export function parseFilters(
  input: SearchParamsRecord,
  options: {
    allowedColumns: readonly string[]
    reservedParams: Set<string>
  },
): AggregateFilters {
  const allowed = new Set(options.allowedColumns)

  const parseMap = (mode: 'in' | 'out'): Record<string, string[]> => {
    const result: Record<string, string[]> = {}
    for (const [key, rawValue] of Object.entries(input)) {
      if (mode === 'in') {
        if (options.reservedParams.has(key) || key.startsWith(EXCLUDE_PREFIX)) {
          continue
        }
        if (!allowed.has(key)) continue
        const values = allValues(rawValue)
        if (values.length > 0) result[key] = values
        continue
      }

      if (!key.startsWith(EXCLUDE_PREFIX)) continue
      const column = key.slice(EXCLUDE_PREFIX.length)
      if (!allowed.has(column)) continue
      const values = allValues(rawValue)
      if (values.length > 0) result[column] = values
    }
    return result
  }

  return {
    filterIn: parseMap('in'),
    filterOut: parseMap('out'),
  }
}

export function parseAggregateFilters(input: SearchParamsRecord): AggregateFilters {
  return parseFilters(input, {
    allowedColumns: FILTER_COLUMNS,
    reservedParams: AGGREGATE_RESERVED_PARAMS,
  })
}

export function buildFilterQueryParams(filters: AggregateFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(filters.filterIn)) {
    for (const value of values) params.append(key, value)
  }
  for (const [key, values] of Object.entries(filters.filterOut)) {
    for (const value of values) params.append(`${EXCLUDE_PREFIX}${key}`, value)
  }
  return params
}

export function hasActiveFilters(filters: AggregateFilters): boolean {
  return (
    Object.keys(filters.filterIn).length > 0 ||
    Object.keys(filters.filterOut).length > 0
  )
}
