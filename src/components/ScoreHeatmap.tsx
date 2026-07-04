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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useMemo,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { measureLabel } from '@/lib/aggregate-config'
import { formatCostCell, formatNumber } from '@/lib/format'
import {
  heatmapAxisLabel,
  heatmapTitle,
  type SortMeasure,
} from '@/lib/heatmap-config'
import {
  HEAT_HIGH,
  HEAT_LOW,
  HEAT_TEXT_DARK_CSS,
  mixHeat,
  rgbCss,
} from '@/lib/heatmap-color'
import {
  buildHeatmapPivot,
  manualOrderOrUndefined,
  moveItem,
  resolveAxisOrders,
  type HeatmapCell,
} from '@/lib/heatmap-order'
import { heatmapHref, type HeatmapState } from '@/lib/heatmap-params'
import { heatmapCellPredictionsHref } from '@/lib/predictions-nav'
import type { TableRow } from '@/lib/table-data'

type ScoreHeatmapProps = {
  rows: TableRow[]
  state: HeatmapState
}

const emptySubscribe = () => () => {}

function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

type DragBinding = {
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
  handleProps: HTMLAttributes<HTMLButtonElement>
}

function formatMeasure(value: number | null, measure: SortMeasure): string {
  if (value === null || Number.isNaN(value)) return '—'
  if (measure === 'n') return formatNumber(value)
  if (measure === 'avg_cost') return formatCostCell(value)
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
    return rgbCss(mixHeat(0.5))
  }
  const t = (value - min) / (max - min)
  return rgbCss(mixHeat(t))
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

function useDragBinding(id: string): DragBinding {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return {
    setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    },
    handleProps: { ...attributes, ...listeners },
  }
}

type ColumnHeaderCellProps = {
  xVal: string
  drag?: DragBinding
}

function ColumnHeaderCell({ xVal, drag }: ColumnHeaderCellProps) {
  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      role="columnheader"
      aria-label={xVal}
      className="bg-[var(--bg-secondary)] px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
    >
      <button
        type="button"
        className="inline-flex max-w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        {...(drag?.handleProps ?? {})}
        aria-label={`Drag column ${xVal}`}
      >
        <DragHandle />
        <span className="truncate">{xVal}</span>
      </button>
    </div>
  )
}

function SortableColumnHeader({ xVal }: { xVal: string }) {
  const drag = useDragBinding(colDndId(xVal))
  return <ColumnHeaderCell xVal={xVal} drag={drag} />
}

type HeatmapRowProps = {
  yVal: string
  xValues: string[]
  cells: Map<string, Map<string, HeatmapCell>>
  colorMeasure: SortMeasure
  min: number
  max: number
  gridTemplateColumns: string
  state: HeatmapState
  drag?: DragBinding
}

function HeatmapRow({
  yVal,
  xValues,
  cells,
  colorMeasure,
  min,
  max,
  gridTemplateColumns,
  state,
  drag,
}: HeatmapRowProps) {
  return (
    <div
      ref={drag?.setNodeRef}
      style={{ ...drag?.style, gridTemplateColumns }}
      role="row"
      className="col-span-full grid gap-px bg-[var(--border)]"
    >
      <div
        role="rowheader"
        aria-label={yVal}
        className="bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)]"
        title={yVal}
      >
        <button
          type="button"
          className="inline-flex max-w-full items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          {...(drag?.handleProps ?? {})}
          aria-label={`Drag row ${yVal}`}
        >
          <DragHandle />
          <span className="truncate">{yVal}</span>
        </button>
      </div>
      {xValues.map(xVal => {
        const cell = cells.get(yVal)?.get(xVal)
        const value = cell?.value ?? null
        const formatted = formatMeasure(value, colorMeasure)
        const hasValue = isFiniteScore(value)
        const cellHref = heatmapCellPredictionsHref(state, yVal, xVal)
        const title = cell
          ? `${colorMeasure}=${formatted}, n=${cell.n}. View matching predictions →`
          : 'No data'
        return (
          <div
            key={`${yVal}-${xVal}`}
            role="gridcell"
            className="min-w-0"
            style={{ backgroundColor: scoreColor(value, min, max) }}
          >
            <Link
              href={cellHref}
              aria-label={`${yVal}, ${xVal}: ${formatted}`}
              className={cn(
                'block px-3 py-2 text-right font-mono text-[12px] hover:ring-2 hover:ring-[var(--accent)] hover:ring-inset',
                !hasValue && 'text-[var(--text-muted)]',
              )}
              style={hasValue ? { color: HEAT_TEXT_DARK_CSS } : undefined}
              title={title}
            >
              {formatted}
            </Link>
          </div>
        )
      })}
    </div>
  )
}

function SortableHeatmapRow(props: Omit<HeatmapRowProps, 'drag'>) {
  const drag = useDragBinding(rowDndId(props.yVal))
  return <HeatmapRow {...props} drag={drag} />
}

function HeaderRow({
  yAxis,
  gridTemplateColumns,
  children,
}: {
  yAxis: HeatmapState['y']
  gridTemplateColumns: string
  children: ReactNode
}) {
  return (
    <div
      role="row"
      className="col-span-full grid gap-px bg-[var(--border)]"
      style={{ gridTemplateColumns }}
    >
      <div
        role="columnheader"
        aria-label={heatmapAxisLabel(yAxis)}
        className="bg-[var(--bg-secondary)] px-3 py-2 text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
      >
        {heatmapAxisLabel(yAxis)}
      </div>
      {children}
    </div>
  )
}

export function ScoreHeatmap({ rows, state }: ScoreHeatmapProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // dnd-kit's DndContext generates client-only aria-describedby ids that
  // do not exist in the server HTML; mounting it only after hydration
  // keeps the server and first client render identical.
  const dndReady = useHydrated()
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

  const rowProps = {
    xValues,
    cells,
    colorMeasure,
    min,
    max,
    gridTemplateColumns,
    state,
  }

  const grid = (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <div
        role="grid"
        aria-label={heatmapTitle(xAxis, yAxis)}
        className="grid min-w-max grid-cols-1 gap-px bg-[var(--border)] p-px"
      >
        <HeaderRow yAxis={yAxis} gridTemplateColumns={gridTemplateColumns}>
          {dndReady ? (
            <SortableContext
              items={xValues.map(colDndId)}
              strategy={horizontalListSortingStrategy}
            >
              {xValues.map(xVal => (
                <SortableColumnHeader key={xVal} xVal={xVal} />
              ))}
            </SortableContext>
          ) : (
            xValues.map(xVal => <ColumnHeaderCell key={xVal} xVal={xVal} />)
          )}
        </HeaderRow>

        {dndReady ? (
          <SortableContext
            items={yValues.map(rowDndId)}
            strategy={verticalListSortingStrategy}
          >
            {yValues.map(yVal => (
              <SortableHeatmapRow key={yVal} yVal={yVal} {...rowProps} />
            ))}
          </SortableContext>
        ) : (
          yValues.map(yVal => (
            <HeatmapRow key={yVal} yVal={yVal} {...rowProps} />
          ))
        )}
      </div>
    </div>
  )

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
          <p className="mt-1 max-w-[72ch] text-sm text-[var(--text-secondary)]">
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
              background: `linear-gradient(to right, ${rgbCss(HEAT_LOW)}, ${rgbCss(HEAT_HIGH)})`,
            }}
          />
          <span>{formatMeasure(max, colorMeasure)}</span>
        </div>
      </div>

      {dndReady ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {grid}
        </DndContext>
      ) : (
        grid
      )}
    </section>
  )
}
