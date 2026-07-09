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
import { formatNumber } from '@/lib/format'

/**
 * Rate-limit / API-error counts per group. One horizontal bar per row:
 * error_count outer bar with the rate_limit_count share as a darker inner
 * segment; pending_count as a second thin bar. Sorted desc by error_count.
 */
export function ErrorRateChart({ rows, groupKey, title, highlightValue }: SweepChartProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={title}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const sorted = sortRowsByMeasure(rows, groupKey, row => row.error_count)
  const max = Math.max(
    measureMax(rows, row => row.error_count),
    measureMax(rows, row => row.pending_count),
  )

  return (
    <ChartPanel
      title={title}
      subtitle="API errors per group; the darker segment is the rate-limited share. Thin bar: pending runs."
    >
      <ul className="flex flex-col gap-2">
        {sorted.map(row => {
          const label = sweepGroupLabel(row, groupKey)
          const rateLimitCount = Math.min(row.rate_limit_count, row.error_count)
          const errorPercent = barPercent(row.error_count, max)
          const rateLimitPercent = barPercent(rateLimitCount, max)
          const pendingPercent = barPercent(row.pending_count, max)
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
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="relative block h-3 overflow-hidden rounded-sm bg-[var(--bg-tertiary)]">
                  <span
                    data-bar="error"
                    className="absolute inset-y-0 left-0 rounded-sm bg-[var(--blue)] opacity-40"
                    style={{ width: `${errorPercent}%` }}
                  />
                  <span
                    data-bar="rate-limit"
                    className="absolute inset-y-0 left-0 rounded-sm bg-[var(--blue)]"
                    style={{ width: `${rateLimitPercent}%` }}
                  />
                </span>
                <span className="relative block h-[4px] overflow-hidden rounded-sm bg-[var(--bg-tertiary)]">
                  <span
                    data-bar="pending"
                    className="absolute inset-y-0 left-0 rounded-sm bg-[var(--yellow)]"
                    style={{ width: `${pendingPercent}%` }}
                  />
                </span>
              </span>
              <span className="text-right font-mono text-[11px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                {formatNumber(row.error_count)} err · {formatNumber(rateLimitCount)} rl ·{' '}
                {formatNumber(row.pending_count)} pend
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
