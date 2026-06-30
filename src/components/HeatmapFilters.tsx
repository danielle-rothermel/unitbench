'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { AggregateFilterFields } from '@/components/AggregateFilterFields'
import { cn } from '@/lib/cn'
import type { AggregateFacets } from '@/lib/aggregate-data'
import type { AggregateFilters } from '@/lib/aggregate-filters'
import { heatmapHref, type HeatmapState } from '@/lib/heatmap-params'

type HeatmapFiltersProps = {
  state: HeatmapState
  facets: AggregateFacets
}

export function HeatmapFilters({ state, facets }: HeatmapFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const commit = (filters: AggregateFilters) => {
    startTransition(() => router.push(heatmapHref(filters)))
  }

  return (
    <div className={cn('mb-5', isPending && 'opacity-60')}>
      <AggregateFilterFields
        filters={state}
        facets={facets}
        onChange={commit}
        isPending={isPending}
      />
    </div>
  )
}
