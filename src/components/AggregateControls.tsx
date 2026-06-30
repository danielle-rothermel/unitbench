'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { AggregateFilterFields } from '@/components/AggregateFilterFields'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { GROUP_BY_COLUMNS, type GroupByColumn } from '@/lib/aggregate-config'
import type { AggregateFacets, AggregateState } from '@/lib/aggregate-data'
import { aggregateHref } from '@/lib/aggregate-params'

type AggregateControlsProps = {
  state: AggregateState
  facets: AggregateFacets
}

const GROUP_BY_LABELS: Record<GroupByColumn, string> = {
  model: 'Model',
  task_id: 'Task',
  experiment_kind: 'Experiment kind',
  result_state: 'Result state',
  source: 'Source',
}

export function AggregateControls({ state, facets }: AggregateControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const commit = (next: AggregateState) => {
    startTransition(() => router.push(aggregateHref(next)))
  }

  const toggleGroupBy = (column: GroupByColumn) => {
    const selected = new Set(state.groupBy)
    if (selected.has(column)) {
      if (selected.size === 1) return
      selected.delete(column)
    } else {
      selected.add(column)
    }
    const groupBy = GROUP_BY_COLUMNS.filter(item => selected.has(item))
    commit({ ...state, page: 1, groupBy })
  }

  return (
    <div className={cn('mb-5 space-y-4', isPending && 'opacity-60')}>
      <div>
        <span className={SECTION_LABEL}>Group by</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {GROUP_BY_COLUMNS.map(column => {
            const checked = state.groupBy.includes(column)
            return (
              <label
                key={column}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px]',
                  checked
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGroupBy(column)}
                  className="accent-[var(--accent)]"
                />
                {GROUP_BY_LABELS[column]}
              </label>
            )
          })}
        </div>
      </div>

      <AggregateFilterFields
        filters={state}
        facets={facets}
        onChange={filters => commit({ ...state, page: 1, ...filters })}
        isPending={isPending}
      />
    </div>
  )
}
