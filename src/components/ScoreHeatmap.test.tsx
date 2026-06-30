import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'

const defaultAxes = {
  xAxis: 'experiment_kind' as const,
  yAxis: 'model' as const,
  colorMeasure: 'avg_score' as const,
}

describe('ScoreHeatmap', () => {
  it('colors cells when one model is missing an experiment kind', () => {
    const { container } = render(
      <ScoreHeatmap
        {...defaultAxes}
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
        {...defaultAxes}
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
})
