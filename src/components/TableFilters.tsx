'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type KeyboardEvent } from 'react'
import { AggregateFilterFields } from '@/components/AggregateFilterFields'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import {
  allTableColumns,
  facetColumnKeys,
  filterColumns,
  type TableConfig,
} from '@/lib/table-config'
import type { TableFacets } from '@/lib/table-data'
import {
  tableFacetFilters,
  tableHref,
  type TableState,
} from '@/lib/table-params'

type TableFiltersProps = {
  config: TableConfig
  state: TableState
  facets: TableFacets
}

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

function facetLabels(config: TableConfig): Record<string, string> {
  return Object.fromEntries(
    allTableColumns(config).map(column => [column.key, column.label]),
  )
}

export function TableFilters({ config, state, facets }: TableFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const textColumns = filterColumns(config).filter(column => column.filter === 'text')
  const rangeColumns = filterColumns(config).filter(column => column.filter === 'range')
  const facetKeys = facetColumnKeys(config)
  const labels = facetLabels(config)

  const commit = (next: TableState) => {
    startTransition(() => router.push(tableHref(config.id, next)))
  }

  const setTextFilter = (key: string, rawValue: string) => {
    const value = rawValue.trim()
    const filters = { ...state.filters }
    if (value) filters[key] = value
    else delete filters[key]
    commit({ ...state, page: 1, filters })
  }

  const setRangeFilter = (
    key: string,
    bound: 'min' | 'max',
    rawValue: string,
  ) => {
    const parsed =
      rawValue.trim() === '' ? undefined : Number.parseFloat(rawValue.trim())
    const current = state.ranges[key] ?? {}
    const nextRange = { ...current }
    if (parsed === undefined || !Number.isFinite(parsed)) delete nextRange[bound]
    else nextRange[bound] = parsed

    const ranges = { ...state.ranges }
    if (nextRange.min === undefined && nextRange.max === undefined) {
      delete ranges[key]
    } else {
      ranges[key] = nextRange
    }
    commit({ ...state, page: 1, ranges })
  }

  const onTextKeyDown = (key: string) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') setTextFilter(key, event.currentTarget.value)
  }

  const onRangeKeyDown =
    (key: string, bound: 'min' | 'max') =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        setRangeFilter(key, bound, event.currentTarget.value)
      }
    }

  const hasActiveFilters =
    Object.keys(state.filters).length > 0 ||
    Object.keys(state.filterIn).length > 0 ||
    Object.keys(state.filterOut).length > 0 ||
    Object.keys(state.ranges).length > 0

  if (textColumns.length === 0 && rangeColumns.length === 0 && facetKeys.length === 0) {
    return null
  }

  return (
    <div className={cn('mb-5 space-y-4', isPending && 'opacity-60')}>
      {(textColumns.length > 0 || rangeColumns.length > 0) && (
        <div className="flex flex-wrap items-start gap-3">
          {textColumns.map((column, index) => {
            const current = state.filters[column.key] ?? ''
            return (
              <label key={column.key} className="flex flex-col gap-1">
                <span className={SECTION_LABEL}>{column.label}</span>
                <input
                  key={`${column.key}:${current}`}
                  type="text"
                  defaultValue={current}
                  placeholder={`Filter ${column.label.toLowerCase()}…`}
                  onKeyDown={onTextKeyDown(column.key)}
                  onBlur={event => setTextFilter(column.key, event.currentTarget.value)}
                  className={cn(CONTROL_CLASS, 'w-[180px] font-mono')}
                  {...(index === 0 ? { 'data-shortcut-filter': '' } : {})}
                />
              </label>
            )
          })}
          {rangeColumns.map(column => {
            const current = state.ranges[column.key] ?? {}
            return (
              <div key={column.key} className="flex flex-col gap-1">
                <span className={SECTION_LABEL}>{column.label}</span>
                <div className="flex items-center gap-2">
                  <input
                    key={`${column.key}:min:${current.min ?? ''}`}
                    type="number"
                    step="any"
                    defaultValue={current.min ?? ''}
                    placeholder="Min"
                    onKeyDown={onRangeKeyDown(column.key, 'min')}
                    onBlur={event =>
                      setRangeFilter(column.key, 'min', event.currentTarget.value)
                    }
                    className={cn(CONTROL_CLASS, 'w-[88px] font-mono')}
                  />
                  <input
                    key={`${column.key}:max:${current.max ?? ''}`}
                    type="number"
                    step="any"
                    defaultValue={current.max ?? ''}
                    placeholder="Max"
                    onKeyDown={onRangeKeyDown(column.key, 'max')}
                    onBlur={event =>
                      setRangeFilter(column.key, 'max', event.currentTarget.value)
                    }
                    className={cn(CONTROL_CLASS, 'w-[88px] font-mono')}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {facetKeys.length > 0 && (
        <AggregateFilterFields
          filters={tableFacetFilters(state)}
          facets={facets}
          onChange={filters =>
            commit({
              ...state,
              page: 1,
              filterIn: filters.filterIn,
              filterOut: filters.filterOut,
            })
          }
          isPending={isPending}
          filterColumns={facetKeys}
          filterLabels={labels}
          clearFilters={() =>
            commit({
              ...state,
              page: 1,
              filterIn: {},
              filterOut: {},
            })
          }
        />
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() =>
            commit({
              ...state,
              page: 1,
              filters: {},
              filterIn: {},
              filterOut: {},
              ranges: {},
            })
          }
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
