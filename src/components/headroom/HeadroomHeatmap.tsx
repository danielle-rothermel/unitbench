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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { HeadroomColorLegend } from '@/components/headroom/HeadroomColorLegend'
import { HeadroomFacetPanel } from '@/components/headroom/HeadroomFacetPanel'
import { HeadroomHeatmapControls } from '@/components/headroom/HeadroomHeatmapControls'
import type { HeadroomPoint } from '@/fixtures/heatmap'
import { cn } from '@/lib/cn'
import {
  buildHeadroomGrid,
  type HeadroomFacetGrid,
  type HeadroomGrid,
} from '@/lib/headroom-heatmap-grid'
import { applyManualOrder, manualOrderOrUndefined, moveItem } from '@/lib/heatmap-order'
import {
  headroomHeatmapHref,
  toBinConfig,
  type HeadroomHeatmapState,
} from '@/lib/headroom-heatmap-params'

const OVERLAY_LABEL = 'All models (combined counts)'
const X_AXIS_TITLE = 'achieved compression ratio →'
const Y_AXIS_TITLE = 'mean pass rate ↑'
const EMPTY_MESSAGE = 'No headroom points to bin.'

export type HeadroomHeatmapProps = {
  points: HeadroomPoint[]
  state: HeadroomHeatmapState
}

/**
 * Pure drag-end order computation, exported for direct unit testing: moves
 * activeKey next to overKey and collapses back to undefined when the result
 * matches the baseline (so default order stays out of the URL).
 */
export function facetOrderAfterDrag(
  current: string[],
  baseline: string[],
  activeKey: string,
  overKey: string,
): string[] | undefined {
  const oldIndex = current.indexOf(activeKey)
  const newIndex = current.indexOf(overKey)
  if (oldIndex < 0 || newIndex < 0) {
    return manualOrderOrUndefined(current, baseline)
  }
  return manualOrderOrUndefined(moveItem(current, oldIndex, newIndex), baseline)
}

type SortableFacetPanelProps = {
  facet: HeadroomFacetGrid
  grid: HeadroomGrid
}

function SortableFacetPanel({ facet, grid }: SortableFacetPanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: facet.facet_key })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <HeadroomFacetPanel
        facet={facet}
        xEdges={grid.x_edges}
        yEdges={grid.y_edges}
        maxCount={grid.max_facet_count}
        label={facet.facet_key}
        dragHandle={
          <button
            type="button"
            className="mr-1.5 inline-flex cursor-grab text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label={`Drag facet ${facet.facet_key}`}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        }
      />
    </div>
  )
}

export function HeadroomHeatmap({ points, state }: HeadroomHeatmapProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const grid = useMemo(() => buildHeadroomGrid(points, toBinConfig(state)), [points, state])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const commit = (next: HeadroomHeatmapState) => {
    startTransition(() => router.push(headroomHeatmapHref(next)))
  }

  const baseline = grid ? grid.facets.map(facet => facet.facet_key) : []
  const orderedKeys = applyManualOrder(baseline, state.facetOrder)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    commit({
      ...state,
      facetOrder: facetOrderAfterDrag(
        orderedKeys,
        baseline,
        String(active.id),
        String(over.id),
      ),
    })
  }

  const showResetOrder = state.view === 'facets' && Boolean(state.facetOrder?.length)
  const showClampNote = Boolean(state.x_domain && grid && grid.clamped_count > 0)

  return (
    <section className={cn(isPending && 'opacity-60')}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <HeadroomHeatmapControls
          state={state}
          onCommit={commit}
          showResetOrder={showResetOrder}
        />
        {grid && (
          <HeadroomColorLegend
            max={state.view === 'overlay' ? grid.max_overlay_count : grid.max_facet_count}
          />
        )}
      </div>

      {!grid ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          {EMPTY_MESSAGE}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex shrink-0 items-center">
            <span className="rotate-180 text-[11px] whitespace-nowrap text-[var(--text-muted)] [writing-mode:vertical-rl]">
              {Y_AXIS_TITLE}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            {state.view === 'overlay' ? (
              <div className="max-w-[640px]">
                <HeadroomFacetPanel
                  facet={grid.overlay}
                  xEdges={grid.x_edges}
                  yEdges={grid.y_edges}
                  maxCount={grid.max_overlay_count}
                  label={OVERLAY_LABEL}
                />
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={orderedKeys} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {orderedKeys.flatMap(key => {
                      const facet = grid.facets.find(item => item.facet_key === key)
                      return facet ? (
                        [<SortableFacetPanel key={key} facet={facet} grid={grid} />]
                      ) : (
                        []
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
              {X_AXIS_TITLE}
            </p>
            {showClampNote && grid && (
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {grid.clamped_count} of {points.length} points fall outside the fixed X
                domain; edge bins include out-of-range points.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
