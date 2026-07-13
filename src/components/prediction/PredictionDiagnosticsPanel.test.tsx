import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PredictionDiagnosticsPanel } from '@/components/prediction/PredictionDiagnosticsPanel'
import type { PredictionDetail } from '@/lib/prediction-detail'
import { buildPredictionDiagnostics } from '@/lib/prediction-diagnostics'

function makeDetail(overrides: Partial<PredictionDetail> = {}): PredictionDetail {
  return {
    prediction_id: 'dr-dspy/direct/prediction/abc',
    experiment_id: 'dr-dspy/direct/sweep-1',
    source: 'dr-dspy',
    experiment_kind: 'humaneval_direct',
    task_id: 'HumanEval/1',
    sample_index: 0,
    model: 'openai/gpt-test',
    result_state: 'failed',
    generation_status: 'generated',
    scoring_status: 'scored',
    harness_failure_count: 0,
    score: 0,
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

function renderPanel(detail: PredictionDetail) {
  render(
    <PredictionDiagnosticsPanel
      detail={detail}
      diagnostics={buildPredictionDiagnostics(detail)}
    />,
  )
}

describe('PredictionDiagnosticsPanel', () => {
  it('never renders failures > total without the inconsistent-data marker', () => {
    renderPanel(
      makeDetail({
        metrics_json: {
          evaluation_total_cases: 1100,
          evaluation_failure_count: 1578,
        },
      }),
    )

    expect(screen.queryByText('1578/1100 failed')).toBeNull()
    expect(
      screen.getAllByText(
        '1578 failures reported for 1100 evaluation cases — inconsistent data',
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('inconsistent data')).toBeInTheDocument()
  })

  it('shows the scoring stage of a failed prediction as scored, not passed', () => {
    renderPanel(
      makeDetail({
        metrics_json: {
          evaluation_total_cases: 2,
          evaluation_failure_count: 2,
        },
      }),
    )

    const scoringRow = screen.getByText('Scoring').parentElement
    expect(scoringRow).not.toBeNull()
    expect(within(scoringRow as HTMLElement).getByText('scored')).toBeInTheDocument()
    expect(within(scoringRow as HTMLElement).queryByText('passed')).toBeNull()
    expect(screen.getByText('score 0.00')).toBeInTheDocument()
  })
})
