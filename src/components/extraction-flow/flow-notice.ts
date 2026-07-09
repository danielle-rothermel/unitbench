import type { ExtractionFlowSample } from '@/fixtures/extraction'
import type { GeneratedCodeOutcome } from '@/fixtures/primitives'

export type FlowNotice = {
  /** Matches ErrorSection's tone prop. */
  tone: 'error' | 'warning'
  title: string
  message: string
}

const COMPILE_FAILED_TITLE = 'Compile failed'

const OUTCOME_NOTICES: Partial<Record<GeneratedCodeOutcome, FlowNotice>> = {
  empty_generation: {
    tone: 'warning',
    title: 'Empty generation',
    message: 'The model returned no output.',
  },
  extraction_failed: {
    tone: 'warning',
    title: 'Extraction failed',
    message: 'No code block found in the raw generation.',
  },
  no_top_level_functions: {
    tone: 'warning',
    title: 'No top-level functions',
    message: 'Code parsed but nothing callable was found.',
  },
  evaluation_incomplete: {
    tone: 'warning',
    title: 'Evaluation incomplete',
    message: 'Not all test cases ran.',
  },
}

/** Failure-path banner for the sample, or null for a clean run. */
export function buildFlowNotice(sample: ExtractionFlowSample): FlowNotice | null {
  // compile_ok is meaningful only when code was actually extracted; the
  // generator's extraction_failed/empty_generation branch sets compile_ok:
  // false with extracted_code: null, where the outcome message wins instead.
  if (
    !sample.compile_ok &&
    sample.extracted_code !== null &&
    sample.compile_error !== null
  ) {
    return {
      tone: 'error',
      title: COMPILE_FAILED_TITLE,
      message: sample.compile_error,
    }
  }
  const outcome = sample.generated_code_outcome
  if (outcome === null) return null
  return OUTCOME_NOTICES[outcome] ?? null
}
