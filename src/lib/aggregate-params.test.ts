import { describe, expect, it } from 'vitest'
import {
  aggregateHref,
  buildAggregateQueryParams,
  parseAggregateState,
} from '@/lib/aggregate-params'

describe('aggregate params', () => {
  it('parses defaults when search params are empty', () => {
    expect(parseAggregateState({})).toEqual({
      groupBy: ['model'],
      sort: 'avg_score',
      dir: 'asc',
      page: 1,
      pageSize: 100,
      filterIn: {},
      filterOut: {},
    })
  })

  it('parses group-by, sort, pagination, and filters', () => {
    expect(
      parseAggregateState({
        groupBy: 'model,experiment_kind',
        sort: 'n',
        dir: 'desc',
        page: '2',
        pageSize: '50',
        model: ['openai/test', 'openai/other'],
        'exclude.experiment_kind': 'humaneval_direct',
      }),
    ).toEqual({
      groupBy: ['model', 'experiment_kind'],
      sort: 'n',
      dir: 'desc',
      page: 2,
      pageSize: 50,
      filterIn: { model: ['openai/test', 'openai/other'] },
      filterOut: { experiment_kind: ['humaneval_direct'] },
    })
  })

  it('omits default values from serialized URLs', () => {
    expect(buildAggregateQueryParams(parseAggregateState({})).toString()).toBe('')
    expect(aggregateHref(parseAggregateState({}))).toBe('/aggregate')
  })

  it('round-trips non-default state through build and parse', () => {
    const state = parseAggregateState({
      groupBy: 'model,task_id',
      model: 'openai/gpt-5.4-nano',
      'exclude.experiment_kind': 'humaneval_encdec',
      page: '2',
    })
    const href = aggregateHref(state)
    expect(href).toContain('groupBy=model%2Ctask_id')
    expect(href).toContain('model=openai%2Fgpt-5.4-nano')
    expect(href).toContain('exclude.experiment_kind=humaneval_encdec')
    expect(href).toContain('page=2')
  })
})
