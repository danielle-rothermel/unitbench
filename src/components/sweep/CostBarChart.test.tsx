import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CostBarChart } from '@/components/sweep/CostBarChart'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
  styleWidthPercent,
} from '@/components/sweep/sweep-test-helpers'
import { formatCostCell } from '@/lib/format'
import { makeSweepMetricsRows, type SweepGroupKey } from '@/fixtures'

const GROUPINGS: SweepGroupKey[][] = [['model'], ['task_id'], ['model', 'task_id']]

describe('CostBarChart', () => {
  it('renders one bar per model with formatCostCell values', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['model'] })
    render(<CostBarChart rows={rows} groupKey="model" title="Cost by model" />)

    const chart = screen.getByRole('region', { name: 'Cost by model' })
    expect(chart.querySelectorAll('li')).toHaveLength(rows.length)
    for (const row of rows) {
      expect(chart).toHaveTextContent(formatCostCell(row.avg_cost))
      expect(chart).toHaveTextContent(formatCostCell(row.total_cost))
    }
  })

  it('renders per-task rows with task labels', () => {
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['task_id'], taskCount: 3 })
    render(<CostBarChart rows={rows} groupKey="task_id" title="Cost by task" />)
    const chart = screen.getByRole('region', { name: 'Cost by task' })
    for (const row of rows) {
      expect(chart).toHaveTextContent(row.task_id ?? 'missing')
    }
  })

  it('gives the widest bar (100%) to the max avg_cost row', () => {
    const rows = [
      makeRow({ model: 'cheap', avg_cost: 0.001 }),
      makeRow({ model: 'pricey', avg_cost: 0.008 }),
    ]
    const { container } = render(<CostBarChart rows={rows} groupKey="model" title="Cost" />)
    const widths = [...container.querySelectorAll('[data-bar="avg-cost"]')].map(
      styleWidthPercent,
    )
    // Sorted desc by avg_cost, so the first bar is the max.
    expect(widths[0]).toBe(100)
    expect(widths[1]).toBeCloseTo(12.5)
  })

  it('renders — and a zero-width bar for a null avg_cost row', () => {
    const rows = [makeRow({ model: 'a', avg_cost: null, total_cost: null }), makeRow({ model: 'b' })]
    const { container } = render(<CostBarChart rows={rows} groupKey="model" title="Cost" />)
    expect(container.textContent).toContain('—')
    const widths = [...container.querySelectorAll('[data-bar="avg-cost"]')].map(
      styleWidthPercent,
    )
    // Null-measure rows sort last.
    expect(widths[1]).toBe(0)
    expectNoRenderArtifacts(container)
  })

  it('renders zero-width bars when every cost is null (max <= 0 guard)', () => {
    const rows = [makeRow({ avg_cost: null, total_cost: null })]
    const { container } = render(<CostBarChart rows={rows} groupKey="model" title="Cost" />)
    expect(styleWidthPercent(container.querySelector('[data-bar="avg-cost"]')!)).toBe(0)
    expectNoRenderArtifacts(container)
  })

  it('truncates long canonical enc-dec labels with a title tooltip', () => {
    const label = 'anthropic/claude-sonnet-5 -> anthropic/claude-haiku-4-5'
    const { container } = render(
      <CostBarChart rows={[makeRow({ model: label })]} groupKey="model" title="Cost" />,
    )
    const labelSpan = container.querySelector(`[title="${label}"]`)
    expect(labelSpan).not.toBeNull()
    expect(labelSpan?.className).toContain('truncate')
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<CostBarChart rows={[]} groupKey="task_id" title="Cost" />)
    expect(screen.getByRole('region', { name: 'Cost' })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('renders every grouping without artifacts (seed %i)', seed => {
    for (const groupBy of GROUPINGS) {
      const rows = makeSweepMetricsRows({ seed, groupBy })
      const { container, unmount } = render(
        <CostBarChart rows={rows} groupKey="model" title="Cost" />,
      )
      expect(container.querySelectorAll('li')).toHaveLength(rows.length)
      expectNoRenderArtifacts(container)
      unmount()
    }
  })
})
