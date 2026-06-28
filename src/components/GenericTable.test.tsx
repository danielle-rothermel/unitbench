import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GenericTable } from '@/components/GenericTable'
import { getTableConfig } from '@/lib/table-config'

describe('GenericTable', () => {
  it('renders configured columns and rows', () => {
    const config = getTableConfig('published-predictions')
    render(
      <GenericTable
        config={config}
        rows={[
          {
            prediction_id: 'pred-1',
            experiment_id: 'exp-1',
            task_id: 'HumanEval/1',
            model: 'openai/test',
            result_state: 'passed',
            score: 1,
            updated_at: '2026-06-28T12:00:00Z',
          },
        ]}
        total={1}
        page={1}
        pageSize={25}
        totalPages={1}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Prediction' })).toBeInTheDocument()
    expect(screen.getByText('pred-1')).toBeInTheDocument()
    expect(screen.getByText('passed')).toBeInTheDocument()
  })

  it('renders an empty state when no rows are available', () => {
    render(
      <GenericTable
        config={getTableConfig('published-experiments')}
        rows={[]}
        total={0}
        page={1}
        pageSize={25}
        totalPages={1}
      />,
    )

    expect(screen.getByText('No rows found')).toBeInTheDocument()
  })
})
