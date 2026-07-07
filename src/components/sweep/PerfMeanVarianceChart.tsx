import { ChartPanel, EmptyChartState } from '@/components/sweep/ChartPanel'
import {
  sortRowsByMeasure,
  sweepGroupLabel,
  sweepRowKey,
  type SweepChartProps,
} from '@/components/sweep/sweep-chart-utils'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

/** Clamp a score-domain value to [0, 100] percent; scores live on [0, 1]. */
function scorePercent(value: number): number {
  return Math.max(0, Math.min(100, value * 100))
}

/**
 * Perf mean + variance per group: avg_score bar on a fixed [0, 1] domain with
 * a ±stddev_score whisker overlay; n annotated per row. Whisker is omitted
 * (not zero-length) when stddev_score is null, and clamped to the domain
 * because mean ± stddev can exceed [0, 1] for mid pass rates.
 */
export function PerfMeanVarianceChart({ rows, groupKey, title, highlightValue }: SweepChartProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={title}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const sorted = sortRowsByMeasure(rows, groupKey, row => row.avg_score)

  return (
    <ChartPanel title={title} subtitle="Average score on a fixed 0–1 scale; whisker spans ±1 stddev.">
      <ul className="flex flex-col gap-2">
        {sorted.map(row => {
          const label = sweepGroupLabel(row, groupKey)
          const avgScore =
            row.avg_score !== null && Number.isFinite(row.avg_score) ? row.avg_score : null
          const stddevScore =
            row.stddev_score !== null && Number.isFinite(row.stddev_score)
              ? row.stddev_score
              : null
          const hasScore = avgScore !== null
          const hasWhisker = avgScore !== null && stddevScore !== null
          const meanPercent = avgScore === null ? 0 : scorePercent(avgScore)
          const whiskerLeft = hasWhisker ? scorePercent(avgScore - stddevScore) : 0
          const whiskerRight = hasWhisker ? scorePercent(avgScore + stddevScore) : 0
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
                {hasScore && (
                  <span
                    data-bar="avg-score"
                    className="absolute inset-y-0 left-0 rounded-sm bg-[var(--green)] opacity-60"
                    style={{ width: `${meanPercent}%` }}
                  />
                )}
                {hasWhisker && (
                  <span
                    data-bar="stddev-whisker"
                    className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--text-primary)]"
                    style={{
                      left: `${whiskerLeft}%`,
                      width: `${whiskerRight - whiskerLeft}%`,
                    }}
                  />
                )}
              </span>
              <span className="text-right font-mono text-[11px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                {row.avg_score === null ? '—' : row.avg_score.toFixed(3)}
                {row.stddev_score !== null && ` ±${row.stddev_score.toFixed(3)}`}
                <span className="ml-2 text-[var(--text-muted)]">n={formatNumber(row.n)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
