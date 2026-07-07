import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PipelineFlow } from '@/components/pipeline-flow/PipelineFlow'
import { formatDurationMs } from '@/components/pipeline-flow/pipeline-flow-view'
import { makePipelineTrace, type PipelineTrace } from '@/fixtures/pipeline'
import { formatCost } from '@/lib/format'

function listItemLabels(): (string | null)[] {
  return screen
    .getAllByRole('listitem')
    .map(item => item.getAttribute('aria-label'))
}

describe('PipelineFlow', () => {
  it('renders the five encdec stages in fixture order', () => {
    const trace = makePipelineTrace({ seed: 2, layout: 'encdec' })
    render(<PipelineFlow trace={trace} />)

    expect(listItemLabels()).toEqual(
      trace.stages.map(stage => `${stage.stage}: ${stage.status}`),
    )
    expect(trace.stages.map(stage => stage.stage)).toEqual([
      'encode',
      'compress',
      'decompress',
      'decode',
      'run_tests',
    ])
  })

  it('renders exactly generate and run_tests for a direct trace', () => {
    const trace = makePipelineTrace({ seed: 2, layout: 'direct' })
    render(<PipelineFlow trace={trace} />)

    expect(listItemLabels()).toEqual([
      `generate: ${trace.stages[0].status}`,
      `run_tests: ${trace.stages[1].status}`,
    ])
  })

  it('shows the result badge, model, and formatted totals in the header', () => {
    const trace = makePipelineTrace({ seed: 2, layout: 'encdec' })
    render(<PipelineFlow trace={trace} />)

    expect(screen.getByText(trace.result_state)).toBeInTheDocument()
    // Model also appears on the LLM stage cards; the header StatCell adds one more.
    expect(screen.getAllByText(trace.identity.model).length).toBeGreaterThan(0)
    expect(
      screen.getByText(formatCost(trace.total_provider_cost) ?? ''),
    ).toBeInTheDocument()
    expect(
      screen.getByText(formatDurationMs(trace.total_duration_ms ?? 0)),
    ).toBeInTheDocument()
  })

  it('renders unknown for null totals', () => {
    const base = makePipelineTrace({ seed: 2 })
    const trace: PipelineTrace = {
      ...base,
      total_provider_cost: null,
      total_duration_ms: null,
    }
    render(<PipelineFlow trace={trace} />)

    expect(screen.getAllByText('unknown')).toHaveLength(2)
  })

  it('renders an error stage plus skipped downstream stages for a mid-pipeline failure', () => {
    render(<PipelineFlow trace={makePipelineTrace({ seed: 2, failAt: 'decode' })} />)

    expect(listItemLabels()).toEqual([
      'encode: success',
      'compress: success',
      'decompress: success',
      'decode: error',
      'run_tests: skipped',
    ])
    expect(screen.getByText('RateLimitError')).toBeInTheDocument()
  })

  it('survives seeds 1-10 across both layouts and failure modes', () => {
    const cases: { layout: 'encdec' | 'direct'; failAt?: 'encode' | 'generate' }[] = [
      { layout: 'encdec' },
      { layout: 'encdec', failAt: 'encode' },
      { layout: 'direct' },
      { layout: 'direct', failAt: 'generate' },
    ]
    for (let seed = 1; seed <= 10; seed += 1) {
      for (const options of cases) {
        const { unmount } = render(
          <PipelineFlow trace={makePipelineTrace({ seed, ...options })} />,
        )
        expect(
          screen.getByRole('listitem', { name: /^run_tests: / }),
        ).toBeInTheDocument()
        unmount()
      }
    }
  })
})
