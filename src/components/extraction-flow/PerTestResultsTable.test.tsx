import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PerTestResultsTable } from '@/components/extraction-flow/PerTestResultsTable'
import type { PerTestResult } from '@/fixtures/extraction'
import type { EvaluationCaseStatus } from '@/fixtures/primitives'

function makeResult(input: {
  index: number
  status: EvaluationCaseStatus
  message?: string
}): PerTestResult {
  return {
    test_id: `case-${input.index}`,
    function_name: 'rolling_max',
    status: input.status,
    message: input.message ?? (input.status === 'passed' ? '' : 'expected [1], got []'),
    test_type: 'input_result',
    input_repr: `([${input.index}],)`,
    expected_output_repr: `[${input.index}]`,
    actual_output_repr: input.status === 'passed' ? `[${input.index}]` : '[]',
  }
}

const ALL_STATUS_RESULTS: PerTestResult[] = [
  makeResult({ index: 0, status: 'passed' }),
  makeResult({ index: 1, status: 'failed' }),
  makeResult({ index: 2, status: 'error' }),
  makeResult({ index: 3, status: 'timeout' }),
]

describe('PerTestResultsTable', () => {
  it('renders one status tag per row with the tone class for each status', () => {
    render(
      <PerTestResultsTable
        per_test_results={ALL_STATUS_RESULTS}
        status_counts={{}}
      />,
    )

    expect(screen.getByText('passed')).toHaveClass('bg-[var(--green-bg)]')
    expect(screen.getByText('failed')).toHaveClass('bg-[var(--red-bg)]')
    expect(screen.getByText('error')).toHaveClass('bg-[var(--red-bg)]')
    expect(screen.getByText('timeout')).toHaveClass('bg-[var(--yellow-bg)]')
  })

  it('shows message text on failing rows and an em-dash on passing rows', () => {
    render(
      <PerTestResultsTable
        per_test_results={[
          makeResult({ index: 0, status: 'passed' }),
          makeResult({ index: 1, status: 'failed', message: 'expected [2], got []' }),
        ]}
        status_counts={{}}
      />,
    )

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('expected [2], got []')).toBeInTheDocument()
  })

  it('renders summary chips matching status_counts in canonical status order', () => {
    render(
      <PerTestResultsTable
        per_test_results={ALL_STATUS_RESULTS}
        status_counts={{ timeout: 1, passed: 2, failed: 1 }}
      />,
    )

    const chips = screen.getAllByText(/×/).map(chip => chip.textContent)
    expect(chips).toEqual(['passed × 2', 'failed × 1', 'timeout × 1'])
    expect(screen.getByText('2/4 passed')).toBeInTheDocument()
  })

  it('renders the empty-state row when there are no test results', () => {
    render(<PerTestResultsTable per_test_results={[]} status_counts={{}} />)

    expect(screen.getByText('no test results recorded')).toBeInTheDocument()
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })
})
