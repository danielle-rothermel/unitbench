import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompressionMethodTable } from '@/components/compression/CompressionMethodTable'
import { makeCompressionResultRows, type CompressionMetric } from '@/fixtures/compression'
import { COMPRESSION_METHODS } from '@/fixtures/primitives'

function makeMetrics(
  ratios: Partial<Record<CompressionMetric['method'], number | null>> = {},
): CompressionMetric[] {
  return COMPRESSION_METHODS.map(method => {
    // Object.hasOwn so an explicit null override survives (?? would replace it).
    const ratio = Object.hasOwn(ratios, method) ? (ratios[method] ?? null) : 0.5
    return {
      method,
      ground_truth_bytes: 200,
      representation_bytes: 100,
      compressed_bytes: 100,
      ratio_to_ground_truth: ratio,
      percent_reduction_vs_ground_truth: ratio !== null ? (1 - ratio) * 100 : null,
    }
  })
}

describe('CompressionMethodTable', () => {
  it('renders every method in fixture order for generator rows', () => {
    const [row] = makeCompressionResultRows({ seed: 1, taskCount: 1, samplesPerTarget: 1 })
    render(
      <CompressionMethodTable
        metrics={row.compression_metrics}
        best_compression_ratio={row.best_compression_ratio}
        domainMax={1.25}
      />,
    )

    const methods = screen
      .getAllByTestId(/method-row-/)
      .map(tr => tr.getAttribute('data-testid'))
    expect(methods).toEqual(COMPRESSION_METHODS.map(method => `method-row-${method}`))
  })

  it('highlights the row with the minimum ratio as best', () => {
    render(
      <CompressionMethodTable
        metrics={makeMetrics({ zstd: 0.41, lzma: 0.45 })}
        best_compression_ratio={0.41}
        domainMax={1.25}
      />,
    )

    expect(screen.getByText('best')).toBeInTheDocument()
    expect(screen.getByTestId('method-row-zstd').className).toContain('green-bg')
  })

  it('renders em dashes for a null-ratio metric and never marks it best', () => {
    render(
      <CompressionMethodTable
        metrics={makeMetrics({ zstd: null, lzma: 0.45 })}
        best_compression_ratio={0.45}
        domainMax={1.25}
      />,
    )

    const zstdRow = screen.getByTestId('method-row-zstd')
    expect(zstdRow.textContent).toContain('—')
    expect(zstdRow.textContent).not.toContain('best')
    expect(screen.getByTestId('method-row-lzma').textContent).toContain('best')
  })

  it('skips the best highlight when every ratio is null', () => {
    render(
      <CompressionMethodTable
        metrics={makeMetrics({
          raw: null,
          zlib: null,
          gzip: null,
          bz2: null,
          lzma: null,
          zstd: null,
        })}
        best_compression_ratio={null}
        domainMax={1.25}
      />,
    )

    expect(screen.queryByText('best')).not.toBeInTheDocument()
  })

  it('renders an empty state when no metrics were recorded', () => {
    render(
      <CompressionMethodTable metrics={[]} best_compression_ratio={null} domainMax={1.25} />,
    )

    expect(
      screen.getByText('No compression metrics recorded for this sample.'),
    ).toBeInTheDocument()
  })

  it('flags a headline best that disagrees with the table minimum', () => {
    render(
      <CompressionMethodTable
        metrics={makeMetrics({ zstd: 0.41 })}
        best_compression_ratio={0.39}
        domainMax={1.25}
      />,
    )

    expect(
      screen.getByText(/headline best 0\.39× does not match the table minimum 0\.41×/),
    ).toBeInTheDocument()
  })
})
