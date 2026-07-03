'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { AggregateFilterFields } from '@/components/AggregateFilterFields'
import { HideTestExperimentsToggle } from '@/components/HideTestExperimentsToggle'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { measureLabel } from '@/lib/aggregate-config'
import type { AggregateFacets } from '@/lib/aggregate-data'
import {
  AXIS_VALUE_ORDERS,
  HEATMAP_AXIS_LABELS,
  HEATMAP_AXES,
  SORT_MEASURES,
  otherHeatmapAxis,
  type HeatmapAxis,
  type SortMeasure,
} from '@/lib/heatmap-config'
import {
  heatmapHref,
  type AxisOrderSpec,
  type HeatmapState,
} from '@/lib/heatmap-params'

type HeatmapFiltersProps = {
  state: HeatmapState
  facets: AggregateFacets
}

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

type OrderMode =
  | 'default'
  | 'measure'
  | 'value'
  | 'group:provider'
  | 'group:experiment_kind'

function orderModeFromSpec(
  spec: AxisOrderSpec | undefined,
): OrderMode {
  if (!spec) return 'default'
  if (spec.kind === 'measure') return 'measure'
  if (spec.kind === 'value') return 'value'
  return `group:${spec.groupBy}` as OrderMode
}

function directionFromSpec(spec: AxisOrderSpec | undefined): 'asc' | 'desc' {
  if (!spec) return 'asc'
  if (spec.kind === 'measure' || spec.kind === 'group') return spec.direction
  return 'asc'
}

function specFromMode(
  mode: OrderMode,
  direction: 'asc' | 'desc',
): AxisOrderSpec | undefined {
  switch (mode) {
    case 'default':
      return undefined
    case 'measure':
      return { kind: 'measure', direction }
    case 'value':
      return { kind: 'value' }
    case 'group:provider':
      return { kind: 'group', groupBy: 'provider', direction }
    case 'group:experiment_kind':
      return { kind: 'group', groupBy: 'experiment_kind', direction }
  }
}

function availableOrderModes(axis: HeatmapAxis): OrderMode[] {
  const modes: OrderMode[] = ['default', 'measure']
  if (AXIS_VALUE_ORDERS[axis]) modes.push('value')
  if (axis === 'model') modes.push('group:provider')
  if (axis === 'experiment_kind') modes.push('group:experiment_kind')
  return modes
}

const ORDER_MODE_LABELS: Record<OrderMode, string> = {
  default: 'Default',
  measure: 'Measure',
  value: 'Value order',
  'group:provider': 'Group: provider',
  'group:experiment_kind': 'Group: experiment kind',
}

type AxisOrderControlsProps = {
  label: string
  axis: HeatmapAxis
  sortSpec: AxisOrderSpec | undefined
  onChange: (spec: AxisOrderSpec | undefined) => void
}

function AxisOrderControls({
  label,
  axis,
  sortSpec,
  onChange,
}: AxisOrderControlsProps) {
  const mode = orderModeFromSpec(sortSpec)
  const direction = directionFromSpec(sortSpec)
  const modes = availableOrderModes(axis)
  const showDirection = mode === 'measure' || mode.startsWith('group:')

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>{label} order</span>
        <select
          value={mode}
          onChange={event => {
            const nextMode = event.target.value as OrderMode
            onChange(specFromMode(nextMode, direction))
          }}
          className={cn(CONTROL_CLASS, 'min-w-[200px]')}
        >
          {modes.map(option => (
            <option key={option} value={option}>
              {ORDER_MODE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      {showDirection && (
        <label className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>{label} direction</span>
          <select
            value={direction}
            onChange={event => {
              const nextDirection = event.target.value as 'asc' | 'desc'
              onChange(specFromMode(mode, nextDirection))
            }}
            className={cn(CONTROL_CLASS, 'min-w-[100px]')}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </label>
      )}
    </>
  )
}

export function HeatmapFilters({ state, facets }: HeatmapFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const commit = (next: HeatmapState) => {
    startTransition(() => router.push(heatmapHref(next)))
  }

  const setAxis = (axis: 'x' | 'y', value: HeatmapAxis) => {
    if (axis === 'x') {
      const y = value === state.y ? otherHeatmapAxis(state.y, value) : state.y
      commit({
        ...state,
        x: value,
        y,
        rowOrder: undefined,
        colOrder: undefined,
        rowSort: undefined,
        colSort: undefined,
      })
      return
    }
    const x = value === state.x ? otherHeatmapAxis(state.x, value) : state.x
    commit({
      ...state,
      y: value,
      x,
      rowOrder: undefined,
      colOrder: undefined,
      rowSort: undefined,
      colSort: undefined,
    })
  }

  const setRowSort = (spec: AxisOrderSpec | undefined) => {
    commit({
      ...state,
      rowSort: spec,
      rowOrder: undefined,
    })
  }

  const setColSort = (spec: AxisOrderSpec | undefined) => {
    commit({
      ...state,
      colSort: spec,
      colOrder: undefined,
    })
  }

  return (
    <div className={cn('mb-5 space-y-4', isPending && 'opacity-60')}>
      <HideTestExperimentsToggle
        hideTestExperiments={state.hideTestExperiments}
        current={state}
        buildHref={heatmapHref}
        applyToggle={(current, hide) => ({
          ...current,
          hideTestExperiments: hide,
        })}
        isPending={isPending}
      />
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

      <div className="flex flex-wrap items-end gap-4">
        <AxisOrderControls
          label="Y axis"
          axis={state.y}
          sortSpec={state.rowSort}
          onChange={setRowSort}
        />
        <AxisOrderControls
          label="X axis"
          axis={state.x}
          sortSpec={state.colSort}
          onChange={setColSort}
        />
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
