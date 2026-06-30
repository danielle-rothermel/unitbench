'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { measureLabel } from '@/lib/aggregate-config'
import { formatNumber } from '@/lib/format'
import {
  heatmapAxisLabel,
  heatmapTitle,
  type SortMeasure,
} from '@/lib/heatmap-config'
import {
  buildHeatmapPivot,
  manualOrderOrUndefined,
  moveItem,
  resolveAxisOrders,
  type HeatmapCell,
} from '@/lib/heatmap-order'
import { heatmapHref, type HeatmapState } from '@/lib/heatmap-params'
import type { TableRow } from '@/lib/table-data'

type ScoreHeatmapProps = {
  rows: TableRow[]
  state: HeatmapState
}

function formatMeasure(value: number | null, measure: SortMeasure): string {
  if (value === null || Number.isNaN(value)) return '—'
  if (measure === 'n') return formatNumber(value)
  if (measure === 'avg_cost') return formatNumber(value)
  return value.toFixed(3)
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function scoreColor(value: number | null, min: number, max: number): string {
  if (!isFiniteScore(value)) {
    return 'var(--bg-secondary)'
  }
  if (max <= min) {
    return 'rgb(220, 38, 38)'
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const red = Math.round(220 - t * 150)
  const green = Math.round(40 + t * 140)
  const blue = Math.round(38 + t * 60)
  return `rgb(${red}, ${green}, ${blue})`
}

function colDndId(xVal: string): string {
  return `col:${xVal}`
}

function rowDndId(yVal: string): string {
  return `row:${yVal}`
}

function DragHandle() {
  return (
    <span
      className="mr-1.5 inline-block cursor-grab text-[var(--text-muted)] active:cursor-grabbing"
      aria-hidden
    >
      ⠿
    </span>
  )
}

type SortableColumnHeaderProps = {
  xVal: string
}

function SortableColumnHeader({ xVal }: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: colDndId(xVal) })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
    >
      <button
        type="button"
        className="inline-flex max-w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        {...attributes}
        {...listeners}
        aria-label={`Drag column ${xVal}`}
      >
        <DragHandle />
        <span className="truncate">{xVal}</span>
      </button>
    </div>
  )
}

type SortableHeatmapRowProps = {
  yVal: string
  xValues: string[]
  cells: Map<string, Map<string, HeatmapCell>>
  colorMeasure: SortMeasure
  min: number
  max: number
  gridTemplateColumns: string
}

function SortableHeatmapRow({
  yVal,
  xValues,
  cells,
  colorMeasure,
  min,
  max,
  gridTemplateColumns,
}: SortableHeatmapRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowDndId(yVal) })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        gridTemplateColumns,
      }}
      className="col-span-full grid gap-px bg-[var(--border)]"
    >
      <div
        className="bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)]"
        title={yVal}
      >
        <button
          type="button"
          className="inline-flex max-w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          {...attributes}
          {...listeners}
          aria-label={`Drag row ${yVal}`}
        >
          <DragHandle />
          <span className="truncate">{yVal}</span>
        </button>
      </div>
      {xValues.map(xVal => {
        const cell = cells.get(yVal)?.get(xVal)
        const value = cell?.value ?? null
        const background = scoreColor(value, min, max)
        const textClass =
          isFiniteScore(value) && value < (min + max) / 2
            ? 'text-white'
            : 'text-[var(--text-primary)]'
        return (
          <div
            key={`${yVal}-${xVal}`}
            className={cn(
              'bg-[var(--bg-primary)] px-3 py-2 text-right font-mono text-[12px]',
              textClass,
            )}
            style={{ backgroundColor: background }}
            title={
              cell
                ? `${colorMeasure}=${formatMeasure(value, colorMeasure)}, n=${cell.n}`
                : 'No data'
            }
          >
            {formatMeasure(value, colorMeasure)}
          </div>
        )
      })}
    </div>
  )
}

export function ScoreHeatmap({ rows, state }: ScoreHeatmapProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { x: xAxis, y: yAxis, color: colorMeasure } = state

  const pivot = useMemo(
    () => buildHeatmapPivot(rows, yAxis, xAxis, colorMeasure),
    [rows, yAxis, xAxis, colorMeasure],
  )

  const { yValues, xValues, yBaseline, xBaseline, cells } = useMemo(
    () =>
      resolveAxisOrders(pivot, {
        yAxis,
        xAxis,
        colorMeasure,
        rowSort: state.rowSort,
        colSort: state.colSort,
        rowOrder: state.rowOrder,
        colOrder: state.colOrder,
      }),
    [
      pivot,
      yAxis,
      xAxis,
      colorMeasure,
      state.rowSort,
      state.colSort,
      state.rowOrder,
      state.colOrder,
    ],
  )

  const gridTemplateColumns = `minmax(220px, 1.4fr) repeat(${xValues.length}, minmax(120px, 1fr))`

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const commit = (next: HeatmapState) => {
    startTransition(() => router.push(heatmapHref(next)))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('col:') && overId.startsWith('col:')) {
      const activeKey = activeId.slice(4)
      const overKey = overId.slice(4)
      const oldIndex = xValues.indexOf(activeKey)
      const newIndex = xValues.indexOf(overKey)
      if (oldIndex < 0 || newIndex < 0) return
      const nextOrder = moveItem(xValues, oldIndex, newIndex)
      commit({
        ...state,
        colOrder: manualOrderOrUndefined(nextOrder, xBaseline),
      })
      return
    }

    if (activeId.startsWith('row:') && overId.startsWith('row:')) {
      const activeKey = activeId.slice(4)
      const overKey = overId.slice(4)
      const oldIndex = yValues.indexOf(activeKey)
      const newIndex = yValues.indexOf(overKey)
      if (oldIndex < 0 || newIndex < 0) return
      const nextOrder = moveItem(yValues, oldIndex, newIndex)
      commit({
        ...state,
        rowOrder: manualOrderOrUndefined(nextOrder, yBaseline),
      })
    }
  }

  const hasCustomOrder = Boolean(
    state.rowOrder?.length ||
      state.colOrder?.length ||
      state.rowSort ||
      state.colSort,
  )

  if (yValues.length === 0 || xValues.length === 0) {
    return (
      <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        No heatmap data for the current filters.
      </div>
    )
  }

  const colorValues = yValues.flatMap(yVal =>
    xValues
      .map(xVal => cells.get(yVal)?.get(xVal)?.value)
      .filter(isFiniteScore),
  )
  const min = colorValues.length > 0 ? Math.min(...colorValues) : 0
  const max = colorValues.length > 0 ? Math.max(...colorValues) : 1
  const colorLabel = measureLabel(colorMeasure)

  return (
    <section className={cn('mb-8', isPending && 'opacity-60')}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              {heatmapTitle(xAxis, yAxis)}
            </h2>
            {hasCustomOrder && (
              <button
                type="button"
                onClick={() =>
                  commit({
                    ...state,
                    rowOrder: undefined,
                    colOrder: undefined,
                    rowSort: undefined,
                    colSort: undefined,
                  })
                }
                className="text-[12px] text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Reset order
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {colorLabel} by {heatmapAxisLabel(yAxis).toLowerCase()} and{' '}
            {heatmapAxisLabel(xAxis).toLowerCase()}. Use axis order controls to sort
            or group; drag headers to tweak. Applying a new sort overwrites manual
            drag order. Enc-dec model labels like{' '}
            <code className="font-mono text-[12px]">model -&gt; model</code> are
            collapsed to the same row as direct runs when model is on an axis. Lower
            values appear more red. All cells share the same color scale.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-[var(--text-muted)] sm:flex">
          <span>{formatMeasure(min, colorMeasure)}</span>
          <div
            className="h-3 w-24 rounded-sm border border-[var(--border)]"
            style={{
              background:
                'linear-gradient(to right, rgb(220, 38, 38), rgb(70, 180, 98))',
            }}
          />
          <span>{formatMeasure(max, colorMeasure)}</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <div
            className="grid min-w-max gap-px bg-[var(--border)] p-px"
            style={{ gridTemplateColumns }}
          >
            <div className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
              {heatmapAxisLabel(yAxis)}
            </div>
            <SortableContext
              items={xValues.map(colDndId)}
              strategy={horizontalListSortingStrategy}
            >
              {xValues.map(xVal => (
                <SortableColumnHeader key={xVal} xVal={xVal} />
              ))}
            </SortableContext>

            <SortableContext
              items={yValues.map(rowDndId)}
              strategy={verticalListSortingStrategy}
            >
              {yValues.map(yVal => (
                <SortableHeatmapRow
                  key={yVal}
                  yVal={yVal}
                  xValues={xValues}
                  cells={cells}
                  colorMeasure={colorMeasure}
                  min={min}
                  max={max}
                  gridTemplateColumns={gridTemplateColumns}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      </DndContext>
    </section>
  )
}
