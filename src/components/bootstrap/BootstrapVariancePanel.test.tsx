import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeBootstrapSampleRows } from '@/fixtures/bootstrap'
import { BootstrapVariancePanel } from '@/components/bootstrap/BootstrapVariancePanel'

// 4 models x 24 tasks x 3 samples; low resample count keeps the tests fast
const rows = makeBootstrapSampleRows({ seed: 12 })
const FAST_CONFIG = { n_resamples: 500 }

function intervalLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-ci-row] svg')].map(
    svg => svg.getAttribute('aria-label') ?? '',
  )
}

describe('BootstrapVariancePanel', () => {
  it('renders controls, the forest plot, and the across-N view', () => {
    const { container } = render(
      <BootstrapVariancePanel rows={rows} initialConfig={FAST_CONFIG} />,
    )

    expect(screen.getByText('Grouping')).toBeInTheDocument()
    expect(screen.getByText('Pass-rate CIs per model')).toBeInTheDocument()
    expect(screen.getByText('CI width vs N')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-ci-row]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-ci-interval]').length).toBeGreaterThan(0)
  })

  it('renders identical interval labels for the same seed', () => {
    const first = render(
      <BootstrapVariancePanel
        rows={rows}
        initialConfig={{ ...FAST_CONFIG, seed: 17 }}
      />,
    )
    const second = render(
      <BootstrapVariancePanel
        rows={rows}
        initialConfig={{ ...FAST_CONFIG, seed: 17 }}
      />,
    )

    expect(intervalLabels(first.container)).toEqual(intervalLabels(second.container))
  })

  it('renders differing bounds for different seeds', () => {
    const seedA = render(
      <BootstrapVariancePanel
        rows={rows}
        initialConfig={{ ...FAST_CONFIG, seed: 17 }}
      />,
    )
    const seedB = render(
      <BootstrapVariancePanel
        rows={rows}
        initialConfig={{ ...FAST_CONFIG, seed: 18 }}
      />,
    )

    const labelsA = intervalLabels(seedA.container)
    const labelsB = intervalLabels(seedB.container)
    expect(labelsA).toHaveLength(labelsB.length)
    expect(labelsA).not.toEqual(labelsB)
  })

  it('updates the forest rows when switching grouping from model to task', async () => {
    const { container } = render(
      <BootstrapVariancePanel rows={rows} initialConfig={FAST_CONFIG} />,
    )
    expect(container.querySelectorAll('[data-ci-row]')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'task' }))

    await waitFor(() => {
      expect(screen.getByText('Pass-rate CIs per task')).toBeInTheDocument()
      expect(container.querySelectorAll('[data-ci-row]')).toHaveLength(24)
    })
  })

  it('re-resamples view 1 at the slider N and echoes it in the labels', async () => {
    const { container } = render(
      <BootstrapVariancePanel rows={rows} initialConfig={FAST_CONFIG} />,
    )
    expect(container.textContent).toContain('n=72')

    fireEvent.change(screen.getByLabelText('N per group'), {
      target: { value: '5' },
    })

    await waitFor(() => {
      expect(container.textContent).toContain('n=5')
      expect(container.textContent).not.toContain('n=72')
    })
  })

  it('renders the empty-state card and no SVG for empty rows', () => {
    const { container } = render(<BootstrapVariancePanel rows={[]} />)

    expect(
      screen.getByText('No bootstrap samples for this scenario.'),
    ).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })
})
