import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LatencyRangeChart } from '@/components/sweep/LatencyRangeChart'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows, type SweepGroupKey } from '@/fixtures'

const GROUPINGS: SweepGroupKey[][] = [['model'], ['task_id'], ['model', 'task_id']]

function circleX(circle: Element): number {
  return Number.parseFloat(circle.getAttribute('cx') ?? 'NaN')
}

describe('LatencyRangeChart', () => {
  it('renders one dumbbell per model with formatted avg → p95 text', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['model'] })
    render(<LatencyRangeChart rows={rows} groupKey="model" title="Latency by model" />)

    const chart = screen.getByRole('region', { name: 'Latency by model' })
    expect(chart.querySelectorAll('li')).toHaveLength(rows.length)
    expect(chart.querySelectorAll('[data-latency="avg"]')).toHaveLength(rows.length)
    expect(chart.querySelectorAll('[data-latency="p95"]')).toHaveLength(rows.length)
    expect(chart.textContent).toContain(' s → ')
  })

  it('places the avg dot at or before the p95 dot for every seed', () => {
    for (const seed of FUZZ_SEEDS) {
      const rows = makeSweepMetricsRows({ seed, groupBy: ['model'] })
      const { container, unmount } = render(
        <LatencyRangeChart rows={rows} groupKey="model" title="Latency" />,
      )
      const avgDots = [...container.querySelectorAll('[data-latency="avg"]')]
      const p95Dots = [...container.querySelectorAll('[data-latency="p95"]')]
      expect(avgDots.length).toBeGreaterThan(0)
      expect(avgDots).toHaveLength(p95Dots.length)
      for (let index = 0; index < avgDots.length; index += 1) {
        expect(circleX(avgDots[index])).toBeLessThanOrEqual(circleX(p95Dots[index]))
      }
      unmount()
    }
  })

  it('renders — and no marks for a null-latency row', () => {
    const rows = [
      makeRow({ model: 'no-latency', avg_latency_ms: null, p95_latency_ms: null }),
      makeRow({ model: 'ok' }),
    ]
    const { container } = render(
      <LatencyRangeChart rows={rows} groupKey="model" title="Latency" />,
    )
    expect(container.textContent).toContain('— → —')
    expect(container.querySelectorAll('[data-latency="avg"]')).toHaveLength(1)
    expectNoRenderArtifacts(container)
  })

  it('clamps hand-built rows where p95 < avg to a zero-length range', () => {
    const rows = [makeRow({ avg_latency_ms: 9000, p95_latency_ms: 4000 })]
    const { container } = render(
      <LatencyRangeChart rows={rows} groupKey="model" title="Latency" />,
    )
    const avg = container.querySelector('[data-latency="avg"]')
    const p95 = container.querySelector('[data-latency="p95"]')
    expect(circleX(p95!)).toBe(circleX(avg!))
  })

  it('renders finite positions for a single row (degenerate scale)', () => {
    const rows = [makeRow({ avg_latency_ms: 5000, p95_latency_ms: 5000 })]
    const { container } = render(
      <LatencyRangeChart rows={rows} groupKey="model" title="Latency" />,
    )
    const avg = container.querySelector('[data-latency="avg"]')
    expect(Number.isFinite(circleX(avg!))).toBe(true)
    expectNoRenderArtifacts(container)
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<LatencyRangeChart rows={[]} groupKey="model" title="Latency" />)
    expect(screen.getByRole('region', { name: 'Latency' })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('renders every grouping without artifacts (seed %i)', seed => {
    for (const groupBy of GROUPINGS) {
      const rows = makeSweepMetricsRows({ seed, groupBy })
      const { container, unmount } = render(
        <LatencyRangeChart rows={rows} groupKey="task_id" title="Latency" />,
      )
      expect(container.querySelectorAll('li')).toHaveLength(rows.length)
      expectNoRenderArtifacts(container)
      unmount()
    }
  })
})
