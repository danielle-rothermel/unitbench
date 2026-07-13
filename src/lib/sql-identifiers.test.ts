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
const scalarMatches = (expression: string, offset: number): string =>
  patterns.map((_, index) => `${expression} ILIKE $${offset + index}`).join(' OR ')

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
    const config = getTableConfig('predictions')
    expect(qualifiedTableName(config.table)).toBe('"predictions"')
    expect(selectedColumnSql(config)).toContain('"prediction_id"')
    expect(orderBySql(config)).toBe('"updated_at" DESC')
  })

  it('builds paginated select and count SQL', () => {
    const config = getTableConfig('experiments')
    const state = parseTableState(config, {})
    expect(buildCountQuery(config, state)).toEqual({
      text:
        `SELECT count(*)::int AS total FROM "experiments" WHERE NOT ((${scalarMatches('"experiment_id"', 1)}) OR (${scalarMatches('"display_name"', 1)}))`,
      params: patterns,
    })
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('LIMIT $8 OFFSET $9')
    expect(select.params).toEqual([...patterns, 25, 0])
  })
})
