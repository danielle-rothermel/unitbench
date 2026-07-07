import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PassRateStripPlot } from '@/components/sweep/PassRateStripPlot'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
} from '@/components/sweep/sweep-test-helpers'
import { FIXTURE_MODELS, makeSweepMetricsRows } from '@/fixtures'

const TITLE = 'Pass rate per task, by model'

function circleX(circle: Element): number {
  return Number.parseFloat(circle.getAttribute('cx') ?? 'NaN')
}

/** model×task rows for two models over the given tasks, pass_rate overridable per row. */
function crossRows(passRate: (model: string, taskId: string) => number | null) {
  const models = ['model-a', 'model-b']
  const taskIds = ['HumanEval/0', 'HumanEval/1', 'HumanEval/2']
  return models.flatMap(model =>
    taskIds.map(taskId => {
      const rate = passRate(model, taskId)
      return makeRow({ model, task_id: taskId, pass_rate: rate, avg_score: rate })
    }),
  )
}

describe('PassRateStripPlot', () => {
  it('renders one facet per model with one dot per task', () => {
    const taskCount = 4
    const rows = makeSweepMetricsRows({ seed: 1, groupBy: ['model', 'task_id'], taskCount })
    render(<PassRateStripPlot rows={rows} />)

    const chart = screen.getByRole('region', { name: TITLE })
    const facets = chart.querySelectorAll('li')
    expect(facets).toHaveLength(FIXTURE_MODELS.length)
    for (const facet of facets) {
      expect(facet.querySelectorAll('circle')).toHaveLength(taskCount)
    }
    for (const model of FIXTURE_MODELS) {
      expect(chart.querySelector(`[title="${model}"]`)).not.toBeNull()
    }
  })

  it('shows a broken model as a whole facet of dots at x = 0', () => {
    const rows = crossRows(model => (model === 'model-b' ? 0 : 0.8))
    const { container } = render(<PassRateStripPlot rows={rows} />)

    const facets = [...container.querySelectorAll('li')]
    const brokenFacet = facets.find(facet => facet.querySelector('[title="model-b"]'))
    expect(brokenFacet).toBeDefined()
    const dots = [...brokenFacet!.querySelectorAll('circle')]
    expect(dots).toHaveLength(3)
    for (const dot of dots) {
      expect(circleX(dot)).toBe(0)
    }
  })

  it('shows a broken task as an x = 0 dot repeated across every facet', () => {
    const rows = crossRows((_, taskId) => (taskId === 'HumanEval/1' ? 0 : 0.75))
    const { container } = render(<PassRateStripPlot rows={rows} />)

    const brokenDots = [...container.querySelectorAll('[data-task-id="HumanEval/1"]')]
    expect(brokenDots).toHaveLength(2) // once per model facet
    for (const dot of brokenDots) {
      expect(circleX(dot)).toBe(0)
    }
    const healthyDots = [...container.querySelectorAll('[data-task-id="HumanEval/0"]')]
    for (const dot of healthyDots) {
      expect(circleX(dot)).toBe(75)
    }
  })

  it('skips dots for null pass_rate rows without artifacts', () => {
    const rows = crossRows((_, taskId) => (taskId === 'HumanEval/2' ? null : 0.5))
    const { container } = render(<PassRateStripPlot rows={rows} />)

    expect(container.querySelectorAll('[data-task-id="HumanEval/2"]')).toHaveLength(0)
    expect(container.querySelectorAll('circle')).toHaveLength(4)
    expectNoRenderArtifacts(container)
  })

  it('highlights only the dots of the sliced task', () => {
    const rows = crossRows(() => 0.5)
    const { container } = render(
      <PassRateStripPlot rows={rows} highlightTaskId="HumanEval/0" />,
    )

    const highlighted = [...container.querySelectorAll('[data-highlighted]')]
    expect(highlighted).toHaveLength(2)
    for (const dot of highlighted) {
      expect(dot.getAttribute('data-task-id')).toBe('HumanEval/0')
      expect(dot.getAttribute('r')).toBe('3.2')
    }
  })

  it('renders the empty-state panel for empty rows', () => {
    render(<PassRateStripPlot rows={[]} />)
    expect(screen.getByRole('region', { name: TITLE })).toHaveTextContent(
      'No data for the current slice.',
    )
  })

  it.each(FUZZ_SEEDS)('keeps every dot on the [0, 100] axis without artifacts (seed %i)', seed => {
    const rows = makeSweepMetricsRows({ seed, groupBy: ['model', 'task_id'] })
    const { container } = render(<PassRateStripPlot rows={rows} />)
    const dots = [...container.querySelectorAll('circle')]
    expect(dots.length).toBeGreaterThan(0)
    for (const dot of dots) {
      const x = circleX(dot)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
    }
    expectNoRenderArtifacts(container)
  })
})
