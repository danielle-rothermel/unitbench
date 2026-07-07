import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CompressionResultsDemoPage from '@/app/dev/compression-results/page'
import { EDGE_CASE_ROWS } from '@/app/dev/compression-results/demo-rows'

describe('CompressionResultsDemoPage', () => {
  it('renders the intro, one section per target ratio, and every edge-case label', () => {
    render(<CompressionResultsDemoPage />)

    expect(
      screen.getByText('Compression results (fixture demo)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Lower ratio = tighter compression/),
    ).toBeInTheDocument()

    for (const target of ['0.25×', '0.50×', '1.00×', '2.00×']) {
      expect(screen.getByText(`Target ${target}`)).toBeInTheDocument()
    }

    expect(screen.getByText('Edge cases (hand-authored)')).toBeInTheDocument()
    for (const edgeCase of EDGE_CASE_ROWS) {
      expect(screen.getByText(edgeCase.label)).toBeInTheDocument()
    }
  })
})
