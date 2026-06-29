'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type KeyboardEvent } from 'react'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { filterColumns, type TableConfig } from '@/lib/table-config'
import type { TableFacets } from '@/lib/table-data'
import { tableHref, type TableState } from '@/lib/table-params'

type TableFiltersProps = {
  config: TableConfig
  state: TableState
  facets: TableFacets
}

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

export function TableFilters({ config, state, facets }: TableFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const columns = filterColumns(config)
  if (columns.length === 0) return null

  const commit = (next: TableState) => {
    startTransition(() => router.push(tableHref(config.id, next)))
  }

  const setFilter = (key: string, rawValue: string) => {
    const value = rawValue.trim()
    const filters = { ...state.filters }
    if (value) filters[key] = value
    else delete filters[key]
    commit({ ...state, page: 1, filters })
  }

  const onTextKeyDown = (key: string) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') setFilter(key, event.currentTarget.value)
  }

  const hasActiveFilters = Object.keys(state.filters).length > 0

  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-end gap-3',
        isPending && 'opacity-60',
      )}
    >
      {columns.map(column => {
        const current = state.filters[column.key] ?? ''
        return (
          <label key={column.key} className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>{column.label}</span>
            {column.filter === 'facet' ? (
              <select
                value={current}
                onChange={event => setFilter(column.key, event.target.value)}
                className={CONTROL_CLASS}
              >
                <option value="">All</option>
                {(facets[column.key] ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={`${column.key}:${current}`}
                type="text"
                defaultValue={current}
                placeholder={`Filter ${column.label.toLowerCase()}…`}
                onKeyDown={onTextKeyDown(column.key)}
                onBlur={event => setFilter(column.key, event.currentTarget.value)}
                className={cn(CONTROL_CLASS, 'w-[180px] font-mono')}
              />
            )}
          </label>
        )
      })}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => commit({ ...state, page: 1, filters: {} })}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
