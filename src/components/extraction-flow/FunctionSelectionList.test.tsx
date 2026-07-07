import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FunctionSelectionList } from '@/components/extraction-flow/FunctionSelectionList'
import { makeExtractionFlowSample } from '@/fixtures/extraction'

describe('FunctionSelectionList', () => {
  it('highlights exactly one row as selected and shows its arity tag', () => {
    const sample = makeExtractionFlowSample({ seed: 3, outcome: 'passed' })
    render(
      <FunctionSelectionList
        parsed_functions={sample.parsed_functions}
        best_function_name={sample.best_function_name}
        entry_point={sample.entry_point}
      />,
    )

    const selectedTags = screen.getAllByText('selected')
    expect(selectedTags).toHaveLength(1)
    const selectedRow = selectedTags[0].closest('li')
    expect(selectedRow).not.toBeNull()
    expect(
      within(selectedRow as HTMLElement).getByText('def rolling_max(numbers)'),
    ).toBeInTheDocument()
    expect(
      within(selectedRow as HTMLElement).getByText('arity 1'),
    ).toBeInTheDocument()
  })

  it('flags the entry-point marker on the function matching entry_point', () => {
    const sample = makeExtractionFlowSample({ seed: 3, outcome: 'passed' })
    render(
      <FunctionSelectionList
        parsed_functions={sample.parsed_functions}
        best_function_name={sample.best_function_name}
        entry_point={sample.entry_point}
      />,
    )

    const marker = screen.getByText('entry point')
    const row = marker.closest('li')
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText('def rolling_max(numbers)'),
    ).toBeInTheDocument()
  })

  it('renders the mismatch callout when best_function_name is not the entry point', () => {
    render(
      <FunctionSelectionList
        parsed_functions={[
          {
            function_name: 'rolling_max',
            arity: 2,
            signature_str: 'def rolling_max(numbers, seed)',
            is_selected: false,
          },
          {
            function_name: 'helper',
            arity: 1,
            signature_str: 'def helper(numbers)',
            is_selected: true,
          },
        ]}
        best_function_name="helper"
        entry_point="rolling_max"
      />,
    )

    expect(screen.getByText('selection mismatch')).toBeInTheDocument()
    expect(
      screen.getByText(/outcome-based selection overrode the entry point/),
    ).toBeInTheDocument()
  })

  it('renders the no-function-selected line when best_function_name is null', () => {
    render(
      <FunctionSelectionList
        parsed_functions={[
          {
            function_name: 'helper',
            arity: 1,
            signature_str: 'def helper(numbers)',
            is_selected: false,
          },
        ]}
        best_function_name={null}
        entry_point="rolling_max"
      />,
    )

    expect(screen.getByText('no function selected')).toBeInTheDocument()
  })

  it('renders the empty state when no functions were parsed', () => {
    render(
      <FunctionSelectionList
        parsed_functions={[]}
        best_function_name={null}
        entry_point="rolling_max"
      />,
    )

    expect(
      screen.getByText('no top-level functions parsed'),
    ).toBeInTheDocument()
    expect(screen.queryByText('no function selected')).not.toBeInTheDocument()
  })
})
