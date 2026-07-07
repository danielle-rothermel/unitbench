import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OutcomeMixChart } from '@/components/sweep/OutcomeMixChart'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
  makeZeroNRow,
  styleWidthPercent,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows, type SweepGroupKey } from '@/fixtures'

const GROUPINGS: SweepGroupKey[][] = [['model'], ['task_id'], ['model', 'task_id']]

describe('OutcomeMixChart', () => {
  it('renders a 100%-stacked bar whose segment widths sum to ~100 per row', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['task_id'] })
    const { container } = render(
      <OutcomeMixChart rows={rows} groupKey="task_id" title="Outcome mix" />,
    )
    const items = [...container.querySelectorAll('li')]
    expect(items).toHaveLength(rows.length)
    for (const item of items) {
      const widths = [
        ...item.querySelectorAll('[data-outcome]'),
      ].map(styleWidthPercent)
      const total = widths.reduce((sum, width) => sum + width, 0)
      expect(total).toBeCloseTo(100, 5)
    }
  })

  it('shows a broken group as a full failed segment', () => {
    const rows = [
      makeRow({
        task_id: 'HumanEval/7',
        model: null,
        n: 10,
        pass_count: 0,
        fail_count: 10,
        pending_count: 0,
        error_count: 0,
        rate_limit_count: 0,
        pass_rate: 0,
        avg_score: 0,
      }),
    ]
    const { container } = render(
      <OutcomeMixChart rows={rows} groupKey="task_id" title="Outcome mix" />,
    )
    const segments = [...container.querySelectorAll('[data-outcome]')]
    expect(segments).toHaveLength(1)
    expect(segments[0].getAttribute('data-outcome')).toBe('failed')
    expect(styleWidthPercent(segments[0])).toBe(100)
    expect(container.textContent).toContain('0.0% pass')
  })

  it('maps each outcome to its own segment with a descriptive title', () => {
    const rows = [
      makeRow({
        model: 'mixed',
        n: 10,
        pass_count: 4,
        fail_count: 3,
        pending_count: 2,
        error_count: 1,
      }),
    ]
    const { container } = render(
      <OutcomeMixChart rows={rows} groupKey="model" title="Outcome mix" />,
    )
    const outcomes = [...container.querySelectorAll('[data-outcome]')].map(segment =>
      segment.getAttribute('data-outcome'),
    )
    expect(outcomes).toEqual(['passed', 'failed', 'pending', 'error'])
    expect(container.querySelector('[title="mixed: 4 passed (40.0%)"]')).not.toBeNull()
  })

  it('renders zero-n rows with no segments and no NaN (0/0 guard)', () => {
    const rows = [makeZeroNRow({ task_id: 'HumanEval/0', model: null })]
    const { container } = render(
      <OutcomeMixChart rows={rows} groupKey="task_id" title="Outcome mix" />,
    )
    expect(container.querySelectorAll('[data-outcome]')).toHaveLength(0)
    expect(container.textContent).toContain('—')
    expectNoRenderArtifacts(container)
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<OutcomeMixChart rows={[]} groupKey="task_id" title="Outcome mix" />)
    expect(screen.getByRole('region', { name: 'Outcome mix' })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('renders every grouping without artifacts (seed %i)', seed => {
    for (const groupBy of GROUPINGS) {
      const rows = makeSweepMetricsRows({ seed, groupBy })
      const { container, unmount } = render(
        <OutcomeMixChart rows={rows} groupKey="task_id" title="Outcome mix" />,
      )
      expect(container.querySelectorAll('li')).toHaveLength(rows.length)
      expectNoRenderArtifacts(container)
      unmount()
    }
  })
})
