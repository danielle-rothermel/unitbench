import type { ReactNode } from 'react'
import { countColor } from '@/components/headroom/HeadroomColorLegend'
import type { HeadroomHeatmapCell } from '@/fixtures/heatmap'
import { formatEdge, type HeadroomFacetGrid } from '@/lib/headroom-heatmap-grid'
import { cn } from '@/lib/cn'

const EMPTY_CELL_TOOLTIP = 'No tasks'
/** Beyond this many bins per axis, label every other edge to avoid collisions. */
const MAX_FULLY_LABELED_BINS = 10

type HeadroomFacetPanelProps = {
  facet: HeadroomFacetGrid
  xEdges: number[]
  yEdges: number[]
  /** Shared across panels within a view so equal color = equal count. */
  maxCount: number
  label: string
  dragHandle?: ReactNode
}

function edgeStep(edges: number[]): number {
  return (edges[edges.length - 1] - edges[0]) / (edges.length - 1)
}

function cellTooltip(cell: HeadroomHeatmapCell, xStep: number, yStep: number, xBinCount: number, yBinCount: number): string {
  if (cell.count === 0) return EMPTY_CELL_TOOLTIP
  const xClose = cell.x_bin_index === xBinCount - 1 ? ']' : ')'
  const yClose = cell.y_bin_index === yBinCount - 1 ? ']' : ')'
  const noun = cell.count === 1 ? 'task' : 'tasks'
  return `x ∈ [${formatEdge(cell.x_min, xStep)}, ${formatEdge(cell.x_max, xStep)}${xClose} · pass rate ∈ [${formatEdge(cell.y_min, yStep)}, ${formatEdge(cell.y_max, yStep)}${yClose} · ${cell.count} ${noun}`
}

function showTick(index: number, binCount: number): boolean {
  if (binCount <= MAX_FULLY_LABELED_BINS) return true
  return index % 2 === 0 || index === binCount
}

/**
 * One facet's 2D histogram: CSS-grid cells with hairline gaps, edge-aligned
 * numeric ticks, and native-title tooltips. Y bins render top-down in
 * descending order so pass rate 1.0 sits at the top (the headroom corner).
 */
export function HeadroomFacetPanel({
  facet,
  xEdges,
  yEdges,
  maxCount,
  label,
  dragHandle,
}: HeadroomFacetPanelProps) {
  const xBinCount = xEdges.length - 1
  const yBinCount = yEdges.length - 1
  const xStep = edgeStep(xEdges)
  const yStep = edgeStep(yEdges)
  const rowsTopDown = [...facet.rows].reverse()

  return (
    <section
      data-facet-panel={facet.facet_key}
      className="min-w-0 max-w-[560px] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          {dragHandle}
          <h3
            className="truncate font-mono text-[12px] font-medium text-[var(--text-secondary)]"
            title={label}
          >
            {label}
          </h3>
        </div>
        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
          {facet.point_count} tasks·targets
        </span>
      </header>

      <div
        className="grid gap-x-1.5"
        style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}
      >
        <div className="relative w-7" aria-hidden="true">
          {yEdges.map(
            (edge, index) =>
              showTick(index, yBinCount) && (
                <span
                  key={index}
                  className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none text-[var(--text-muted)]"
                  style={{ top: `${((yBinCount - index) / yBinCount) * 100}%` }}
                >
                  {formatEdge(edge, yStep)}
                </span>
              ),
          )}
        </div>

        <div
          className="grid gap-px rounded-md border border-[var(--border)] bg-[var(--border)] p-px"
          style={{ gridTemplateColumns: `repeat(${xBinCount}, minmax(0, 1fr))` }}
        >
          {rowsTopDown.flatMap(row =>
            row.map(cell => (
              <div
                key={`${cell.x_bin_index}:${cell.y_bin_index}`}
                data-cell={`${cell.x_bin_index}:${cell.y_bin_index}`}
                className={cn('aspect-square min-w-0', cell.count > 0 && 'rounded-[1px]')}
                style={{ backgroundColor: countColor(cell.count, maxCount) }}
                title={cellTooltip(cell, xStep, yStep, xBinCount, yBinCount)}
              />
            )),
          )}
        </div>

        <div aria-hidden="true" />
        <div className="relative mt-1 h-3.5" aria-hidden="true">
          {xEdges.map(
            (edge, index) =>
              showTick(index, xBinCount) && (
                <span
                  key={index}
                  className="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-[var(--text-muted)]"
                  style={{ left: `${(index / xBinCount) * 100}%` }}
                >
                  {formatEdge(edge, xStep)}
                </span>
              ),
          )}
        </div>
      </div>
    </section>
  )
}
