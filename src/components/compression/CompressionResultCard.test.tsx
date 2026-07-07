import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompressionResultCard } from '@/components/compression/CompressionResultCard'
import { makeCompressionResultRows } from '@/fixtures/compression'
import { COMPRESSION_METHODS } from '@/fixtures/primitives'
import { formatRatio, ratioDomainMax } from '@/lib/compression-view'

const SEEDS = [1, 7, 42]

describe('CompressionResultCard', () => {
  it.each(SEEDS)('renders every generator row for seed %i without NaN or undefined', seed => {
    const rows = makeCompressionResultRows({ seed, taskCount: 2 })
    const domainMax = ratioDomainMax(rows)

    for (const row of rows) {
      const { container, unmount } = render(
        <CompressionResultCard row={row} ratioDomainMax={domainMax} />,
      )

      expect(container.textContent).not.toContain('NaN')
      expect(container.textContent).not.toContain('undefined')
      const styles = [...container.querySelectorAll('[style]')].map(
        element => element.getAttribute('style') ?? '',
      )
      expect(styles.some(style => style.includes('NaN'))).toBe(false)

      unmount()
    }
  })

  it('surfaces target, achieved, and best ratios plus the encoder budget', () => {
    const [row] = makeCompressionResultRows({ seed: 7, taskCount: 1, samplesPerTarget: 1 })
    render(<CompressionResultCard row={row} />)

    expect(
      screen.getAllByText(formatRatio(row.target_compression_ratio)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(formatRatio(row.achieved_compression_ratio)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(formatRatio(row.best_compression_ratio)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Encoder char budget')).toBeInTheDocument()
  })

  it('renders identity tags, the result badge, and all six method rows', () => {
    const [row] = makeCompressionResultRows({ seed: 1, taskCount: 1, samplesPerTarget: 1 })
    const { container } = render(<CompressionResultCard row={row} />)

    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    const headerScope = within(header as HTMLElement)
    expect(headerScope.getByText(row.identity.task_id)).toBeInTheDocument()
    expect(headerScope.getByText(row.identity.model)).toBeInTheDocument()
    expect(
      headerScope.getByText(`sample #${row.identity.sample_index}`),
    ).toBeInTheDocument()
    expect(headerScope.getByText(row.identity.experiment_kind)).toBeInTheDocument()
    expect(headerScope.getByText(row.result_state)).toBeInTheDocument()

    expect(screen.getAllByTestId(/^method-row-/)).toHaveLength(
      COMPRESSION_METHODS.length,
    )
  })

  it('renders an em-dash score for an error row with a null score', () => {
    const [row] = makeCompressionResultRows({ seed: 1, taskCount: 1, samplesPerTarget: 1 })
    render(
      <CompressionResultCard
        row={{ ...row, result_state: 'error', score: null }}
      />,
    )

    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByText('score —')).toBeInTheDocument()
  })
})
