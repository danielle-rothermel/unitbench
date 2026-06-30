import { cn } from '@/lib/cn'
import { measureLabel } from '@/lib/aggregate-config'
import { formatNumber } from '@/lib/format'
import {
  heatmapAxisLabel,
  heatmapTitle,
  type HeatmapAxis,
  type SortMeasure,
} from '@/lib/heatmap-config'
import type { TableRow } from '@/lib/table-data'

type ScoreHeatmapProps = {
  rows: TableRow[]
  xAxis: HeatmapAxis
  yAxis: HeatmapAxis
  colorMeasure: SortMeasure
}

type HeatmapCell = {
  value: number | null
  n: number
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

function parseScore(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function pivotRows(
  rows: TableRow[],
  yAxis: HeatmapAxis,
  xAxis: HeatmapAxis,
  colorMeasure: SortMeasure,
): {
  yValues: string[]
  xValues: string[]
  cells: Map<string, Map<string, HeatmapCell>>
} {
  const xSet = new Set<string>()
  const cellMap = new Map<string, Map<string, HeatmapCell>>()

  for (const row of rows) {
    const yVal = String(row[yAxis] ?? '')
    const xVal = String(row[xAxis] ?? '')
    if (!yVal || !xVal) continue
    xSet.add(xVal)
    const value = parseScore(row[colorMeasure])
    const nRaw = row.n
    const n =
      typeof nRaw === 'number'
        ? nRaw
        : Number.parseInt(String(nRaw ?? '0'), 10) || 0
    if (!cellMap.has(yVal)) cellMap.set(yVal, new Map())
    cellMap.get(yVal)?.set(xVal, { value, n })
  }

  const xValues = [...xSet].sort()
  const yValues = [...cellMap.keys()].sort((left, right) => {
    const leftValues = xValues
      .map(xVal => cellMap.get(left)?.get(xVal)?.value)
      .filter(isFiniteScore)
    const rightValues = xValues
      .map(xVal => cellMap.get(right)?.get(xVal)?.value)
      .filter(isFiniteScore)
    const leftMin =
      leftValues.length > 0 ? Math.min(...leftValues) : Number.POSITIVE_INFINITY
    const rightMin =
      rightValues.length > 0 ? Math.min(...rightValues) : Number.POSITIVE_INFINITY
    if (leftMin !== rightMin) return leftMin - rightMin
    return left.localeCompare(right)
  })

  return { yValues, xValues, cells: cellMap }
}

export function ScoreHeatmap({
  rows,
  xAxis,
  yAxis,
  colorMeasure,
}: ScoreHeatmapProps) {
  const { yValues, xValues, cells } = pivotRows(
    rows,
    yAxis,
    xAxis,
    colorMeasure,
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
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            {heatmapTitle(xAxis, yAxis)}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {colorLabel} by {heatmapAxisLabel(yAxis).toLowerCase()} and{' '}
            {heatmapAxisLabel(xAxis).toLowerCase()}. Enc-dec model labels like{' '}
            <code className="font-mono text-[12px]">model -&gt; model</code> are
            collapsed to the same row as direct runs when model is on an axis.
            Lower values appear more red. All cells share the same color scale.
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

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <div
          className="grid min-w-max gap-px bg-[var(--border)] p-px"
          style={{
            gridTemplateColumns: `minmax(220px, 1.4fr) repeat(${xValues.length}, minmax(120px, 1fr))`,
          }}
        >
          <div className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
            {heatmapAxisLabel(yAxis)}
          </div>
          {xValues.map(xVal => (
            <div
              key={xVal}
              className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
            >
              {xVal}
            </div>
          ))}

          {yValues.map(yVal => (
            <div key={yVal} className="contents">
              <div
                className="bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)]"
                title={yVal}
              >
                <span className="block truncate">{yVal}</span>
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
                      'px-3 py-2 text-right font-mono text-[12px]',
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
          ))}
        </div>
      </div>
    </section>
  )
}
