'use client'

import { useState } from 'react'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { FILTER_COLUMNS } from '@/lib/aggregate-config'
import type { AggregateFilters } from '@/lib/aggregate-filters'
import type { AggregateFacets } from '@/lib/aggregate-data'

export const CHECKBOX_FILTER_MAX_FACETS = 12

export function applyCheckboxIncludeFilter(
  filters: AggregateFilters,
  column: string,
  checkedValues: string[],
): AggregateFilters {
  const nextFilterIn = { ...filters.filterIn }
  const nextFilterOut = { ...filters.filterOut }

  if (checkedValues.length === 0) {
    delete nextFilterIn[column]
  } else {
    nextFilterIn[column] = checkedValues
  }
  delete nextFilterOut[column]

  return {
    filterIn: nextFilterIn,
    filterOut: nextFilterOut,
  }
}

type AggregateFilterFieldsProps = {
  filters: AggregateFilters
  facets: AggregateFacets
  onChange: (next: AggregateFilters) => void
  isPending?: boolean
  filterColumns?: readonly string[]
  filterLabels?: Record<string, string>
  clearFilters?: () => void
}

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

const FILTER_LABELS: Record<(typeof FILTER_COLUMNS)[number], string> = {
  model: 'Model',
  experiment_kind: 'Experiment kind',
}

function FilterChips({
  label,
  values,
  onRemove,
}: {
  label: string
  values: string[]
  onRemove: (value: string) => void
}) {
  if (values.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {label}
      </span>
      {values.map(value => (
        <button
          key={value}
          type="button"
          onClick={() => onRemove(value)}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          {value}
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  )
}

function CheckboxFilterColumn({
  column,
  label,
  values,
  selected,
  filters,
  onChange,
}: {
  column: string
  label: string
  values: string[]
  selected: string[]
  filters: AggregateFilters
  onChange: (next: AggregateFilters) => void
}) {
  const toggleValue = (value: string, checked: boolean) => {
    const nextSelected = checked
      ? [...selected, value]
      : selected.filter(item => item !== value)
    onChange(applyCheckboxIncludeFilter(filters, column, nextSelected))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_LABEL}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {values.map(value => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[13px]',
                checked
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={event => toggleValue(value, event.target.checked)}
                className="accent-[var(--accent)]"
              />
              {value}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function SelectorFilterColumn({
  label,
  mode,
  facets,
  values,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  label: string
  mode: 'in' | 'out'
  facets: string[]
  values: string[]
  draft: string
  onDraftChange: (value: string) => void
  onAdd: () => void
  onRemove: (value: string) => void
}) {
  const chipLabel = mode === 'in' ? 'Included' : 'Excluded'
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>{label}</span>
        <div className="flex items-center gap-2">
          <select
            value={draft}
            onChange={event => onDraftChange(event.target.value)}
            className={cn(CONTROL_CLASS, 'min-w-[220px] font-mono')}
          >
            <option value="">Select value…</option>
            {facets.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Add
          </button>
        </div>
      </label>
      <FilterChips label={chipLabel} values={values} onRemove={onRemove} />
    </div>
  )
}

export function AggregateFilterFields({
  filters,
  facets,
  onChange,
  isPending = false,
  filterColumns = FILTER_COLUMNS,
  filterLabels = FILTER_LABELS,
  clearFilters,
}: AggregateFilterFieldsProps) {
  const [includeDraft, setIncludeDraft] = useState<Record<string, string>>({})
  const [excludeDraft, setExcludeDraft] = useState<Record<string, string>>({})

  const addFilter = (mode: 'in' | 'out', column: string, value: string) => {
    if (!value) return
    if (mode === 'in') {
      const current = filters.filterIn[column] ?? []
      if (current.includes(value)) return
      onChange({
        ...filters,
        filterIn: { ...filters.filterIn, [column]: [...current, value] },
      })
      setIncludeDraft(prev => ({ ...prev, [column]: '' }))
      return
    }
    const current = filters.filterOut[column] ?? []
    if (current.includes(value)) return
    onChange({
      ...filters,
      filterOut: { ...filters.filterOut, [column]: [...current, value] },
    })
    setExcludeDraft(prev => ({ ...prev, [column]: '' }))
  }

  const removeFilter = (mode: 'in' | 'out', column: string, value: string) => {
    const source = mode === 'in' ? filters.filterIn : filters.filterOut
    const nextValues = (source[column] ?? []).filter(item => item !== value)
    const nextMap = { ...source }
    if (nextValues.length > 0) nextMap[column] = nextValues
    else delete nextMap[column]
    onChange({
      ...filters,
      ...(mode === 'in' ? { filterIn: nextMap } : { filterOut: nextMap }),
    })
  }

  const hasActiveFilters =
    Object.keys(filters.filterIn).length > 0 ||
    Object.keys(filters.filterOut).length > 0

  return (
    <div className={cn('flex flex-wrap items-start gap-4', isPending && 'opacity-60')}>
      {filterColumns.map(column => {
        const columnValues = facets[column] ?? []
        const useCheckbox = columnValues.length <= CHECKBOX_FILTER_MAX_FACETS
        const columnLabel = filterLabels[column] ?? column

        if (useCheckbox) {
          return (
            <CheckboxFilterColumn
              key={column}
              column={column}
              label={columnLabel}
              values={columnValues}
              selected={filters.filterIn[column] ?? []}
              filters={filters}
              onChange={onChange}
            />
          )
        }

        return (
          <div key={column} className="flex flex-col gap-4">
            <SelectorFilterColumn
              label={`Include ${columnLabel}`}
              mode="in"
              facets={columnValues}
              values={filters.filterIn[column] ?? []}
              draft={includeDraft[column] ?? ''}
              onDraftChange={value =>
                setIncludeDraft(prev => ({ ...prev, [column]: value }))
              }
              onAdd={() => addFilter('in', column, includeDraft[column] ?? '')}
              onRemove={value => removeFilter('in', column, value)}
            />
            <SelectorFilterColumn
              label={`Exclude ${columnLabel}`}
              mode="out"
              facets={columnValues}
              values={filters.filterOut[column] ?? []}
              draft={excludeDraft[column] ?? ''}
              onDraftChange={value =>
                setExcludeDraft(prev => ({ ...prev, [column]: value }))
              }
              onAdd={() => addFilter('out', column, excludeDraft[column] ?? '')}
              onRemove={value => removeFilter('out', column, value)}
            />
          </div>
        )
      })}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() =>
            clearFilters ? clearFilters() : onChange({ filterIn: {}, filterOut: {} })
          }
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

export { FILTER_LABELS as AGGREGATE_FILTER_LABELS }
