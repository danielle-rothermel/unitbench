import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'
import {
  DEFAULT_HEATMAP_COLOR,
  DEFAULT_HEATMAP_X,
  DEFAULT_HEATMAP_Y,
} from '@/lib/heatmap-config'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const defaultState = {
  filterIn: {},
  filterOut: {},
  x: DEFAULT_HEATMAP_X,
  y: DEFAULT_HEATMAP_Y,
  color: DEFAULT_HEATMAP_COLOR,
}

describe('ScoreHeatmap', () => {
  it('colors cells when one model is missing an experiment kind', () => {
    const { container } = render(
      <ScoreHeatmap
        state={defaultState}
        rows={[
          {
            model: 'openai/gpt-5.4-nano',
            experiment_kind: 'humaneval_direct',
            n: 987,
            avg_score: 0.147,
          },
          {
            model: 'openai/gpt-5.4-nano',
            experiment_kind: 'humaneval_encdec',
            n: 3451,
            avg_score: 0,
          },
          {
            model: 'openai/gpt-5-nano',
            experiment_kind: 'humaneval_direct',
            n: 987,
            avg_score: 0.75,
          },
        ]}
      />,
    )

    const coloredCells = container.querySelectorAll('[style*="background-color"]')
    const backgrounds = [...coloredCells].map(
      cell => cell.getAttribute('style') ?? '',
    )
    expect(backgrounds.some(style => style.includes('rgb('))).toBe(true)
    expect(backgrounds.some(style => style.includes('NaN'))).toBe(false)
  })

  it('uses the same color scale for every column', () => {
    const { container } = render(
      <ScoreHeatmap
        state={defaultState}
        rows={[
          {
            model: 'model-a',
            experiment_kind: 'humaneval_direct',
            n: 10,
            avg_score: 0.5,
          },
          {
            model: 'model-a',
            experiment_kind: 'humaneval_encdec',
            n: 10,
            avg_score: 0.5,
          },
        ]}
      />,
    )

    const dataCells = container.querySelectorAll(
      '[style*="background-color: rgb"]',
    )
    const colors = [...dataCells].map(cell => cell.getAttribute('style'))
    expect(colors).toHaveLength(2)
    expect(colors[0]).toBe(colors[1])
  })

  it('applies manual row order from state', () => {
    const { container } = render(
      <ScoreHeatmap
        state={{
          ...defaultState,
          rowOrder: ['openai/gpt-5-nano', 'openai/gpt-5.4-nano'],
        }}
        rows={[
          {
            model: 'openai/gpt-5.4-nano',
            experiment_kind: 'humaneval_direct',
            n: 987,
            avg_score: 0.147,
          },
          {
            model: 'openai/gpt-5-nano',
            experiment_kind: 'humaneval_direct',
            n: 987,
            avg_score: 0.75,
          },
        ]}
      />,
    )

    const rowLabels = [...container.querySelectorAll('button[aria-label^="Drag row"]')]
      .map(button => button.textContent?.replace('⠿', '').trim())
    expect(rowLabels).toEqual([
      'openai/gpt-5-nano',
      'openai/gpt-5.4-nano',
    ])
  })
})
