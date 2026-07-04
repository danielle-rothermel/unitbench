import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  AggregateFilterFields,
  applyCheckboxIncludeFilter,
  CHECKBOX_FILTER_MAX_FACETS,
} from '@/components/AggregateFilterFields'
import type { AggregateFilters } from '@/lib/aggregate-filters'

const emptyFilters: AggregateFilters = { filterIn: {}, filterOut: {} }

describe('applyCheckboxIncludeFilter', () => {
  it('removes column from filterIn when no values are checked', () => {
    const filters: AggregateFilters = {
      filterIn: { experiment_kind: ['baseline'] },
      filterOut: {},
    }
    expect(
      applyCheckboxIncludeFilter(filters, 'experiment_kind', []),
    ).toEqual({ filterIn: {}, filterOut: {} })
  })

  it('sets filterIn when one or more values are checked', () => {
    expect(
      applyCheckboxIncludeFilter(emptyFilters, 'experiment_kind', ['baseline']),
    ).toEqual({
      filterIn: { experiment_kind: ['baseline'] },
      filterOut: {},
    })

    expect(
      applyCheckboxIncludeFilter(emptyFilters, 'experiment_kind', [
        'baseline',
        'ablation',
      ]),
    ).toEqual({
      filterIn: { experiment_kind: ['baseline', 'ablation'] },
      filterOut: {},
    })
  })

  it('clears filterOut for the column when applying checkbox changes', () => {
    const filters: AggregateFilters = {
      filterIn: {},
      filterOut: { experiment_kind: ['ablation'] },
    }
    expect(
      applyCheckboxIncludeFilter(filters, 'experiment_kind', ['baseline']),
    ).toEqual({
      filterIn: { experiment_kind: ['baseline'] },
      filterOut: {},
    })
  })

  it('preserves unrelated columns in both maps', () => {
    const filters: AggregateFilters = {
      filterIn: { model: ['gpt-4'] },
      filterOut: { model: ['claude-3'] },
    }
    expect(
      applyCheckboxIncludeFilter(filters, 'experiment_kind', ['baseline']),
    ).toEqual({
      filterIn: { model: ['gpt-4'], experiment_kind: ['baseline'] },
      filterOut: { model: ['claude-3'] },
    })
  })
})

describe('AggregateFilterFields', () => {
  it('renders checkboxes for low-cardinality columns', () => {
    render(
      <AggregateFilterFields
        filters={emptyFilters}
        facets={{ experiment_kind: ['baseline', 'ablation'] }}
        onChange={vi.fn()}
        filterColumns={['experiment_kind']}
        filterLabels={{ experiment_kind: 'Experiment kind' }}
      />,
    )

    expect(screen.getByLabelText('baseline')).toBeInTheDocument()
    expect(screen.getByLabelText('ablation')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Exclude/)).not.toBeInTheDocument()
  })

  it('renders selector controls for high-cardinality columns', () => {
    const manyValues = Array.from(
      { length: CHECKBOX_FILTER_MAX_FACETS + 1 },
      (_, index) => `model-${index}`,
    )

    render(
      <AggregateFilterFields
        filters={emptyFilters}
        facets={{ model: manyValues }}
        onChange={vi.fn()}
        filterColumns={['model']}
        filterLabels={{ model: 'Model' }}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(2)
    expect(screen.getByText('Include Model')).toBeInTheDocument()
    expect(screen.getByText('Exclude Model')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('uses checkboxes at the threshold boundary and selector above it', () => {
    const atThreshold = Array.from(
      { length: CHECKBOX_FILTER_MAX_FACETS },
      (_, index) => `value-${index}`,
    )
    const { unmount } = render(
      <AggregateFilterFields
        filters={emptyFilters}
        facets={{ budget: atThreshold }}
        onChange={vi.fn()}
        filterColumns={['budget']}
      />,
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      CHECKBOX_FILTER_MAX_FACETS,
    )
    unmount()

    const aboveThreshold = Array.from(
      { length: CHECKBOX_FILTER_MAX_FACETS + 1 },
      (_, index) => `value-${index}`,
    )
    render(
      <AggregateFilterFields
        filters={emptyFilters}
        facets={{ budget: aboveThreshold }}
        onChange={vi.fn()}
        filterColumns={['budget']}
      />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(2)
  })

  it('calls onChange with filterIn when a checkbox is checked', () => {
    const onChange = vi.fn()
    render(
      <AggregateFilterFields
        filters={emptyFilters}
        facets={{ experiment_kind: ['baseline', 'ablation'] }}
        onChange={onChange}
        filterColumns={['experiment_kind']}
      />,
    )

    fireEvent.click(screen.getByLabelText('baseline'))

    expect(onChange).toHaveBeenCalledWith({
      filterIn: { experiment_kind: ['baseline'] },
      filterOut: {},
    })
  })

  it('clears filterIn when all checkboxes are unchecked', () => {
    const onChange = vi.fn()
    render(
      <AggregateFilterFields
        filters={{
          filterIn: { experiment_kind: ['baseline'] },
          filterOut: {},
        }}
        facets={{ experiment_kind: ['baseline', 'ablation'] }}
        onChange={onChange}
        filterColumns={['experiment_kind']}
      />,
    )

    fireEvent.click(screen.getByLabelText('baseline'))

    expect(onChange).toHaveBeenCalledWith({
      filterIn: {},
      filterOut: {},
    })
  })

  it('checkbox filterIn matches selector include semantics for multiple values', () => {
    const onChange = vi.fn()
    render(
      <AggregateFilterFields
        filters={{
          filterIn: { experiment_kind: ['baseline'] },
          filterOut: {},
        }}
        facets={{ experiment_kind: ['baseline', 'ablation'] }}
        onChange={onChange}
        filterColumns={['experiment_kind']}
      />,
    )

    fireEvent.click(screen.getByLabelText('ablation'))

    expect(onChange).toHaveBeenCalledWith({
      filterIn: { experiment_kind: ['baseline', 'ablation'] },
      filterOut: {},
    })
  })
})
