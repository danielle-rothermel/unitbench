import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenericTable } from '@/components/GenericTable'
import { getTableConfig } from '@/lib/table-config'
import { parseTableState } from '@/lib/table-params'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const predictionsConfig = getTableConfig('published-predictions')
const defaultState = parseTableState(predictionsConfig, {})

const sampleRow = {
  prediction_id: 'pred-1',
  experiment_id: 'exp-1',
  task_id: 'HumanEval/1',
  model: 'openai/test',
  result_state: 'passed',
  harness_failure_count: 0,
  score: 1,
  updated_at: '2026-06-28T12:00:00Z',
}

describe('GenericTable', () => {
  beforeEach(() => push.mockClear())

  it('renders configured columns, rows, and a detail link on the primary key', () => {
    render(
      <GenericTable
        config={predictionsConfig}
        state={defaultState}
        rows={[sampleRow]}
        total={1}
        totalPages={1}
      />,
    )

    expect(
      screen.getByRole('columnheader', { name: /Prediction/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('passed')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'pred-1' })
    expect(link).toHaveAttribute('href', '/predictions/pred-1')
  })

  it('navigates with a sort param when a sortable header is clicked', () => {
    render(
      <GenericTable
        config={predictionsConfig}
        state={defaultState}
        rows={[sampleRow]}
        total={1}
        totalPages={1}
      />,
    )

    // Numeric columns sort descending on first click (TanStack sortDescFirst).
    fireEvent.click(screen.getByRole('button', { name: /Score/ }))
    expect(push).toHaveBeenCalledWith(
      '/tables/published-predictions?sort=score&dir=desc',
    )
  })

  it('renders an empty state when no rows are available', () => {
    const experimentsConfig = getTableConfig('published-experiments')
    render(
      <GenericTable
        config={experimentsConfig}
        state={parseTableState(experimentsConfig, {})}
        rows={[]}
        total={0}
        totalPages={1}
      />,
    )

    expect(screen.getByText('No rows found')).toBeInTheDocument()
  })
})
