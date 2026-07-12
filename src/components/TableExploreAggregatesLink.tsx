'use client'

import Link from 'next/link'
import {
  hasActiveTableFilters,
  predictionsExploreAggregateHref,
} from '@/lib/predictions-nav'
import type { TableState } from '@/lib/table-params'

type TableExploreAggregatesLinkProps = {
  tableId: string
  state: TableState
}

export function TableExploreAggregatesLink({
  tableId,
  state,
}: TableExploreAggregatesLinkProps) {
  if (tableId !== 'predictions') return null
  if (!hasActiveTableFilters(state)) return null

  return (
    <div className="mb-3">
      <Link
        href={predictionsExploreAggregateHref(state)}
        className="text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
      >
        Explore aggregates with these filters →
      </Link>
    </div>
  )
}
