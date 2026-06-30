import { describe, expect, it } from 'vitest'
import {
  buildAggregateCountQuery,
  buildAggregateQuery,
  InvalidAggregateQueryError,
} from '@/lib/aggregate-data'
import type { AggregateState } from '@/lib/aggregate-data'

const baseState: AggregateState = {
  groupBy: ['model', 'experiment_kind'],
  sort: 'avg_score',
  dir: 'asc',
  page: 1,
  pageSize: 100,
  filterIn: {},
  filterOut: {},
}

describe('aggregate query builders', () => {
  it('builds an unfiltered group-by query with default sort', () => {
    expect(buildAggregateCountQuery(baseState)).toEqual({
      text: 'SELECT count(*)::int AS total FROM (SELECT 1 FROM "published_predictions" GROUP BY "model", "experiment_kind") AS grouped',
      params: [],
    })
    const select = buildAggregateQuery(baseState)
    expect(select.text).toContain(
      'SELECT "model", "experiment_kind", count(*)::int AS n, avg(score) AS avg_score',
    )
    expect(select.text).toContain('GROUP BY "model", "experiment_kind"')
    expect(select.text).toContain('ORDER BY "avg_score" ASC')
    expect(select.text).toContain('LIMIT $1 OFFSET $2')
    expect(select.params).toEqual([100, 0])
  })

  it('builds filter-in and filter-out conditions with parameter offsets', () => {
    const state: AggregateState = {
      ...baseState,
      page: 2,
      filterIn: { model: ['openai/test'] },
      filterOut: { experiment_kind: ['humaneval_direct'] },
    }
    const where =
      'WHERE "model" = ANY($1::text[]) AND ("experiment_kind" IS NULL OR "experiment_kind" <> ALL($2::text[]))'
    expect(buildAggregateCountQuery(state)).toEqual({
      text: `SELECT count(*)::int AS total FROM (SELECT 1 FROM "published_predictions" ${where} GROUP BY "model", "experiment_kind") AS grouped`,
      params: [['openai/test'], ['humaneval_direct']],
    })
    const select = buildAggregateQuery(state)
    expect(select.text).toContain(where)
    expect(select.text).toContain('LIMIT $3 OFFSET $4')
    expect(select.params).toEqual([
      ['openai/test'],
      ['humaneval_direct'],
      100,
      100,
    ])
  })

  it('rejects disallowed group-by columns', () => {
    expect(() =>
      buildAggregateQuery({
        ...baseState,
        groupBy: ['prediction_id'],
      }),
    ).toThrow(InvalidAggregateQueryError)
  })

  it('rejects empty group-by', () => {
    expect(() =>
      buildAggregateQuery({
        ...baseState,
        groupBy: [],
      }),
    ).toThrow(InvalidAggregateQueryError)
  })
})
