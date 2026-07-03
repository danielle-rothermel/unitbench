import { describe, expect, it } from 'vitest'
import type { PredictionDetail } from '@/lib/prediction-detail'
import {
  buildEncdecPipeline,
  buildOutcomeBanner,
  buildPredictionDiagnostics,
  buildReferenceFields,
  buildRunConfigFields,
  hasReferenceContent,
  shouldShowDiagnostics,
  shouldShowGroundTruth,
  truncateFailureReason,
} from '@/lib/prediction-diagnostics'

function makeDetail(overrides: Partial<PredictionDetail> = {}): PredictionDetail {
  return {
    prediction_id: 'dr-dspy/direct/prediction/abc',
    experiment_id: 'dr-dspy/direct/sweep-1',
    source: 'dr-dspy',
    experiment_kind: 'humaneval_direct',
    task_id: 'HumanEval/1',
    sample_index: 0,
    model: 'openai/gpt-test',
    result_state: 'passed',
    generation_status: 'generated',
    scoring_status: 'scored',
    score: 1,
    provider_cost: 0.0012,
    created_at: '2026-06-28T12:00:00Z',
    updated_at: '2026-06-28T12:05:00Z',
    summary_json: {},
    input_kind: 'humaneval_prompt',
    input_text: 'write add',
    output_kind: 'generated_code',
    output_text: 'def add(a, b): return a + b',
    prompt_text: 'write add',
    code_text: 'def add(a, b): return a + b',
    raw_generation: null,
    metrics_json: {},
    request_json: {},
    response_json: {},
    validation_json: {},
    ...overrides,
  }
}

describe('buildPredictionDiagnostics', () => {
  it('derives passed stages for a successful direct prediction', () => {
    const diagnostics = buildPredictionDiagnostics(
      makeDetail({
        validation_json: {
          extraction_candidate_count: 1,
          selected_candidate_index: 0,
          raw_compile_ok: true,
          extracted_compile_ok: true,
        },
        metrics_json: {
          evaluation_total_cases: 1,
          evaluation_failure_count: 0,
        },
      }),
    )

    expect(diagnostics.primaryFailureReason).toBeNull()
    expect(diagnostics.testSummary).toBe('1/1 evaluation case passed')
    expect(diagnostics.pipelineStages.map(stage => stage.status)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
    ])
    expect(shouldShowDiagnostics(diagnostics, makeDetail())).toBe(true)
  })

  it('derives failed evaluation for an enc-dec prediction with test failures', () => {
    const diagnostics = buildPredictionDiagnostics(
      makeDetail({
        experiment_kind: 'humaneval_encdec',
        result_state: 'failed',
        score: 0,
        validation_json: {
          extraction_candidate_count: 1,
          selected_candidate_index: 0,
          raw_compile_ok: true,
          extracted_compile_ok: true,
        },
        metrics_json: {
          evaluation_total_cases: 1,
          evaluation_failure_count: 1,
          evaluation_status_counts: { failed: 1 },
        },
      }),
    )

    expect(diagnostics.primaryFailureReason).toBe('1/1 evaluation cases failed')
    expect(diagnostics.pipelineStages.find(stage => stage.id === 'evaluation')).toMatchObject({
      status: 'failed',
      detail: '1/1 failed',
    })
  })

  it('surfaces generation errors for errored predictions', () => {
    const diagnostics = buildPredictionDiagnostics(
      makeDetail({
        result_state: 'error',
        generation_status: 'generation_error',
        scoring_status: 'score_pending',
        score: null,
        validation_json: {
          generation_exception_message: 'Provider timeout',
          generation_failure_class: 'provider_error',
        },
      }),
    )

    expect(diagnostics.primaryFailureReason).toBe('Provider timeout')
    expect(diagnostics.pipelineStages[0]).toMatchObject({
      id: 'generation',
      status: 'failed',
      detail: 'Provider timeout',
    })
  })

  it('handles sparse JSON without throwing', () => {
    const detail = makeDetail()
    const diagnostics = buildPredictionDiagnostics(detail)

    expect(diagnostics.primaryFailureReason).toBeNull()
    expect(diagnostics.testSummary).toBeNull()
    expect(shouldShowDiagnostics(diagnostics, detail)).toBe(false)
  })
})

describe('buildRunConfigFields', () => {
  it('includes direct run config fields', () => {
    const fields = buildRunConfigFields(
      makeDetail({
        summary_json: {
          temperature: 0.2,
          repetition_seed: 3,
          generated_at: '2026-06-28T12:01:00Z',
          scored_at: '2026-06-28T12:02:00Z',
        },
      }),
    )

    expect(fields.map(field => field.label)).toEqual([
      'Temperature',
      'Repetition seed',
      'Generated',
      'Scored',
    ])
    expect(fields[0]?.value).toBe('0.20')
    expect(fields[1]?.value).toBe('3')
  })

  it('includes enc-dec run config fields', () => {
    const fields = buildRunConfigFields(
      makeDetail({
        experiment_kind: 'humaneval_encdec',
        summary_json: {
          encoder_model: 'openai/encoder',
          decoder_model: 'openai/decoder',
          encoder_temperature: 0,
          decoder_temperature: 0.4,
          budget_ratio: 0.5,
          encoder_char_budget: 250,
          repetition_seed: 4,
        },
      }),
    )

    expect(fields.map(field => field.label)).toEqual([
      'Encoder model',
      'Decoder model',
      'Encoder temp',
      'Decoder temp',
      'Budget ratio',
      'Encoder char budget',
      'Repetition seed',
    ])
  })
})

describe('buildReferenceFields', () => {
  it('extracts reference fields from request JSON', () => {
    const reference = buildReferenceFields({
      canonical_solution: 'def add(a, b): return a + b',
      ground_truth_code: 'def add(a, b): return a + b',
      test: 'assert add(1, 2) == 3',
      entry_point: 'add',
    })

    expect(hasReferenceContent(reference)).toBe(true)
    expect(shouldShowGroundTruth(reference)).toBe(false)
  })

  it('shows ground truth when it differs from canonical solution', () => {
    const reference = buildReferenceFields({
      canonical_solution: 'def add(a, b): return a + b',
      ground_truth_code: 'def add(x, y): return x + y',
      test: 'assert add(1, 2) == 3',
      entry_point: 'add',
    })

    expect(shouldShowGroundTruth(reference)).toBe(true)
  })
})

describe('buildEncdecPipeline', () => {
  it('returns enc-dec pipeline data for enc-dec predictions', () => {
    const pipeline = buildEncdecPipeline(
      makeDetail({
        experiment_kind: 'humaneval_encdec',
        output_kind: 'decoded_generation',
        output_text: 'def sub(a, b): return a - b',
        request_json: { encoded_description: 'Subtract b from a.' },
        response_json: {
          encoder_provider_cost: 0.002,
          decoder_provider_cost: 0.003,
        },
      }),
    )

    expect(pipeline).toEqual({
      prompt: 'write add',
      encodedDescription: 'Subtract b from a.',
      decodedGeneration: 'def sub(a, b): return a - b',
      encoderCost: 0.002,
      decoderCost: 0.003,
    })
  })

  it('returns null for direct predictions', () => {
    expect(buildEncdecPipeline(makeDetail())).toBeNull()
  })
})

describe('buildOutcomeBanner', () => {
  it('returns an error banner for errored predictions', () => {
    const detail = makeDetail({
      result_state: 'error',
      generation_status: 'generation_error',
      scoring_status: 'score_pending',
    })
    const diagnostics = buildPredictionDiagnostics(
      makeDetail({
        result_state: 'error',
        generation_status: 'generation_error',
        validation_json: { generation_exception_message: 'Provider timeout' },
      }),
    )

    expect(buildOutcomeBanner(detail, diagnostics)).toEqual({
      tone: 'error',
      title: 'Prediction errored',
      message:
        'Generation: generation_error · Scoring: score_pending · Provider timeout',
    })
  })

  it('returns a warning banner for failed predictions', () => {
    const detail = makeDetail({ result_state: 'failed', score: 0 })
    const diagnostics = buildPredictionDiagnostics(
      makeDetail({
        result_state: 'failed',
        metrics_json: {
          evaluation_total_cases: 2,
          evaluation_failure_count: 1,
        },
      }),
    )

    expect(buildOutcomeBanner(detail, diagnostics)).toEqual({
      tone: 'warning',
      title: 'Prediction failed',
      message: '1/2 evaluation cases failed',
    })
  })

  it('returns null for passed predictions', () => {
    const detail = makeDetail()
    const diagnostics = buildPredictionDiagnostics(detail)
    expect(buildOutcomeBanner(detail, diagnostics)).toBeNull()
  })
})

describe('truncateFailureReason', () => {
  it('truncates long failure reasons for badges', () => {
    const reason = 'x'.repeat(80)
    expect(truncateFailureReason(reason)).toHaveLength(60)
    expect(truncateFailureReason('short error')).toBe('short error')
  })
})
