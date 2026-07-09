import { ChartPanel, EmptyChartState } from '@/components/sweep/ChartPanel'
import {
  barPercent,
  measureMax,
  sortRowsByMeasure,
  sweepGroupLabel,
  sweepRowKey,
  type SweepChartProps,
} from '@/components/sweep/sweep-chart-utils'
import { cn } from '@/lib/cn'
import { formatCostCell, formatNumber } from '@/lib/format'

/** avg_cost per group as horizontal bars; total_cost + n in the row detail text. */
export function CostBarChart({ rows, groupKey, title, highlightValue }: SweepChartProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={title}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const sorted = sortRowsByMeasure(rows, groupKey, row => row.avg_cost)
  const max = measureMax(rows, row => row.avg_cost)

  return (
    <ChartPanel title={title} subtitle="Average provider cost per run; detail shows group total and n.">
      <ul className="flex flex-col gap-2">
        {sorted.map(row => {
          const label = sweepGroupLabel(row, groupKey)
          const costPercent = barPercent(row.avg_cost, max)
          const highlighted = highlightValue != null && row[groupKey] === highlightValue
          return (
            <li
              key={sweepRowKey(row)}
              className={cn(
                'grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_auto] items-center gap-3 px-1 py-0.5',
                highlighted && 'rounded-md bg-[var(--accent-bg)]',
              )}
            >
              <span
                className="truncate font-mono text-[12px] text-[var(--text-secondary)]"
                title={label}
              >
                {label}
              </span>
              <span className="relative block h-3 min-w-0 overflow-hidden rounded-sm bg-[var(--bg-tertiary)]">
                <span
                  data-bar="avg-cost"
                  className="absolute inset-y-0 left-0 rounded-sm bg-[var(--accent)] opacity-70"
                  style={{ width: `${costPercent}%` }}
                />
              </span>
              <span className="text-right font-mono text-[11px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                {row.avg_cost === null ? '—' : formatCostCell(row.avg_cost)}
                <span className="ml-2 text-[var(--text-muted)]">
                  Σ {row.total_cost === null ? '—' : formatCostCell(row.total_cost)} · n=
                  {formatNumber(row.n)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
