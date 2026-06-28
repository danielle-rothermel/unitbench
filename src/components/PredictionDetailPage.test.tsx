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
      screen.getByText('dr-dspy/direct/prediction/abc'),
    ).toBeInTheDocument()
    expect(screen.getByText('passed')).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('Metrics')).toBeInTheDocument()
    // Empty JSON payloads are omitted rather than shown as empty panels.
    expect(screen.queryByText('Summary')).not.toBeInTheDocument()
    expect(screen.queryByText('Raw generation')).not.toBeInTheDocument()
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
    })
    render(<PredictionDetailPage detail={detail} backHref="/tables/x" />)

    expect(screen.getByText('Prediction errored')).toBeInTheDocument()
    expect(
      screen.getByText('openai/encoder -> openai/decoder'),
    ).toBeInTheDocument()
  })
})
