import { describe, expect, it } from 'vitest'
import { EXTRACTION_FLOW_SCENARIOS } from '@/components/extraction-flow/demo-scenarios'
import type { GeneratedCodeOutcome } from '@/fixtures/primitives'

const REQUIRED_OUTCOMES: GeneratedCodeOutcome[] = [
  'passed',
  'tests_failed',
  'extraction_failed',
  'empty_generation',
  'no_top_level_functions',
  'evaluation_incomplete',
]

describe('EXTRACTION_FLOW_SCENARIOS', () => {
  it('has unique, non-empty scenario ids', () => {
    const ids = EXTRACTION_FLOW_SCENARIOS.map(scenario => scenario.id)
    expect(ids.every(id => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(REQUIRED_OUTCOMES)('covers the %s outcome', outcome => {
    expect(
      EXTRACTION_FLOW_SCENARIOS.some(
        scenario => scenario.sample.generated_code_outcome === outcome,
      ),
    ).toBe(true)
  })

  it('includes a compile-error scenario', () => {
    expect(
      EXTRACTION_FLOW_SCENARIOS.some(
        scenario => scenario.sample.compile_error !== null,
      ),
    ).toBe(true)
  })

  it('includes a selected-function ≠ entry_point scenario', () => {
    expect(
      EXTRACTION_FLOW_SCENARIOS.some(
        scenario =>
          scenario.sample.best_function_name !== null &&
          scenario.sample.best_function_name !== scenario.sample.entry_point,
      ),
    ).toBe(true)
  })

  it('keeps every sample internally consistent', () => {
    for (const scenario of EXTRACTION_FLOW_SCENARIOS) {
      const { sample } = scenario
      const countTotal = Object.values(sample.status_counts).reduce(
        (sum, count) => sum + (count ?? 0),
        0,
      )
      expect(countTotal, scenario.id).toBe(sample.per_test_results.length)

      const selected = sample.parsed_functions.filter(fn => fn.is_selected)
      expect(selected.length, scenario.id).toBeLessThanOrEqual(1)
      expect(
        selected.map(fn => fn.function_name),
        scenario.id,
      ).toEqual(
        sample.best_function_name === null ? [] : [sample.best_function_name],
      )
    }
  })
})
