import { describe, expect, it } from 'vitest'
import { buildFlowNotice } from '@/components/extraction-flow/flow-notice'
import { makeExtractionFlowSample } from '@/fixtures/extraction'
import type { GeneratedCodeOutcome } from '@/fixtures/primitives'

const WARNING_CASES: Array<[GeneratedCodeOutcome, string]> = [
  ['empty_generation', 'Empty generation'],
  ['extraction_failed', 'Extraction failed'],
  ['no_top_level_functions', 'No top-level functions'],
  ['evaluation_incomplete', 'Evaluation incomplete'],
]

describe('buildFlowNotice', () => {
  it('returns null for a passed sample', () => {
    expect(
      buildFlowNotice(makeExtractionFlowSample({ seed: 3, outcome: 'passed' })),
    ).toBeNull()
  })

  it('returns null for a tests_failed sample', () => {
    expect(
      buildFlowNotice(
        makeExtractionFlowSample({ seed: 5, outcome: 'tests_failed' }),
      ),
    ).toBeNull()
  })

  it('returns null when generated_code_outcome is null', () => {
    const sample = {
      ...makeExtractionFlowSample({ seed: 3, outcome: 'passed' }),
      generated_code_outcome: null,
    }
    expect(buildFlowNotice(sample)).toBeNull()
  })

  it.each(WARNING_CASES)(
    'returns a warning banner for %s',
    (outcome, title) => {
      const sample = makeExtractionFlowSample({ seed: 11, outcome })
      expect(buildFlowNotice(sample)).toMatchObject({ tone: 'warning', title })
    },
  )

  it('prefers the compile-failure banner when extracted code has a compile_error', () => {
    const sample = {
      ...makeExtractionFlowSample({ seed: 11, outcome: 'tests_failed' }),
      compile_ok: false,
      compile_error: 'SyntaxError: invalid syntax (line 3)',
    }
    expect(buildFlowNotice(sample)).toEqual({
      tone: 'error',
      title: 'Compile failed',
      message: 'SyntaxError: invalid syntax (line 3)',
    })
  })

  it('keeps the extraction message for the generator extraction_failed shape', () => {
    const sample = makeExtractionFlowSample({
      seed: 7,
      outcome: 'extraction_failed',
    })
    expect(sample.compile_ok).toBe(false)
    expect(sample.compile_error).toBeNull()
    expect(buildFlowNotice(sample)).toMatchObject({
      tone: 'warning',
      title: 'Extraction failed',
    })
  })
})
