import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorRateChart } from '@/components/sweep/ErrorRateChart'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
  styleWidthPercent,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows, type SweepGroupKey } from '@/fixtures'

const GROUPINGS: SweepGroupKey[][] = [['model'], ['task_id'], ['model', 'task_id']]

describe('ErrorRateChart', () => {
  it('renders one bar row per model with error/rate-limit/pending counts', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['model'] })
    render(<ErrorRateChart rows={rows} groupKey="model" title="Errors by model" />)

    const chart = screen.getByRole('region', { name: 'Errors by model' })
    expect(chart.querySelectorAll('li')).toHaveLength(rows.length)
    expect(chart.querySelectorAll('[data-bar="error"]')).toHaveLength(rows.length)
    for (const row of rows) {
      expect(chart).toHaveTextContent(
        `${row.error_count} err · ${row.rate_limit_count} rl · ${row.pending_count} pend`,
      )
    }
  })

  it('keeps the rate-limit segment within the error bar for every seed', () => {
    for (const seed of FUZZ_SEEDS) {
      const rows = makeSweepMetricsRows({ seed, groupBy: ['model', 'task_id'] })
      const { container, unmount } = render(
        <ErrorRateChart rows={rows} groupKey="model" title="Errors" />,
      )
      const errorBars = [...container.querySelectorAll('[data-bar="error"]')]
      const rateLimitBars = [...container.querySelectorAll('[data-bar="rate-limit"]')]
      expect(errorBars).toHaveLength(rateLimitBars.length)
      for (let index = 0; index < errorBars.length; index += 1) {
        expect(styleWidthPercent(rateLimitBars[index])).toBeLessThanOrEqual(
          styleWidthPercent(errorBars[index]),
        )
      }
      unmount()
    }
  })

  it('handles the rate_limit_count === error_count boundary (fully covered bar)', () => {
    const { container } = render(
      <ErrorRateChart
        rows={[makeRow({ error_count: 6, rate_limit_count: 6 })]}
        groupKey="model"
        title="Errors"
      />,
    )
    const errorBar = container.querySelector('[data-bar="error"]')
    const rateLimitBar = container.querySelector('[data-bar="rate-limit"]')
    expect(errorBar).not.toBeNull()
    expect(styleWidthPercent(rateLimitBar!)).toBe(styleWidthPercent(errorBar!))
  })

  it('handles the rate_limit_count === 0 boundary (no inner segment)', () => {
    const { container } = render(
      <ErrorRateChart
        rows={[makeRow({ error_count: 6, rate_limit_count: 0 })]}
        groupKey="model"
        title="Errors"
      />,
    )
    const rateLimitBar = container.querySelector('[data-bar="rate-limit"]')
    expect(styleWidthPercent(rateLimitBar!)).toBe(0)
  })

  it('clamps hand-built rows where rate_limit_count exceeds error_count', () => {
    const { container } = render(
      <ErrorRateChart
        rows={[makeRow({ error_count: 2, rate_limit_count: 9 })]}
        groupKey="model"
        title="Errors"
      />,
    )
    const errorBar = container.querySelector('[data-bar="error"]')
    const rateLimitBar = container.querySelector('[data-bar="rate-limit"]')
    expect(styleWidthPercent(rateLimitBar!)).toBeLessThanOrEqual(styleWidthPercent(errorBar!))
  })

  it('sorts rows desc by error_count', () => {
    const rows = [
      makeRow({ model: 'low', error_count: 1 }),
      makeRow({ model: 'high', error_count: 9 }),
    ]
    const { container } = render(<ErrorRateChart rows={rows} groupKey="model" title="Errors" />)
    const labels = [...container.querySelectorAll('li [title]')].map(el => el.textContent)
    expect(labels).toEqual(['high', 'low'])
  })

  it('highlights the sliced group value', () => {
    const rows = [makeRow({ model: 'a' }), makeRow({ model: 'b' })]
    const { container } = render(
      <ErrorRateChart rows={rows} groupKey="model" title="Errors" highlightValue="b" />,
    )
    const highlighted = [...container.querySelectorAll('li')].filter(item =>
      item.className.includes('--accent-bg'),
    )
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]).toHaveTextContent('b')
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<ErrorRateChart rows={[]} groupKey="model" title="Errors" />)
    expect(screen.getByRole('region', { name: 'Errors' })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('renders every grouping without artifacts (seed %i)', seed => {
    for (const groupBy of GROUPINGS) {
      const rows = makeSweepMetricsRows({ seed, groupBy })
      const { container, unmount } = render(
        <ErrorRateChart rows={rows} groupKey="model" title="Errors" />,
      )
      expect(container.querySelectorAll('li')).toHaveLength(rows.length)
      expectNoRenderArtifacts(container)
      unmount()
    }
  })
})
