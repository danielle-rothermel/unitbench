import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PipelineStageNode } from '@/components/pipeline-flow/PipelineStageNode'
import type { PipelineStage, StageFailure } from '@/fixtures/pipeline'

const RATE_LIMIT_FAILURE: StageFailure = {
  failure_class: 'rate_limited',
  error_type: 'RateLimitError',
  message: '429 from provider; retried',
}

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

const SUCCESS_LLM_STAGE = makeStage({
  started_at: '2026-07-06T21:14:03.000Z',
  completed_at: '2026-07-06T21:14:09.180Z',
  duration_ms: 6180,
  input_char_count: 192,
  output_char_count: 89,
  output_excerpt: 'fn longest: pick max-len str, None if empty',
  model: 'openai/gpt-5.5-codex',
  provider_cost: 0.0011,
})

describe('PipelineStageNode', () => {
  it('renders duration, char flow, model, cost, and excerpt for a successful LLM stage', () => {
    render(<PipelineStageNode stage={SUCCESS_LLM_STAGE} />)

    expect(screen.getByText('6.2 s')).toBeInTheDocument()
    expect(screen.getByText('192 → 89 ch (0.46×)')).toBeInTheDocument()
    expect(screen.getByText('openai/gpt-5.5-codex')).toBeInTheDocument()
    expect(screen.getByText('$0.00110')).toBeInTheDocument()
    expect(screen.getByText('started')).toBeInTheDocument()
    expect(
      screen.getByText('fn longest: pick max-len str, None if empty'),
    ).toBeInTheDocument()
  })

  it('renders only the char flow for a measurement stage', () => {
    render(
      <PipelineStageNode
        stage={makeStage({
          stage: 'compress',
          node_id: null,
          input_char_count: 89,
          output_char_count: 79,
        })}
      />,
    )

    expect(screen.getByText('89 → 79 ch (0.89×)')).toBeInTheDocument()
    expect(screen.queryByText('duration')).not.toBeInTheDocument()
    expect(screen.queryByText('model')).not.toBeInTheDocument()
    expect(screen.queryByText('cost')).not.toBeInTheDocument()
    expect(screen.queryByText('started')).not.toBeInTheDocument()
  })

  it('renders failure metadata and no excerpt for an error stage', () => {
    render(
      <PipelineStageNode
        stage={makeStage({
          stage: 'decode',
          node_id: 'decoder',
          status: 'error',
          attempt_index: 1,
          input_char_count: 89,
          failure: RATE_LIMIT_FAILURE,
        })}
      />,
    )

    expect(screen.getByText('failed after 2 attempts')).toBeInTheDocument()
    expect(screen.getByText('RateLimitError')).toBeInTheDocument()
    expect(screen.getByText('429 from provider; retried')).toBeInTheDocument()
    expect(screen.getByText('rate_limited')).toBeInTheDocument()
    expect(screen.getByText('89 ch in')).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders a status-only placeholder for a skipped stage', () => {
    render(<PipelineStageNode stage={makeStage({ stage: 'run_tests', status: 'skipped' })} />)

    expect(screen.getByText('skipped')).toBeInTheDocument()
    expect(screen.queryByText('duration')).not.toBeInTheDocument()
    expect(screen.queryByText('chars')).not.toBeInTheDocument()
    expect(screen.queryByText('model')).not.toBeInTheDocument()
    expect(screen.queryByText('cost')).not.toBeInTheDocument()
  })

  it('renders a recovered retry as a yellow affordance, not an error', () => {
    render(
      <PipelineStageNode
        stage={makeStage({
          ...SUCCESS_LLM_STAGE,
          attempt_index: 1,
          failure: RATE_LIMIT_FAILURE,
        })}
      />,
    )

    expect(screen.getByText('retried ×1')).toBeInTheDocument()
    expect(screen.getByText('rate_limited')).toBeInTheDocument()
    expect(screen.getByText('success')).toBeInTheDocument()
    expect(screen.queryByText(/failed after/)).not.toBeInTheDocument()
    expect(screen.getByText('retried ×1').className).toContain('--yellow')
  })

  it('renders a non-rate-limited failure class with a red tag', () => {
    render(
      <PipelineStageNode
        stage={makeStage({
          status: 'error',
          failure: {
            failure_class: 'permanent',
            error_type: 'SyntaxError',
            message: 'decoder emitted invalid python',
          },
        })}
      />,
    )

    expect(screen.getByText('SyntaxError')).toBeInTheDocument()
    expect(screen.getByText('permanent').className).toContain('--red')
  })

  it('renders a failure block without metadata when failure is null', () => {
    render(<PipelineStageNode stage={makeStage({ status: 'error' })} />)

    expect(screen.getByText('failed (no failure metadata)')).toBeInTheDocument()
    expect(screen.queryByText(/failed after/)).not.toBeInTheDocument()
  })
})
