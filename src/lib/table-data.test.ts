import { describe, expect, it } from 'vitest'
import { getTableConfig } from '@/lib/table-config'
import { buildCountQuery, buildSelectQuery } from '@/lib/table-data'
import { parseTableState } from '@/lib/table-params'

const config = getTableConfig('published-predictions')
const detailsConfig = getTableConfig('published-prediction-details')

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
    expect(count.text).toContain('= ANY($2::text[])')
    expect(count.params).toEqual(['%HumanEval%', ['openai/test']])
    const select = buildSelectQuery(config, state)
    expect(select.text).toContain('ORDER BY "score" ASC')
    expect(select.text).toContain('LIMIT $3 OFFSET $4')
    expect(select.params).toEqual(['%HumanEval%', ['openai/test'], 25, 25])
  })

  it('builds facet filters for enriched prediction columns', () => {
    const state = parseTableState(config, {
      experiment_kind: 'humaneval_encdec',
      generation_status: 'generated',
    })
    const count = buildCountQuery(config, state)
    expect(count.text).toContain('= ANY($1::text[])')
    expect(count.text).toContain('= ANY($2::text[])')
    expect(count.params).toEqual([
      ['humaneval_encdec'],
      ['generated'],
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

  it('joins prediction details to predictions for browse filters', () => {
    const state = parseTableState(detailsConfig, {
      model: 'openai/test',
      result_state: 'failed',
    })
    const count = buildCountQuery(detailsConfig, state)
    expect(count.text).toContain(
      'FROM "published_prediction_details" AS "d" INNER JOIN "published_predictions" AS "p"',
    )
    expect(count.text).toContain('= ANY($1::text[])')
    expect(count.text).toContain('= ANY($2::text[])')
    const select = buildSelectQuery(detailsConfig, state)
    expect(select.text).toContain('"p"."task_id" AS "task_id"')
  })
})
