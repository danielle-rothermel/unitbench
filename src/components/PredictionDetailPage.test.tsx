import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PredictionDetailPage } from '@/components/PredictionDetailPage'
import type { PredictionDetail } from '@/lib/prediction-detail'

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
    input_kind: 'prompt',
    input_text: 'Write a function',
    output_kind: 'completion',
    output_text: 'def solution(): ...',
    prompt_text: 'You are a helpful assistant.',
    code_text: 'def solution():\n    return 1',
    raw_generation: null,
    metrics_json: { pass_at_1: 1 },
    request_json: {},
    response_json: {},
    validation_json: {},
    ...overrides,
  }
}

describe('PredictionDetailPage', () => {
  it('renders header, stats, and populated panels for a direct prediction', () => {
    render(<PredictionDetailPage detail={makeDetail()} backHref="/tables/x" />)

    expect(
      screen.getAllByText('dr-dspy/direct/prediction/abc'),
    ).toHaveLength(2)
    expect(screen.getAllByText('passed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('dr-dspy')).toHaveLength(2)
    expect(screen.getAllByText('humaneval_direct')).toHaveLength(2)
    expect(screen.getByText('openai/gpt-test')).toBeInTheDocument()
    expect(screen.getByText('$0.00120')).toBeInTheDocument()
    expect(screen.getByText('Provenance')).toBeInTheDocument()
    expect(screen.getByText('Generation · prompt → output')).toBeInTheDocument()
    expect(screen.getByText('Debug payloads')).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('Metrics')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'dr-dspy/direct/sweep-1' }),
    ).toHaveAttribute(
      'href',
      '/tables/published-experiments?experiment_id=dr-dspy%2Fdirect%2Fsweep-1',
    )
    expect(screen.queryByText('Summary')).not.toBeInTheDocument()
    expect(screen.queryByText('Raw generation')).not.toBeInTheDocument()
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument()
  })

  it('shows diagnostics, run config, and reference sections when data is present', () => {
    render(
      <PredictionDetailPage
        detail={makeDetail({
          summary_json: {
            temperature: 0.2,
            repetition_seed: 3,
          },
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
          request_json: {
            canonical_solution: 'def add(a, b): return a + b',
            test: 'assert add(1, 2) == 3',
            entry_point: 'add',
          },
        })}
        backHref="/tables/x"
      />,
    )

    expect(screen.getByText('Diagnostics')).toBeInTheDocument()
    expect(screen.getByText('Generation')).toBeInTheDocument()
    expect(screen.getByText('Evaluation')).toBeInTheDocument()
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText('0.20')).toBeInTheDocument()
    expect(screen.getByText('Reference')).toBeInTheDocument()
    expect(screen.getByText('Canonical solution')).toBeInTheDocument()
    expect(screen.getByText('Test harness')).toBeInTheDocument()
    expect(screen.getByText('Entry point')).toBeInTheDocument()
    expect(screen.getAllByText('add').length).toBeGreaterThan(0)
  })

  it('shows the error banner for an errored encoder-decoder prediction', () => {
    const detail = makeDetail({
      prediction_id: 'dr-dspy/encdec/prediction/xyz',
      experiment_kind: 'humaneval_encdec',
      model: 'openai/encoder -> openai/decoder',
      result_state: 'error',
      generation_status: 'generation_error',
      scoring_status: 'score_pending',
      score: null,
      validation_json: {
        generation_exception_message: 'Provider timeout',
      },
    })
    render(<PredictionDetailPage detail={detail} backHref="/tables/x" />)

    expect(screen.getByText('Prediction errored')).toBeInTheDocument()
    expect(screen.getAllByText(/Provider timeout/).length).toBeGreaterThan(0)
    expect(
      screen.getByText('openai/encoder -> openai/decoder'),
    ).toBeInTheDocument()
  })

  it('shows a failed banner and enc-dec pipeline for a failed enc-dec prediction', () => {
    render(
      <PredictionDetailPage
        detail={makeDetail({
          prediction_id: 'dr-dspy/encdec/prediction/xyz',
          experiment_kind: 'humaneval_encdec',
          model: 'openai/encoder -> openai/decoder',
          result_state: 'failed',
          score: 0,
          input_kind: 'humaneval_prompt',
          output_kind: 'decoded_generation',
          output_text: 'def sub(a, b): return a - b',
          summary_json: {
            encoder_model: 'openai/encoder',
            decoder_model: 'openai/decoder',
            budget_ratio: 0.5,
          },
          validation_json: {
            extraction_candidate_count: 1,
            selected_candidate_index: 0,
            raw_compile_ok: true,
            extracted_compile_ok: true,
          },
          metrics_json: {
            evaluation_total_cases: 1,
            evaluation_failure_count: 1,
          },
          request_json: {
            encoded_description: 'Subtract b from a.',
            canonical_solution: 'def sub(a, b): return a - b',
            test: 'assert sub(3, 2) == 1',
            entry_point: 'sub',
          },
          response_json: {
            encoder_provider_cost: 0.002,
            decoder_provider_cost: 0.003,
          },
        })}
        backHref="/tables/x"
      />,
    )

    expect(screen.getByText('Prediction failed')).toBeInTheDocument()
    expect(screen.getAllByText('1/1 evaluation cases failed').length).toBeGreaterThan(0)
    expect(screen.getByText('Encoder-decoder pipeline')).toBeInTheDocument()
    expect(screen.getByText('Encoded description')).toBeInTheDocument()
    expect(screen.getByText('Subtract b from a.')).toBeInTheDocument()
    expect(screen.getByText('Budget ratio')).toBeInTheDocument()
    expect(screen.queryByText('humaneval_prompt')).not.toBeInTheDocument()
  })
})
