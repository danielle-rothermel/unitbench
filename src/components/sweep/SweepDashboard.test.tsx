import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SweepDashboard } from '@/components/sweep/SweepDashboard'
import {
  FUZZ_SEEDS,
  expectNoRenderArtifacts,
  makeRow,
} from '@/components/sweep/sweep-test-helpers'
import { makeSweepMetricsRows } from '@/fixtures'

function fixtureProps(seed: number) {
  return {
    perModel: makeSweepMetricsRows({ seed, groupBy: ['model'] }),
    perTask: makeSweepMetricsRows({ seed, groupBy: ['task_id'] }),
    perModelTask: makeSweepMetricsRows({ seed, groupBy: ['model', 'task_id'] }),
  }
}

/**
 * Hand-built groupings with distinct avg_cost per row, so slice assertions can
 * tell exactly which pre-grouped rows feed each chart ($0.00100… = perModel,
 * $0.00300… = perTask, $0.00500… = perModelTask).
 */
function handBuiltProps() {
  return {
    perModel: [
      makeRow({ model: 'model-a', task_id: null, avg_cost: 0.001 }),
      makeRow({ model: 'model-b', task_id: null, avg_cost: 0.002 }),
    ],
    perTask: [
      makeRow({ model: null, task_id: 'HumanEval/0', avg_cost: 0.003 }),
      makeRow({ model: null, task_id: 'HumanEval/1', avg_cost: 0.004 }),
    ],
    perModelTask: [
      makeRow({ model: 'model-a', task_id: 'HumanEval/0', avg_cost: 0.005 }),
      makeRow({ model: 'model-a', task_id: 'HumanEval/1', avg_cost: 0.006 }),
      makeRow({ model: 'model-b', task_id: 'HumanEval/0', avg_cost: 0.007 }),
      makeRow({ model: 'model-b', task_id: 'HumanEval/1', avg_cost: 0.008 }),
    ],
  }
}

const CHART_REGIONS = [
  'Sweep summary',
  'Pass rate per task, by model',
  'How runs end, by task',
  'Score mean ± stddev by model',
  'Where errors and rate limits cluster',
  'Latency avg → p95 by model',
  'Average cost by model',
  'Score mean ± stddev by task',
  'Average cost by task',
] as const

describe('SweepDashboard', () => {
  it('composes the summary strip and all seven charts from default seed data', () => {
    render(<SweepDashboard {...fixtureProps(1)} />)

    for (const name of CHART_REGIONS) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Which tasks and models look broken' }))
      .toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Model health' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Task health' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Task' })).toBeInTheDocument()
  })

  it('slicing by task feeds the model band the matching model×task rows', () => {
    render(<SweepDashboard {...handBuiltProps()} />)

    const modelCosts = () =>
      screen.getByRole('region', { name: 'Average cost by model' }).textContent ?? ''
    expect(modelCosts()).toContain('$0.00100')
    expect(modelCosts()).toContain('$0.00200')

    fireEvent.change(screen.getByRole('combobox', { name: 'Task' }), {
      target: { value: 'HumanEval/0' },
    })

    // Now the per-model band reads perModelTask rows with task_id === 'HumanEval/0'.
    expect(modelCosts()).toContain('$0.00500')
    expect(modelCosts()).toContain('$0.00700')
    expect(modelCosts()).not.toContain('$0.00100')
    expect(screen.getByRole('heading', { name: 'Model health on HumanEval/0' }))
      .toBeInTheDocument()
  })

  it('slicing by model feeds the task band the matching model×task rows', () => {
    render(<SweepDashboard {...handBuiltProps()} />)

    const taskCosts = () =>
      screen.getByRole('region', { name: 'Average cost by task' }).textContent ?? ''
    expect(taskCosts()).toContain('$0.00300')
    expect(taskCosts()).toContain('$0.00400')

    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), {
      target: { value: 'model-b' },
    })

    // Now the per-task band reads perModelTask rows with model === 'model-b'.
    expect(taskCosts()).toContain('$0.00700')
    expect(taskCosts()).toContain('$0.00800')
    expect(taskCosts()).not.toContain('$0.00300')
    expect(screen.getByRole('heading', { name: 'Task health for model-b' }))
      .toBeInTheDocument()
  })

  it('clearing a slice restores the default pre-grouped rows', () => {
    render(<SweepDashboard {...handBuiltProps()} />)
    const taskSelect = screen.getByRole('combobox', { name: 'Task' })

    fireEvent.change(taskSelect, { target: { value: 'HumanEval/0' } })
    fireEvent.change(taskSelect, { target: { value: '' } })

    const modelCosts =
      screen.getByRole('region', { name: 'Average cost by model' }).textContent ?? ''
    expect(modelCosts).toContain('$0.00100')
    expect(modelCosts).not.toContain('$0.00500')
  })

  it('summarizes only the sliced model×task rows when both slices are set', () => {
    render(<SweepDashboard {...handBuiltProps()} />)
    const summary = () =>
      screen.getByRole('region', { name: 'Sweep summary' }).textContent ?? ''
    expect(summary()).toContain('192') // perModel total: 96 + 96

    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), {
      target: { value: 'model-b' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Task' }), {
      target: { value: 'HumanEval/1' },
    })

    expect(summary()).toContain('96') // exactly the model-b × HumanEval/1 row
    expect(summary()).not.toContain('192')
  })

  it('offers the distinct models and tasks as slice options', () => {
    render(<SweepDashboard {...handBuiltProps()} />)
    const modelOptions = [
      ...screen.getByRole('combobox', { name: 'Model' }).querySelectorAll('option'),
    ].map(option => option.value)
    const taskOptions = [
      ...screen.getByRole('combobox', { name: 'Task' }).querySelectorAll('option'),
    ].map(option => option.value)
    expect(modelOptions).toEqual(['', 'model-a', 'model-b'])
    expect(taskOptions).toEqual(['', 'HumanEval/0', 'HumanEval/1'])
  })

  it('renders the empty state when every grouping is empty', () => {
    render(<SweepDashboard perModel={[]} perTask={[]} perModelTask={[]} />)
    expect(screen.getByText('No sweep data to summarize.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Model' })).toBeNull()
  })

  it.each(FUZZ_SEEDS)('renders fixture data without artifacts (seed %i)', seed => {
    const { container, unmount } = render(<SweepDashboard {...fixtureProps(seed)} />)
    expectNoRenderArtifacts(container)
    unmount()
  })
})
