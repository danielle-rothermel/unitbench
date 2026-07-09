import { describe, expect, it } from 'vitest'
import {
  makeExtractionFlowSample,
  makeExtractionFlowSamples,
} from '@/fixtures/extraction'
import {
  EVALUATION_CASE_STATUSES,
  EXTRACTION_METHODS,
  GENERATED_CODE_OUTCOMES,
} from '@/fixtures/primitives'

describe('makeExtractionFlowSample', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makeExtractionFlowSample({ seed: 4 })).toEqual(
      makeExtractionFlowSample({ seed: 4 }),
    )
  })

  it('only emits catalog enum values', () => {
    for (const sample of makeExtractionFlowSamples(20)) {
      if (sample.generated_code_outcome !== null) {
        expect(GENERATED_CODE_OUTCOMES).toContain(sample.generated_code_outcome)
      }
      if (sample.extraction_method !== null) {
        expect(EXTRACTION_METHODS).toContain(sample.extraction_method)
      }
      for (const result of sample.per_test_results) {
        expect(EVALUATION_CASE_STATUSES).toContain(result.status)
      }
    }
  })

  it('keeps status_counts consistent with per_test_results', () => {
    for (const sample of makeExtractionFlowSamples(20)) {
      const total = Object.values(sample.status_counts).reduce((a, b) => a + b, 0)
      expect(total).toBe(sample.per_test_results.length)
    }
  })

  it('marks exactly the best function as selected', () => {
    const sample = makeExtractionFlowSample({ outcome: 'passed' })
    const selected = sample.parsed_functions.filter(fn => fn.is_selected)
    expect(selected).toHaveLength(1)
    expect(selected[0].function_name).toBe(sample.best_function_name)
  })

  it('emits an all-pass run for the passed outcome', () => {
    const sample = makeExtractionFlowSample({ outcome: 'passed' })
    expect(sample.per_test_results.length).toBeGreaterThan(0)
    expect(sample.per_test_results.every(result => result.status === 'passed')).toBe(true)
  })

  it('emits an empty downstream for extraction failures', () => {
    const sample = makeExtractionFlowSample({ outcome: 'extraction_failed' })
    expect(sample.extracted_code).toBeNull()
    expect(sample.extraction_method).toBeNull()
    expect(sample.parsed_functions).toEqual([])
    expect(sample.per_test_results).toEqual([])
    expect(sample.best_function_name).toBeNull()
  })
})
