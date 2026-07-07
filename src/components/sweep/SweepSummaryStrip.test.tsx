import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SweepSummaryStrip } from '@/components/sweep/SweepSummaryStrip'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
  makeZeroNRow,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows } from '@/fixtures'

describe('SweepSummaryStrip', () => {
  it('sums counts and total cost across rows (counts are additive)', () => {
    render(
      <SweepSummaryStrip
        rows={[
          makeRow({
            n: 100,
            pass_count: 60,
            error_count: 10,
            rate_limit_count: 4,
            total_cost: 1.5,
          }),
          makeRow({
            n: 50,
            pass_count: 30,
            error_count: 2,
            rate_limit_count: 1,
            total_cost: 0.5,
          }),
        ]}
      />,
    )

    const strip = screen.getByRole('region', { name: 'Sweep summary' })
    expect(strip).toHaveTextContent('Total runs')
    expect(strip).toHaveTextContent('150')
    // 90 / 150
    expect(strip).toHaveTextContent('60.0%')
    expect(strip).toHaveTextContent('$2.00000')
    expect(strip).toHaveTextContent('API errors')
    expect(strip).toHaveTextContent('12')
    expect(strip).toHaveTextContent('Rate limited')
    expect(strip).toHaveTextContent('5')
  })

  it('renders — for pass rate and cost when there are no runs', () => {
    const { container } = render(
      <SweepSummaryStrip rows={[makeZeroNRow({ avg_cost: null, total_cost: null })]} />,
    )
    const strip = screen.getByRole('region', { name: 'Sweep summary' })
    expect(strip).toHaveTextContent('—')
    expect(strip).toHaveTextContent('no runs')
    expectNoRenderArtifacts(container)
  })

  it('renders zero totals for empty rows without artifacts', () => {
    const { container } = render(<SweepSummaryStrip rows={[]} />)
    expect(screen.getByRole('region', { name: 'Sweep summary' })).toHaveTextContent('0')
    expectNoRenderArtifacts(container)
  })

  it.each(FUZZ_SEEDS)('renders fixture rows without artifacts (seed %i)', seed => {
    const { container } = render(
      <SweepSummaryStrip rows={makeSweepMetricsRows({ seed, groupBy: ['model'] })} />,
    )
    expectNoRenderArtifacts(container)
  })
})
