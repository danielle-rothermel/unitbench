import { describe, expect, it } from 'vitest'
import {
  buildAggregateCountQuery,
  buildAggregateQuery,
  buildHeatmapQuerySql,
  InvalidAggregateQueryError,
} from '@/lib/aggregate-data'
import type { AggregateState } from '@/lib/aggregate-data'
import { CANONICAL_MODEL_SQL } from '@/lib/canonical-model'
import { BUDGET_DIMENSION_SQL } from '@/lib/heatmap-config'
import { parseHeatmapState } from '@/lib/heatmap-params'
import { testExperimentPatterns } from '@/lib/test-experiment-filter'

const patterns = testExperimentPatterns()
const scalarTestExperimentPredicate = (offset: number): string =>
  `NOT (${patterns.map((_, index) => `"experiment_id" ILIKE $${offset + index}`).join(' OR ')})`

const baseState: AggregateState = {
  groupBy: ['model', 'experiment_kind'],
  sort: 'avg_score',
  dir: 'asc',
  page: 1,
  pageSize: 100,
  filterIn: {},
  filterOut: {},
  hideTestExperiments: true,
}

describe('aggregate query builders', () => {
  it('builds an unfiltered group-by query with canonical model', () => {
    const count = buildAggregateCountQuery(baseState)
    expect(count.text).toContain(CANONICAL_MODEL_SQL)
    expect(count.text).toContain(scalarTestExperimentPredicate(1))
    expect(count.text).toContain('GROUP BY')
    expect(count.text).toContain('"experiment_kind"')
    expect(count.params).toEqual(patterns)

    const select = buildAggregateQuery(baseState)
    expect(select.params).toEqual([...patterns, 100, 0])
    expect(select.text).toContain(CANONICAL_MODEL_SQL)
    expect(select.text).toContain('AS "model"')
    expect(select.text).toContain('"experiment_kind"')
    expect(select.text).toContain('_cluster_sort')
    expect(select.text).toContain(scalarTestExperimentPredicate(1))
    expect(select.text).toContain('LIMIT $8 OFFSET $9')
    expect(select.params).toEqual([...patterns, 100, 0])
  })

  it('builds canonical model filter conditions with parameter offsets', () => {
    const state: AggregateState = {
      ...baseState,
      page: 2,
      filterIn: { model: ['openai/test'] },
      filterOut: { experiment_kind: ['humaneval_direct'] },
    }
    const count = buildAggregateCountQuery(state)
    expect(count.text).toContain(`${CANONICAL_MODEL_SQL} = $1`)
    expect(count.text).toContain(
      '("experiment_kind" IS NULL OR NOT ("experiment_kind" = $2))',
    )
    expect(count.text).toContain(scalarTestExperimentPredicate(3))
    expect(count.params).toEqual([
      'openai/test',
      'humaneval_direct',
      ...patterns,
    ])

    const select = buildAggregateQuery(state)
    expect(select.text).toContain(scalarTestExperimentPredicate(3))
    expect(select.text).toContain('LIMIT $10 OFFSET $11')
    expect(select.params).toEqual([
      'openai/test',
      'humaneval_direct',
      ...patterns,
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

  it('builds heatmap query with budget axis and filters', () => {
    const state = parseHeatmapState({
      x: 'budget',
      y: 'model',
      color: 'pass_rate',
      budget: '0.5',
    })
    const query = buildHeatmapQuerySql(state)
    expect(query.text).toContain(CANONICAL_MODEL_SQL)
    expect(query.text).toContain(BUDGET_DIMENSION_SQL)
    expect(query.text).toContain('_cluster_sort')
    expect(query.text).toContain('"pass_rate"')
    expect(query.text).toContain(scalarTestExperimentPredicate(2))
    expect(query.params).toEqual(['0.5', ...patterns, 10_000, 0])
  })

  it('omits test experiment filter when includeTestExps=1', () => {
    const state = parseHeatmapState({ includeTestExps: '1' })
    const query = buildHeatmapQuerySql(state)
    expect(query.text).not.toContain('"experiment_id" ILIKE')
  })

  it('rejects matching heatmap axes', () => {
    expect(() =>
      buildHeatmapQuerySql({
        ...parseHeatmapState({}),
        x: 'model',
        y: 'model',
      }),
    ).toThrow(InvalidAggregateQueryError)
  })
})
