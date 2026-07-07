import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PerfMeanVarianceChart } from '@/components/sweep/PerfMeanVarianceChart'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
  makeZeroNRow,
  styleWidthPercent,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows, type SweepGroupKey } from '@/fixtures'

const GROUPINGS: SweepGroupKey[][] = [['model'], ['task_id'], ['model', 'task_id']]

describe('PerfMeanVarianceChart', () => {
  it('tracks avg_score on the fixed [0, 1] domain', () => {
    const rows = [
      makeRow({ model: 'a', avg_score: 0.25, stddev_score: null }),
      makeRow({ model: 'b', avg_score: 1, stddev_score: null }),
    ]
    const { container } = render(
      <PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf" />,
    )
    const widths = [...container.querySelectorAll('[data-bar="avg-score"]')].map(
      styleWidthPercent,
    )
    // Sorted desc by avg_score: b (1.0) then a (0.25).
    expect(widths).toEqual([100, 25])
  })

  it('renders per-model fixture rows with n annotations', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['model'] })
    render(<PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf by model" />)
    const chart = screen.getByRole('region', { name: 'Perf by model' })
    expect(chart.querySelectorAll('li')).toHaveLength(rows.length)
    expect(chart).toHaveTextContent('n=96')
  })

  it('uses task labels for the per-task grouping', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['task_id'], taskCount: 4 })
    render(<PerfMeanVarianceChart rows={rows} groupKey="task_id" title="Perf by task" />)
    const chart = screen.getByRole('region', { name: 'Perf by task' })
    for (const row of rows) {
      expect(chart).toHaveTextContent(row.task_id ?? 'missing')
    }
  })

  it('omits the whisker (not zero-length) when stddev_score is null', () => {
    const rows = [makeRow({ avg_score: 0.5, stddev_score: null })]
    const { container } = render(
      <PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf" />,
    )
    expect(container.querySelector('[data-bar="avg-score"]')).not.toBeNull()
    expect(container.querySelector('[data-bar="stddev-whisker"]')).toBeNull()
  })

  it('clamps the whisker to the [0, 1] score domain', () => {
    const rows = [makeRow({ avg_score: 0.5, stddev_score: 0.9 })]
    const { container } = render(
      <PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf" />,
    )
    const whisker = container.querySelector('[data-bar="stddev-whisker"]')
    const style = whisker?.getAttribute('style') ?? ''
    expect(style).toContain('left: 0%')
    expect(styleWidthPercent(whisker!)).toBe(100)
  })

  it('renders — and no bar for zero-n rows (null avg_score)', () => {
    const rows = [makeZeroNRow({ model: 'empty' }), makeRow({ model: 'ok' })]
    const { container } = render(
      <PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf" />,
    )
    expect(container.querySelectorAll('[data-bar="avg-score"]')).toHaveLength(1)
    expect(container.textContent).toContain('—')
    expectNoRenderArtifacts(container)
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<PerfMeanVarianceChart rows={[]} groupKey="model" title="Perf" />)
    expect(screen.getByRole('region', { name: 'Perf' })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('renders every grouping without artifacts (seed %i)', seed => {
    for (const groupBy of GROUPINGS) {
      const rows = makeSweepMetricsRows({ seed, groupBy })
      const { container, unmount } = render(
        <PerfMeanVarianceChart rows={rows} groupKey="model" title="Perf" />,
      )
      expect(container.querySelectorAll('li')).toHaveLength(rows.length)
      // Whiskers must stay inside the track for every row.
      for (const whisker of container.querySelectorAll('[data-bar="stddev-whisker"]')) {
        const style = whisker.getAttribute('style') ?? ''
        const left = Number.parseFloat(style.match(/left:\s*([\d.]+)%/)?.[1] ?? 'NaN')
        expect(left).toBeGreaterThanOrEqual(0)
        expect(left + styleWidthPercent(whisker)).toBeLessThanOrEqual(100.0001)
      }
      expectNoRenderArtifacts(container)
      unmount()
    }
  })
})
