import { describe, expect, it } from 'vitest'
import { getTableConfig } from '@/lib/table-config'
import { CANONICAL_MODEL_SQL } from '@/lib/canonical-model'
import { buildCountQuery, buildSelectQuery } from '@/lib/table-data'
import { testExperimentPatterns } from '@/lib/test-experiment-filter'
import { parseTableState } from '@/lib/table-params'

const config = getTableConfig('predictions')
const experimentsConfig = getTableConfig('experiments')
const detailsConfig = getTableConfig('detail-predictions')
const patterns = testExperimentPatterns()
const scalarMatches = (expression: string, offset: number): string =>
  patterns.map((_, index) => `${expression} ILIKE $${offset + index}`).join(' OR ')

describe('table query builders', () => {
  it('builds an unfiltered, default-sorted page query with test experiment filter', () => {
    const state = parseTableState(config, {})
    const count = buildCountQuery(config, state)
    expect(count.text).toContain(`NOT ((${scalarMatches('"experiment_id"', 1)}))`)
    expect(count.params).toEqual(patterns)
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('ORDER BY "updated_at" DESC')
    expect(select.text).toContain('LIMIT $8 OFFSET $9')
    expect(select.params).toEqual([...patterns, 25, 0])
  })

  it('builds facet (= ANY) and text (ILIKE) conditions with parameter offsets', () => {
    const state = parseTableState(config, {
      page: '2',
      sort: 'score',
      dir: 'asc',
      model: 'openai/test',
      task_id: 'HumanEval',
    })
    const count = buildCountQuery(config, state)
    expect(count.text).toContain('"task_id" ILIKE $1')
    expect(count.text).toContain(`${CANONICAL_MODEL_SQL} = $2`)
    expect(count.text).toContain(`NOT ((${scalarMatches('"experiment_id"', 3)}))`)
    expect(count.params).toEqual(['%HumanEval%', 'openai/test', ...patterns])
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('ORDER BY "score" ASC')
    expect(select.text).toContain('LIMIT $10 OFFSET $11')
    expect(select.params).toEqual([
      '%HumanEval%',
      'openai/test',
      ...patterns,
      25,
      25,
    ])
  })

  it('builds facet filters for enriched prediction columns', () => {
    const state = parseTableState(config, {
      experiment_kind: 'humaneval_encdec',
      generation_status: 'generated',
    })
    const count = buildCountQuery(config, state)
    expect(count.text).toContain('"experiment_kind" = $1')
    expect(count.text).toContain('"generation_status" = $2')
    expect(count.params).toEqual([
      'humaneval_encdec',
      'generated',
      ...patterns,
    ])
  })

  it('builds budget and range filters', () => {
    const state = parseTableState(config, {
      budget: '0.5',
      score_min: '0',
      score_max: '0.25',
    })
    const count = buildCountQuery(config, state)
    expect(count.text).toContain(`->>'budget_ratio'`)
    expect(count.text).toContain('"score" >= $')
    expect(count.text).toContain('"score" <= $')
    expect(count.params[0]).toBe('0.5')
  })

  it('filters experiments by experiment_id and display_name', () => {
    const state = parseTableState(experimentsConfig, {})
    const count = buildCountQuery(experimentsConfig, state)
    expect(count.text).toContain(scalarMatches('"display_name"', 1))
    expect(count.params).toEqual(patterns)
  })

  it('reads detail predictions without a cross-plane join', () => {
    const state = parseTableState(detailsConfig, {
      model: 'openai/test',
      result_state: 'failed',
    })
    const count = buildCountQuery(detailsConfig, state)
    expect(count.text).toContain('FROM "detail_predictions"')
    expect(count.text).toContain(scalarMatches('"experiment_id"', 3))
  })

  it('omits test experiment filter when includeTestExps=1', () => {
    const state = parseTableState(config, { includeTestExps: '1' })
    const count = buildCountQuery(config, state)
    expect(count.text).not.toContain('"experiment_id" ILIKE')
    expect(count.params).toEqual([])
  })
})
