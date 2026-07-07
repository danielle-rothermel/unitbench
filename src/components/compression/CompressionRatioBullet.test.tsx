import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompressionRatioBullet } from '@/components/compression/CompressionRatioBullet'

function widthPercent(element: HTMLElement): number {
  return Number.parseFloat(element.style.width)
}

describe('CompressionRatioBullet', () => {
  it('renders band, target marker, achieved bar, best tick, and unity reference for a full row', () => {
    render(
      <CompressionRatioBullet
        target_compression_ratio={0.5}
        achieved_compression_ratio={0.44}
        best_compression_ratio={0.41}
        domainMax={1.25}
      />,
    )

    expect(screen.getByTestId('budget-band')).toBeInTheDocument()
    expect(screen.getByTestId('target-marker')).toBeInTheDocument()
    expect(screen.getByTestId('achieved-bar')).toBeInTheDocument()
    expect(screen.getByTestId('best-tick')).toBeInTheDocument()
    expect(screen.getByTestId('unity-reference')).toBeInTheDocument()
    expect(screen.getByText('0.50×')).toBeInTheDocument()
    expect(screen.getByText('0.44×')).toBeInTheDocument()
    expect(screen.getByText('(Δ −0.06)')).toBeInTheDocument()
    expect(screen.getByText('best codec 0.41×')).toBeInTheDocument()
  })

  it('hides band and marker and shows the direct-run tag when target is null', () => {
    render(
      <CompressionRatioBullet
        target_compression_ratio={null}
        achieved_compression_ratio={0.62}
        best_compression_ratio={0.55}
        domainMax={1.25}
      />,
    )

    expect(screen.queryByTestId('budget-band')).not.toBeInTheDocument()
    expect(screen.queryByTestId('target-marker')).not.toBeInTheDocument()
    expect(screen.getByText('no target (direct run)')).toBeInTheDocument()
    expect(screen.getByTestId('achieved-bar')).toBeInTheDocument()
    expect(screen.queryByText(/Δ/)).not.toBeInTheDocument()
  })

  it('keeps the track and target marker and shows a placeholder when achieved is null', () => {
    render(
      <CompressionRatioBullet
        target_compression_ratio={0.5}
        achieved_compression_ratio={null}
        best_compression_ratio={null}
        domainMax={1.25}
      />,
    )

    expect(screen.getByTestId('target-marker')).toBeInTheDocument()
    expect(screen.queryByTestId('achieved-bar')).not.toBeInTheDocument()
    expect(screen.getByText('not measured')).toBeInTheDocument()
    expect(screen.getByTestId('unity-reference')).toBeInTheDocument()
  })

  it('labels expansion and keeps the 1.0 reference when achieved exceeds 1', () => {
    render(
      <CompressionRatioBullet
        target_compression_ratio={2.0}
        achieved_compression_ratio={1.4}
        best_compression_ratio={1.23}
        domainMax={2.2}
      />,
    )

    expect(screen.getByText('expansion')).toBeInTheDocument()
    expect(screen.getByTestId('unity-reference')).toBeInTheDocument()
    expect(screen.getByText('1.0 = no compression')).toBeInTheDocument()
  })

  it('clamps the achieved bar to the track when the ratio exceeds the domain', () => {
    render(
      <CompressionRatioBullet
        target_compression_ratio={0.5}
        achieved_compression_ratio={3.0}
        best_compression_ratio={null}
        domainMax={1.25}
      />,
    )

    expect(widthPercent(screen.getByTestId('achieved-bar'))).toBe(100)
  })
})
