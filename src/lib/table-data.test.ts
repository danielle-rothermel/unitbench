import { describe, expect, it } from 'vitest'
import { getTableConfig } from '@/lib/table-config'
import { buildCountQuery, buildSelectQuery } from '@/lib/table-data'
import { parseTableState } from '@/lib/table-params'

const config = getTableConfig('published-predictions')

describe('table query builders', () => {
  it('builds an unfiltered, default-sorted page query', () => {
    const state = parseTableState(config, {})
    expect(buildCountQuery(config, state)).toEqual({
      text: 'SELECT count(*)::int AS total FROM "published_predictions"',
      params: [],
    })
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('ORDER BY "updated_at" DESC')
    expect(select.text).toContain('LIMIT $1 OFFSET $2')
    expect(select.params).toEqual([25, 0])
  })

  it('builds facet (=) and text (ILIKE) conditions with parameter offsets', () => {
    const state = parseTableState(config, {
      page: '2',
      sort: 'score',
      dir: 'asc',
      model: 'openai/test',
      task_id: 'HumanEval',
    })
    const where =
      'WHERE "task_id" ILIKE $1 AND "model" = $2'
    expect(buildCountQuery(config, state)).toEqual({
      text: `SELECT count(*)::int AS total FROM "published_predictions" ${where}`,
      params: ['%HumanEval%', 'openai/test'],
    })
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain(where)
    expect(select.text).toContain('ORDER BY "score" ASC')
    expect(select.text).toContain('LIMIT $3 OFFSET $4')
    expect(select.params).toEqual(['%HumanEval%', 'openai/test', 25, 25])
  })
})
