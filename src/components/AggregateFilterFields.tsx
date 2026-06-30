'use client'

import { useState } from 'react'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { FILTER_COLUMNS } from '@/lib/aggregate-config'
import type { AggregateFilters } from '@/lib/aggregate-filters'
import type { AggregateFacets } from '@/lib/aggregate-data'

type AggregateFilterFieldsProps = {
  filters: AggregateFilters
  facets: AggregateFacets
  onChange: (next: AggregateFilters) => void
  isPending?: boolean
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

export function AggregateFilterFields({
  filters,
  facets,
  onChange,
  isPending = false,
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
    <div className={cn('flex flex-wrap items-end gap-4', isPending && 'opacity-60')}>
      {FILTER_COLUMNS.map(column => (
        <div key={column} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>
              Include {FILTER_LABELS[column]}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={includeDraft[column] ?? ''}
                onChange={event =>
                  setIncludeDraft(prev => ({
                    ...prev,
                    [column]: event.target.value,
                  }))
                }
                className={cn(CONTROL_CLASS, 'min-w-[220px] font-mono')}
              >
                <option value="">Select value…</option>
                {(facets[column] ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addFilter('in', column, includeDraft[column] ?? '')}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                Add
              </button>
            </div>
          </label>
          <FilterChips
            label="Included"
            values={filters.filterIn[column] ?? []}
            onRemove={value => removeFilter('in', column, value)}
          />
        </div>
      ))}

      {FILTER_COLUMNS.map(column => (
        <div key={`exclude-${column}`} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>
              Exclude {FILTER_LABELS[column]}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={excludeDraft[column] ?? ''}
                onChange={event =>
                  setExcludeDraft(prev => ({
                    ...prev,
                    [column]: event.target.value,
                  }))
                }
                className={cn(CONTROL_CLASS, 'min-w-[220px] font-mono')}
              >
                <option value="">Select value…</option>
                {(facets[column] ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  addFilter('out', column, excludeDraft[column] ?? '')
                }
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                Add
              </button>
            </div>
          </label>
          <FilterChips
            label="Excluded"
            values={filters.filterOut[column] ?? []}
            onRemove={value => removeFilter('out', column, value)}
          />
        </div>
      ))}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange({ filterIn: {}, filterOut: {} })}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

export { FILTER_LABELS as AGGREGATE_FILTER_LABELS }
