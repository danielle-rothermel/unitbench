import { describe, expect, it } from 'vitest'
import { getTableConfig } from '@/lib/table-config'
import {
  orderBySql,
  qualifiedTableName,
  quoteIdentifier,
  selectedColumnSql,
} from '@/lib/sql-identifiers'
import { buildCountQuery, buildSelectQuery } from '@/lib/table-data'
import { parseTableState } from '@/lib/table-params'
import { testExperimentPatterns } from '@/lib/test-experiment-filter'

const patterns = testExperimentPatterns()

describe('SQL identifier helpers', () => {
  it('quotes valid identifiers', () => {
    expect(quoteIdentifier('published_predictions')).toBe(
      '"published_predictions"',
    )
  })

  it('rejects invalid identifiers', () => {
    expect(() => quoteIdentifier('published_predictions;drop')).toThrow(
      'Invalid SQL identifier',
    )
  })

  it('builds query fragments from allowlisted config values', () => {
    const config = getTableConfig('published-predictions')
    expect(qualifiedTableName(config.table)).toBe('"published_predictions"')
    expect(selectedColumnSql(config)).toContain('"prediction_id"')
    expect(orderBySql(config)).toBe('"updated_at" DESC')
  })

  it('builds paginated select and count SQL', () => {
    const config = getTableConfig('published-experiments')
    const state = parseTableState(config, {})
    expect(buildCountQuery(config, state)).toEqual({
      text:
        'SELECT count(*)::int AS total FROM "published_experiments" WHERE NOT ("experiment_id" ILIKE ANY($1::text[]) OR "display_name" ILIKE ANY($1::text[]))',
      params: [patterns],
    })
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('LIMIT $2 OFFSET $3')
    expect(select.params).toEqual([patterns, 25, 0])
  })
})
