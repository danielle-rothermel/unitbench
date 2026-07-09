import { ChartPanel, EmptyChartState } from '@/components/sweep/ChartPanel'
import {
  sortRowsByMeasure,
  sweepGroupLabel,
  sweepRowKey,
  type SweepChartProps,
} from '@/components/sweep/sweep-chart-utils'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { SweepMetricsRow } from '@/fixtures'

/** Color semantics match ResultBadge: passed/failed/pending/error. */
const OUTCOME_SEGMENTS = [
  { outcome: 'passed', pick: (row: SweepMetricsRow) => row.pass_count, color: 'var(--green)' },
  { outcome: 'failed', pick: (row: SweepMetricsRow) => row.fail_count, color: 'var(--red)' },
  { outcome: 'pending', pick: (row: SweepMetricsRow) => row.pending_count, color: 'var(--yellow)' },
  { outcome: 'error', pick: (row: SweepMetricsRow) => row.error_count, color: 'var(--blue)' },
] as const

/**
 * Distribution proxy 1 — outcome mix: 100%-stacked bar per group of
 * pass/fail/pending/error counts. Broken groups jump out as color shifts.
 */
export function OutcomeMixChart({ rows, groupKey, title, highlightValue }: SweepChartProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={title}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const sorted = sortRowsByMeasure(rows, groupKey, row => row.pass_rate)

  return (
    <ChartPanel
      title={title}
      subtitle="Share of runs by outcome: passed (green), failed (red), pending (yellow), API error (blue)."
    >
      <ul className="flex flex-col gap-2">
        {sorted.map(row => {
          const label = sweepGroupLabel(row, groupKey)
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
              <span className="flex h-3 min-w-0 overflow-hidden rounded-sm bg-[var(--bg-tertiary)]">
                {row.n > 0 &&
                  OUTCOME_SEGMENTS.map(({ outcome, pick, color }) => {
                    const count = pick(row)
                    if (count <= 0) return null
                    const percent = Math.max(0, Math.min(100, (count / row.n) * 100))
                    return (
                      <span
                        key={outcome}
                        data-outcome={outcome}
                        title={`${label}: ${formatNumber(count)} ${outcome} (${percent.toFixed(1)}%)`}
                        className="block h-full"
                        style={{ width: `${percent}%`, backgroundColor: color }}
                      />
                    )
                  })}
              </span>
              <span className="text-right font-mono text-[11px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                {row.pass_rate === null ? '—' : `${(row.pass_rate * 100).toFixed(1)}% pass`}
                <span className="ml-2 text-[var(--text-muted)]">n={formatNumber(row.n)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
