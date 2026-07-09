import { ChartPanel, EmptyChartState } from '@/components/sweep/ChartPanel'
import {
  barPercent,
  formatMs,
  measureMax,
  sortRowsByMeasure,
  sweepGroupLabel,
  sweepRowKey,
  type SweepChartProps,
} from '@/components/sweep/sweep-chart-utils'
import { cn } from '@/lib/cn'

/**
 * Latency per group: dumbbell/range bar from avg_latency_ms to p95_latency_ms
 * with dots at both ends, shared x-scale across rows. The generator guarantees
 * p95 >= avg; hand-built rows are clamped so ranges are never negative.
 */
export function LatencyRangeChart({ rows, groupKey, title, highlightValue }: SweepChartProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={title}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const sorted = sortRowsByMeasure(rows, groupKey, row => row.avg_latency_ms)
  const max = Math.max(
    measureMax(rows, row => row.avg_latency_ms),
    measureMax(rows, row => row.p95_latency_ms),
  )

  return (
    <ChartPanel title={title} subtitle="Dumbbell from average to p95 latency; shared scale across rows.">
      <ul className="flex flex-col gap-2">
        {sorted.map(row => {
          const label = sweepGroupLabel(row, groupKey)
          const hasLatency = row.avg_latency_ms !== null || row.p95_latency_ms !== null
          const avgX = barPercent(row.avg_latency_ms ?? row.p95_latency_ms, max)
          const p95X = Math.max(avgX, barPercent(row.p95_latency_ms, max))
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
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="h-3 w-full min-w-0"
                aria-hidden="true"
              >
                <line x1={0} x2={100} y1={5} y2={5} stroke="var(--border)" strokeWidth={0.8} />
                {hasLatency && (
                  <>
                    <line
                      data-latency="range"
                      x1={avgX}
                      x2={p95X}
                      y1={5}
                      y2={5}
                      stroke="var(--accent)"
                      strokeWidth={2.4}
                    />
                    <circle data-latency="avg" cx={avgX} cy={5} r={2.6} fill="var(--accent)" />
                    <circle data-latency="p95" cx={p95X} cy={5} r={2.6} fill="var(--text-muted)" />
                  </>
                )}
              </svg>
              <span className="text-right font-mono text-[11px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                {formatMs(row.avg_latency_ms)} → {formatMs(row.p95_latency_ms)}
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
