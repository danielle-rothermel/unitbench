import { describe, expect, it } from 'vitest'
import {
  buildAggregateCountQuery,
  buildAggregateQuery,
  InvalidAggregateQueryError,
} from '@/lib/aggregate-data'
import type { AggregateState } from '@/lib/aggregate-data'
import { CANONICAL_MODEL_SQL } from '@/lib/canonical-model'

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
  it('builds an unfiltered group-by query with canonical model', () => {
    const count = buildAggregateCountQuery(baseState)
    expect(count.text).toContain(CANONICAL_MODEL_SQL)
    expect(count.text).toContain('GROUP BY')
    expect(count.text).toContain('"experiment_kind"')
    expect(count.params).toEqual([])

    const select = buildAggregateQuery(baseState)
    expect(select.text).toContain(CANONICAL_MODEL_SQL)
    expect(select.text).toContain('AS "model"')
    expect(select.text).toContain('"experiment_kind"')
    expect(select.text).toContain('_cluster_sort')
    expect(select.text).toContain('LIMIT $1 OFFSET $2')
    expect(select.params).toEqual([100, 0])
  })

  it('builds canonical model filter conditions with parameter offsets', () => {
    const state: AggregateState = {
      ...baseState,
      page: 2,
      filterIn: { model: ['openai/test'] },
      filterOut: { experiment_kind: ['humaneval_direct'] },
    }
    const count = buildAggregateCountQuery(state)
    expect(count.text).toContain(`${CANONICAL_MODEL_SQL} = ANY($1::text[])`)
    expect(count.text).toContain(
      '("experiment_kind" IS NULL OR "experiment_kind" <> ALL($2::text[]))',
    )
    expect(count.params).toEqual([['openai/test'], ['humaneval_direct']])

    const select = buildAggregateQuery(state)
    expect(select.text).toContain('LIMIT $3 OFFSET $4')
    expect(select.params).toEqual([
      ['openai/test'],
      ['humaneval_direct'],
      100,
      100,
    ])
  })

  it('uses clustered ordering when multiple group-by columns are selected', () => {
    const select = buildAggregateQuery(baseState)
    expect(select.text).toContain('_cluster_sort')
    expect(select.text).toContain('PARTITION BY grouped."model"')
    expect(select.text).toContain(
      'ORDER BY ranked._cluster_sort ASC, ranked."experiment_kind" ASC',
    )
  })

  it('uses measure ordering when only one group-by column is selected', () => {
    const state: AggregateState = {
      ...baseState,
      groupBy: ['experiment_kind'],
    }
    const select = buildAggregateQuery(state)
    expect(select.text).toContain('SELECT "experiment_kind"')
    expect(select.text).toContain('ORDER BY "avg_score" ASC')
    expect(select.text).not.toContain('_cluster_sort')
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
