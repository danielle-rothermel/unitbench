'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { AggregateFilterFields } from '@/components/AggregateFilterFields'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { measureLabel } from '@/lib/aggregate-config'
import type { AggregateFacets } from '@/lib/aggregate-data'
import {
  HEATMAP_AXIS_LABELS,
  HEATMAP_AXES,
  SORT_MEASURES,
  otherHeatmapAxis,
  type HeatmapAxis,
  type SortMeasure,
} from '@/lib/heatmap-config'
import { heatmapHref, type HeatmapState } from '@/lib/heatmap-params'

type HeatmapFiltersProps = {
  state: HeatmapState
  facets: AggregateFacets
}

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

export function HeatmapFilters({ state, facets }: HeatmapFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const commit = (next: HeatmapState) => {
    startTransition(() => router.push(heatmapHref(next)))
  }

  const setAxis = (axis: 'x' | 'y', value: HeatmapAxis) => {
    if (axis === 'x') {
      const y = value === state.y ? otherHeatmapAxis(state.y, value) : state.y
      commit({ ...state, x: value, y })
      return
    }
    const x = value === state.x ? otherHeatmapAxis(state.x, value) : state.x
    commit({ ...state, y: value, x })
  }

  return (
    <div className={cn('mb-5 space-y-4', isPending && 'opacity-60')}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>X axis</span>
          <select
            value={state.x}
            onChange={event => setAxis('x', event.target.value as HeatmapAxis)}
            className={cn(CONTROL_CLASS, 'min-w-[180px]')}
          >
            {HEATMAP_AXES.map(axis => (
              <option key={axis} value={axis} disabled={axis === state.y}>
                {HEATMAP_AXIS_LABELS[axis]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>Y axis</span>
          <select
            value={state.y}
            onChange={event => setAxis('y', event.target.value as HeatmapAxis)}
            className={cn(CONTROL_CLASS, 'min-w-[180px]')}
          >
            {HEATMAP_AXES.map(axis => (
              <option key={axis} value={axis} disabled={axis === state.x}>
                {HEATMAP_AXIS_LABELS[axis]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>Color</span>
          <select
            value={state.color}
            onChange={event =>
              commit({ ...state, color: event.target.value as SortMeasure })
            }
            className={cn(CONTROL_CLASS, 'min-w-[220px]')}
          >
            {SORT_MEASURES.map(measure => (
              <option key={measure} value={measure}>
                {measureLabel(measure)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AggregateFilterFields
        filters={state}
        facets={facets}
        onChange={filters => commit({ ...state, ...filters })}
        isPending={isPending}
        filterColumns={HEATMAP_AXES}
        filterLabels={HEATMAP_AXIS_LABELS}
        clearFilters={() =>
          commit({ ...state, filterIn: {}, filterOut: {} })
        }
      />
    </div>
  )
}
