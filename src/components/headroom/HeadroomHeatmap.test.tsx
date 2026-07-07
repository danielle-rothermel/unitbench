import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  facetOrderAfterDrag,
  HeadroomHeatmap,
} from '@/components/headroom/HeadroomHeatmap'
import { makeHeadroomPoints, type HeadroomPoint } from '@/fixtures/heatmap'
import type { HeadroomHeatmapState } from '@/lib/headroom-heatmap-params'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const defaultState: HeadroomHeatmapState = {
  view: 'facets',
  x_bin_count: 10,
  y_bin_count: 10,
  seed: 1,
}

const LOCALE_BASELINE = [
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-5',
  'google/gemini-3-flash',
  'openai/gpt-5.5-codex',
]

function panelKeys(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[data-facet-panel]')].map(panel =>
    panel.getAttribute('data-facet-panel'),
  )
}

beforeEach(() => {
  push.mockClear()
})

describe('HeadroomHeatmap', () => {
  it.each([[1], [21], [99]])(
    'renders a full facet grid without NaN styles at seed %d',
    seed => {
      const points = makeHeadroomPoints({ seed })
      const { container } = render(
        <HeadroomHeatmap points={points} state={{ ...defaultState, seed }} />,
      )

      expect(panelKeys(container)).toEqual(LOCALE_BASELINE)
      expect(container.querySelectorAll('[data-cell]')).toHaveLength(4 * 10 * 10)
      const styles = [...container.querySelectorAll('[style]')].map(
        element => element.getAttribute('style') ?? '',
      )
      expect(styles.some(style => style.includes('NaN'))).toBe(false)
    },
  )

  it('sums each facet grid to that model point count via tooltips', () => {
    const points = makeHeadroomPoints({ seed: 1, taskCount: 6 })
    const { container } = render(
      <HeadroomHeatmap points={points} state={defaultState} />,
    )

    const firstPanel = container.querySelector(
      `[data-facet-panel="${LOCALE_BASELINE[0]}"]`,
    )
    const counted = [...(firstPanel?.querySelectorAll('[data-cell]') ?? [])]
      .map(cell => cell.getAttribute('title') ?? '')
      .filter(title => title !== 'No tasks')
      .reduce((total, title) => total + Number(/(\d+) tasks?$/.exec(title)?.[1] ?? 0), 0)
    expect(counted).toBe(
      points.filter(point => point.model === LOCALE_BASELINE[0]).length,
    )
  })

  it('renders one combined panel in overlay view', () => {
    const points = makeHeadroomPoints({ seed: 1 })
    const { container } = render(
      <HeadroomHeatmap points={points} state={{ ...defaultState, view: 'overlay' }} />,
    )

    const panels = container.querySelectorAll('[data-facet-panel]')
    expect(panels).toHaveLength(1)
    expect(panels[0].getAttribute('data-facet-panel')).toBe('all')
    expect(panels[0].textContent).toContain(`${points.length} tasks·targets`)
  })

  it('applies facetOrder from state to the panel sequence', () => {
    const points = makeHeadroomPoints({ seed: 1 })
    const { container } = render(
      <HeadroomHeatmap
        points={points}
        state={{
          ...defaultState,
          facetOrder: ['openai/gpt-5.5-codex', 'google/gemini-3-flash'],
        }}
      />,
    )

    expect(panelKeys(container)).toEqual([
      'openai/gpt-5.5-codex',
      'google/gemini-3-flash',
      'anthropic/claude-haiku-4-5',
      'anthropic/claude-sonnet-5',
    ])
  })

  it('ignores unknown facetOrder keys without phantom panels', () => {
    const points = makeHeadroomPoints({ seed: 1 })
    const { container } = render(
      <HeadroomHeatmap
        points={points}
        state={{ ...defaultState, facetOrder: ['not-a-model', 'google/gemini-3-flash'] }}
      />,
    )

    expect(panelKeys(container)).toEqual([
      'google/gemini-3-flash',
      'anthropic/claude-haiku-4-5',
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.5-codex',
    ])
  })

  it('commits an href without facetOrder when order is reset', () => {
    const points = makeHeadroomPoints({ seed: 1 })
    render(
      <HeadroomHeatmap
        points={points}
        state={{ ...defaultState, facetOrder: ['openai/gpt-5.5-codex'] }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset order' }))
    expect(push).toHaveBeenCalledTimes(1)
    const href = String(push.mock.calls[0]?.[0])
    expect(href.startsWith('/dev/headroom-heatmap')).toBe(true)
    expect(href).not.toContain('facetOrder')
  })

  it('renders the empty panel for no points', () => {
    const { container } = render(<HeadroomHeatmap points={[]} state={defaultState} />)

    expect(screen.getByText('No headroom points to bin.')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(0)
    // Controls stay visible so state remains editable.
    expect(screen.getByRole('button', { name: 'Facets' })).toBeInTheDocument()
  })

  it('shows the edge-clamp footnote when fixed-domain data is clamped', () => {
    const wide: HeadroomPoint = {
      model: 'm1',
      task_id: 'HumanEval/0',
      experiment_kind: 'humaneval_encdec',
      target_compression_ratio: 2,
      achieved_compression_ratio: 2.2,
      mean_pass_rate: 0.5,
      n_samples: 3,
    }
    render(
      <HeadroomHeatmap
        points={[wide]}
        state={{ ...defaultState, x_domain: [0, 1] }}
      />,
    )

    expect(
      screen.getByText(/edge bins include out-of-range points/),
    ).toBeInTheDocument()
  })
})

describe('facetOrderAfterDrag', () => {
  const baseline = ['a', 'b', 'c', 'd']

  it('moves the active key to the over position', () => {
    expect(facetOrderAfterDrag(baseline, baseline, 'd', 'a')).toEqual([
      'd',
      'a',
      'b',
      'c',
    ])
  })

  it('collapses back to undefined when the drag restores the baseline', () => {
    expect(facetOrderAfterDrag(['b', 'a', 'c', 'd'], baseline, 'b', 'a')).toBeUndefined()
  })

  it('leaves the order alone for unknown keys', () => {
    expect(facetOrderAfterDrag(baseline, baseline, 'nope', 'a')).toBeUndefined()
    expect(
      facetOrderAfterDrag(['b', 'a', 'c', 'd'], baseline, 'nope', 'a'),
    ).toEqual(['b', 'a', 'c', 'd'])
  })
})
