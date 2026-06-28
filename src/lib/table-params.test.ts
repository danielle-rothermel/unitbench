import { describe, expect, it } from 'vitest'
import { getTableConfig } from '@/lib/table-config'
import { buildTableQuery, parseTableState } from '@/lib/table-params'

const config = getTableConfig('published-predictions')

describe('parseTableState', () => {
  it('returns defaults for empty params', () => {
    expect(parseTableState(config, {})).toEqual({
      page: 1,
      pageSize: 25,
      sort: null,
      dir: 'desc',
      filters: {},
    })
  })

  it('parses sort, direction, and configured filters', () => {
    const state = parseTableState(config, {
      page: '3',
      sort: 'score',
      dir: 'asc',
      model: 'openai/test',
      task_id: 'HumanEval',
      bogus: 'ignored',
    })
    expect(state).toEqual({
      page: 3,
      pageSize: 25,
      sort: 'score',
      dir: 'asc',
      filters: { task_id: 'HumanEval', model: 'openai/test' },
    })
  })

  it('drops a sort column that is not allowlisted as sortable', () => {
    const state = parseTableState(config, { sort: 'prediction_id', dir: 'asc' })
    expect(state.sort).toBeNull()
    expect(state.dir).toBe('desc')
  })
})

describe('buildTableQuery', () => {
  it('omits defaults and round-trips non-default state', () => {
    const state = parseTableState(config, {
      page: '2',
      sort: 'score',
      dir: 'asc',
      model: 'gpt',
    })
    expect(buildTableQuery(state).toString()).toBe(
      'page=2&sort=score&dir=asc&model=gpt',
    )
  })

  it('produces an empty query for default state', () => {
    expect(buildTableQuery(parseTableState(config, {})).toString()).toBe('')
  })
})
