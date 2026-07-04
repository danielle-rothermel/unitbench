import { describe, expect, it } from 'vitest'
import {
  INCLUDE_TEST_EXPS_PARAM,
  buildTestExperimentWhereParts,
  parseHideTestExperiments,
  testExperimentPatterns,
} from '@/lib/test-experiment-filter'

describe('parseHideTestExperiments', () => {
  it('defaults to hiding test experiments', () => {
    expect(parseHideTestExperiments({})).toBe(true)
  })

  it('shows test experiments when includeTestExps=1', () => {
    expect(parseHideTestExperiments({ [INCLUDE_TEST_EXPS_PARAM]: '1' })).toBe(
      false,
    )
  })

  it('shows test experiments when includeTestExps=true', () => {
    expect(parseHideTestExperiments({ [INCLUDE_TEST_EXPS_PARAM]: 'true' })).toBe(
      false,
    )
  })
})

describe('buildTestExperimentWhereParts', () => {
  it('returns no conditions when hide is false', () => {
    expect(
      buildTestExperimentWhereParts({
        hide: false,
        paramOffset: 0,
        experimentIdExpr: '"experiment_id"',
      }),
    ).toEqual({ conditions: [], params: [] })
  })

  it('builds experiment_id-only filter with parameterized patterns', () => {
    const parts = buildTestExperimentWhereParts({
      hide: true,
      paramOffset: 2,
      experimentIdExpr: '"experiment_id"',
    })
    expect(parts.conditions).toEqual([
      'NOT ("experiment_id" ILIKE ANY($3::text[]))',
    ])
    expect(parts.params).toEqual([testExperimentPatterns()])
  })

  it('builds experiment_id and display_name filter for experiments table', () => {
    const parts = buildTestExperimentWhereParts({
      hide: true,
      paramOffset: 0,
      experimentIdExpr: '"experiment_id"',
      displayNameExpr: '"display_name"',
    })
    expect(parts.conditions[0]).toContain('"experiment_id" ILIKE ANY($1::text[])')
    expect(parts.conditions[0]).toContain('"display_name" ILIKE ANY($1::text[])')
    expect(parts.params).toEqual([testExperimentPatterns()])
  })
})
