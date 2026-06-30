import { isFilterColumn } from '@/lib/aggregate-config'

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
])

function allValues(value: string | string[] | undefined): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : [value])
    .map(item => item.trim())
    .filter(Boolean)
}

function parseFilterMap(
  input: SearchParamsRecord,
  mode: 'in' | 'out',
): Record<string, string[]> {
  const filters: Record<string, string[]> = {}
  for (const [key, rawValue] of Object.entries(input)) {
    if (mode === 'in') {
      if (AGGREGATE_RESERVED_PARAMS.has(key) || key.startsWith(EXCLUDE_PREFIX)) {
        continue
      }
      if (!isFilterColumn(key)) continue
      const values = allValues(rawValue)
      if (values.length > 0) filters[key] = values
      continue
    }

    if (!key.startsWith(EXCLUDE_PREFIX)) continue
    const column = key.slice(EXCLUDE_PREFIX.length)
    if (!isFilterColumn(column)) continue
    const values = allValues(rawValue)
    if (values.length > 0) filters[column] = values
  }
  return filters
}

export function parseAggregateFilters(input: SearchParamsRecord): AggregateFilters {
  return {
    filterIn: parseFilterMap(input, 'in'),
    filterOut: parseFilterMap(input, 'out'),
  }
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
