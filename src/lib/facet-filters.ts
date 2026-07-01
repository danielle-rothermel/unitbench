import type { AggregateFilters } from '@/lib/aggregate-filters'

export type SqlQuery = {
  text: string
  params: unknown[]
}

export type FacetWhereParts = {
  conditions: string[]
  params: unknown[]
}

export type FacetFilterExpression = (column: string) => string

export function buildFacetWhereParts(
  filters: AggregateFilters,
  allowedColumns: readonly string[],
  filterExpression: FacetFilterExpression,
  paramOffset = 0,
): FacetWhereParts {
  const allowed = new Set(allowedColumns)
  const conditions: string[] = []
  const params: unknown[] = []

  for (const [rawColumn, values] of Object.entries(filters.filterIn)) {
    if (values.length === 0) continue
    if (!allowed.has(rawColumn)) continue
    params.push(values)
    conditions.push(
      `${filterExpression(rawColumn)} = ANY($${paramOffset + params.length}::text[])`,
    )
  }

  for (const [rawColumn, values] of Object.entries(filters.filterOut)) {
    if (values.length === 0) continue
    if (!allowed.has(rawColumn)) continue
    params.push(values)
    const expression = filterExpression(rawColumn)
    conditions.push(
      `(${expression} IS NULL OR ${expression} <> ALL($${paramOffset + params.length}::text[]))`,
    )
  }

  return { conditions, params }
}

export function buildFacetWhere(
  filters: AggregateFilters,
  allowedColumns: readonly string[],
  filterExpression: FacetFilterExpression,
  paramOffset = 0,
): SqlQuery {
  const { conditions, params } = buildFacetWhereParts(
    filters,
    allowedColumns,
    filterExpression,
    paramOffset,
  )
  const text = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return { text, params }
}
