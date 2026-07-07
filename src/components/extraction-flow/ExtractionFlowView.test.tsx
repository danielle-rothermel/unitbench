import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExtractionFlowView } from '@/components/extraction-flow/ExtractionFlowView'
import {
  makeExtractionFlowSample,
  makeExtractionFlowSamples,
} from '@/fixtures/extraction'

const STAGE_HEADERS = [
  /1 · Code/,
  /2 · Function selection/,
  /3 · Test results/,
] as const

describe('ExtractionFlowView', () => {
  it('renders prompt, extracted code, and entry_point chip for a passed sample', () => {
    const sample = makeExtractionFlowSample({ seed: 3, outcome: 'passed' })
    const { container } = render(<ExtractionFlowView sample={sample} />)

    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Extracted code')).toBeInTheDocument()
    expect(container.textContent).toContain('def rolling_max(numbers)')
    expect(screen.getByText('entry_point: rolling_max')).toBeInTheDocument()
  })

  it('shows the extraction-failed banner and extracted-code placeholder', () => {
    const sample = makeExtractionFlowSample({
      seed: 7,
      outcome: 'extraction_failed',
    })
    render(<ExtractionFlowView sample={sample} />)

    expect(screen.getByText('Extraction failed')).toBeInTheDocument()
    expect(
      screen.getByText('No code block found in the raw generation.'),
    ).toBeInTheDocument()
    expect(screen.getByText('extracted code — none')).toBeInTheDocument()
    expect(screen.getByText('Raw generation')).toBeInTheDocument()
  })

  it('shows the raw-generation placeholder for an empty generation', () => {
    const sample = makeExtractionFlowSample({
      seed: 9,
      outcome: 'empty_generation',
    })
    render(<ExtractionFlowView sample={sample} />)

    expect(screen.getByText('Empty generation')).toBeInTheDocument()
    expect(screen.getByText('raw generation — none')).toBeInTheDocument()
    expect(screen.getByText('extracted code — none')).toBeInTheDocument()
  })

  it('renders one table row per per_test_result for a tests_failed sample', () => {
    const sample = makeExtractionFlowSample({ seed: 5, outcome: 'tests_failed' })
    render(<ExtractionFlowView sample={sample} />)

    const rows = screen.getAllByRole('row')
    // one header row + one body row per test result
    expect(rows).toHaveLength(1 + sample.per_test_results.length)
  })

  it('renders every seed 1-20 with prediction_id and all stage headers', () => {
    for (const sample of makeExtractionFlowSamples(20)) {
      const view = render(<ExtractionFlowView sample={sample} />)
      expect(
        screen.getByText(sample.identity.prediction_id),
      ).toBeInTheDocument()
      for (const header of STAGE_HEADERS) {
        expect(screen.getByText(header)).toBeInTheDocument()
      }
      view.unmount()
    }
  })
})
