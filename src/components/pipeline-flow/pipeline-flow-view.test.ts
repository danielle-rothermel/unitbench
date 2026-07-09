import { describe, expect, it } from 'vitest'
import {
  charFlowLabel,
  failureClassTone,
  formatDurationMs,
  stageKind,
  stageRetryStory,
} from '@/components/pipeline-flow/pipeline-flow-view'
import type { PipelineStage, StageFailure } from '@/fixtures/pipeline'
import { PIPELINE_STAGE_NAMES } from '@/fixtures/pipeline'

const RATE_LIMIT_FAILURE: StageFailure = {
  failure_class: 'rate_limited',
  error_type: 'RateLimitError',
  message: '429 from provider; retried',
}

/** Type-legal stage literal; tests override the retry-relevant fields. */
function makeStage(overrides: Partial<PipelineStage>): PipelineStage {
  return {
    stage: 'encode',
    node_id: 'encoder',
    status: 'success',
    attempt_index: 0,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    input_char_count: null,
    output_char_count: null,
    output_excerpt: null,
    model: null,
    provider_cost: null,
    failure: null,
    ...overrides,
  }
}

describe('stageKind', () => {
  it.each([
    ['encode', 'llm'],
    ['decode', 'llm'],
    ['generate', 'llm'],
    ['compress', 'measurement'],
    ['decompress', 'measurement'],
    ['run_tests', 'tests'],
  ] as const)('classifies %s as %s', (stage, kind) => {
    expect(stageKind(stage)).toBe(kind)
  })

  it('covers every pipeline stage name', () => {
    for (const stage of PIPELINE_STAGE_NAMES) {
      expect(() => stageKind(stage)).not.toThrow()
    }
  })
})

describe('stageRetryStory', () => {
  it('returns none for a clean success', () => {
    expect(stageRetryStory(makeStage({ status: 'success' }))).toEqual({
      kind: 'none',
    })
  })

  it('returns recovered when a success kept its last failure', () => {
    const stage = makeStage({
      status: 'success',
      attempt_index: 1,
      failure: RATE_LIMIT_FAILURE,
    })
    expect(stageRetryStory(stage)).toEqual({
      kind: 'recovered',
      attempts: 1,
      failure: RATE_LIMIT_FAILURE,
    })
  })

  it('clamps recovered attempts to at least one retry', () => {
    const stage = makeStage({
      status: 'success',
      attempt_index: 0,
      failure: RATE_LIMIT_FAILURE,
    })
    expect(stageRetryStory(stage)).toEqual({
      kind: 'recovered',
      attempts: 1,
      failure: RATE_LIMIT_FAILURE,
    })
  })

  it('returns failed with retry count for an error after retries', () => {
    const stage = makeStage({
      status: 'error',
      attempt_index: 1,
      failure: RATE_LIMIT_FAILURE,
    })
    expect(stageRetryStory(stage)).toEqual({
      kind: 'failed',
      attempts: 1,
      failure: RATE_LIMIT_FAILURE,
    })
  })

  it('returns failed with null failure for a first-attempt error without metadata', () => {
    const stage = makeStage({ status: 'error', attempt_index: 0 })
    expect(stageRetryStory(stage)).toEqual({
      kind: 'failed',
      attempts: 0,
      failure: null,
    })
  })

  it('returns none for a skipped stage', () => {
    expect(stageRetryStory(makeStage({ status: 'skipped' }))).toEqual({
      kind: 'none',
    })
  })
})

describe('formatDurationMs', () => {
  it.each([
    [850, '850 ms'],
    [999, '999 ms'],
    [1000, '1.0 s'],
    [6180, '6.2 s'],
    [59_940, '59.9 s'],
    [60_000, '1.0 min'],
    [66_000, '1.1 min'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatDurationMs(ms)).toBe(expected)
  })
})

describe('charFlowLabel', () => {
  it('renders in→out with a compression ratio', () => {
    expect(charFlowLabel(192, 89)).toBe('192 → 89 ch (0.46×)')
  })

  it('degrades to input-only when output is null', () => {
    expect(charFlowLabel(192, null)).toBe('192 ch in')
  })

  it('degrades to output-only when input is null', () => {
    expect(charFlowLabel(null, 89)).toBe('89 ch out')
  })

  it('returns null when both counts are null', () => {
    expect(charFlowLabel(null, null)).toBeNull()
  })

  it('omits the ratio when input is zero', () => {
    expect(charFlowLabel(0, 20)).toBe('0 → 20 ch')
  })
})

describe('failureClassTone', () => {
  it.each([
    ['rate_limited', 'yellow'],
    ['permanent', 'red'],
    ['transient', 'red'],
    ['resource_exhaustion', 'red'],
    ['unknown', 'red'],
    [null, 'neutral'],
  ] as const)('maps %s to %s', (failureClass, tone) => {
    expect(failureClassTone(failureClass)).toBe(tone)
  })
})
