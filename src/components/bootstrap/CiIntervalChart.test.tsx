import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BootstrapCiSummary } from '@/fixtures/bootstrap'
import { CiIntervalChart } from '@/components/bootstrap/CiIntervalChart'
import type { GroupObservation } from '@/lib/bootstrap-ci'

function makeSummary(overrides: Partial<BootstrapCiSummary>): BootstrapCiSummary {
  return {
    model: 'model-a',
    task_id: null,
    n_samples: 3,
    observed_pass_rate: 0.62,
    ci_low: 0.55,
    ci_high: 0.69,
    confidence_level: 0.95,
    n_resamples: 2000,
    seed: 17,
    ...overrides,
  }
}

function makeObservation(overrides: Partial<GroupObservation>): GroupObservation {
  return {
    model: 'model-a',
    task_id: null,
    n_available: 3,
    observed_pass_rate: 0.62,
    ...overrides,
  }
}

describe('CiIntervalChart', () => {
  it('renders one labeled interval row per summary, ordered by observed rate desc', () => {
    const summaries = [
      makeSummary({ model: 'model-low', observed_pass_rate: 0.3, ci_low: 0.2, ci_high: 0.45 }),
      makeSummary({ model: 'model-high', observed_pass_rate: 0.9, ci_low: 0.8, ci_high: 0.95 }),
      makeSummary({ model: 'model-mid', observed_pass_rate: 0.6, ci_low: 0.5, ci_high: 0.7 }),
    ]
    const observations = summaries.map(summary =>
      makeObservation({ model: summary.model }),
    )
    const { container } = render(
      <CiIntervalChart summaries={summaries} observations={observations} title="CIs" />,
    )

    const rows = [...container.querySelectorAll('[data-ci-row]')]
    expect(rows).toHaveLength(3)
    const labels = rows.map(
      row => row.querySelector('svg')?.getAttribute('aria-label') ?? '',
    )
    expect(labels[0]).toContain('model-high')
    expect(labels[1]).toContain('model-mid')
    expect(labels[2]).toContain('model-low')
    expect(labels[0]).toContain('0.900')
    expect(labels[0]).toContain('95% CI 0.800 to 0.950')
  })

  it('tags degenerate summaries and renders no zero-width segment', () => {
    const summaries = [
      makeSummary({
        model: 'model-pass',
        observed_pass_rate: 1,
        ci_low: 1,
        ci_high: 1,
      }),
      makeSummary({
        model: 'model-fail',
        observed_pass_rate: 0,
        ci_low: 0,
        ci_high: 0,
      }),
    ]
    const { container, getByText } = render(
      <CiIntervalChart summaries={summaries} observations={[]} title="CIs" />,
    )

    expect(getByText('degenerate (all pass)')).toBeInTheDocument()
    expect(getByText('degenerate (all fail)')).toBeInTheDocument()
    expect(container.querySelector('[data-ci-segment]')).toBeNull()
  })

  it('marks summaries drawing beyond the available samples as extrapolated', () => {
    const summaries = [makeSummary({ n_samples: 40 })]
    const { getByText } = render(
      <CiIntervalChart
        summaries={summaries}
        observations={[makeObservation({ n_available: 3 })]}
        title="CIs"
      />,
    )

    expect(getByText('extrapolated')).toBeInTheDocument()
  })

  it('renders a grayed "no samples" row for groups with zero available samples', () => {
    const { container, getByText } = render(
      <CiIntervalChart
        summaries={[makeSummary({ model: 'model-a', task_id: 'HumanEval/0' })]}
        observations={[
          makeObservation({ model: 'model-a', task_id: 'HumanEval/0' }),
          makeObservation({
            model: 'model-b',
            task_id: 'HumanEval/0',
            n_available: 0,
            observed_pass_rate: null,
          }),
        ]}
        title="CIs"
      />,
    )

    const emptyRow = container.querySelector('[data-ci-empty-row]')
    expect(emptyRow).not.toBeNull()
    expect(emptyRow?.textContent).toContain('model-b · HumanEval/0')
    expect(getByText('no samples')).toBeInTheDocument()
  })
})
