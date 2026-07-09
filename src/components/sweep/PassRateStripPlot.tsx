import { ChartPanel, EmptyChartState } from '@/components/sweep/ChartPanel'
import { sweepRowKey } from '@/components/sweep/sweep-chart-utils'
import type { SweepMetricsRow } from '@/fixtures'

type PassRateStripPlotProps = {
  /** Must be the model×task grouping. */
  rows: SweepMetricsRow[]
  highlightTaskId?: string | null
}

const TITLE = 'Pass rate per task, by model'

type Facet = {
  label: string
  rows: SweepMetricsRow[]
}

function facetByModel(rows: SweepMetricsRow[]): Facet[] {
  const facets = new Map<string, SweepMetricsRow[]>()
  for (const row of rows) {
    const label = row.model ?? row.experiment_kind ?? 'all'
    const bucket = facets.get(label)
    if (bucket) {
      bucket.push(row)
    } else {
      facets.set(label, [row])
    }
  }
  return [...facets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, facetRows]) => ({ label, rows: facetRows }))
}

/**
 * Distribution proxy 2 — pass-rate strip plot over model×task rows: one facet
 * row per model, one dot per task at x = pass_rate on [0, 1]. Broken tasks are
 * low outlier dots repeated across facets; broken models are whole-row-low
 * facets.
 */
export function PassRateStripPlot({ rows, highlightTaskId }: PassRateStripPlotProps) {
  if (rows.length === 0) {
    return (
      <ChartPanel title={TITLE}>
        <EmptyChartState />
      </ChartPanel>
    )
  }

  const facets = facetByModel(rows)

  return (
    <ChartPanel
      title={TITLE}
      subtitle="One dot per task at its pass rate (0 → 1). A low dot repeated down the rows is a broken task; a whole low row is a broken model."
    >
      <ul className="flex flex-col gap-2">
        {facets.map(facet => (
          <li
            key={facet.label}
            className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2.6fr)] items-center gap-3 px-1 py-0.5"
          >
            <span
              className="truncate font-mono text-[12px] text-[var(--text-secondary)]"
              title={facet.label}
            >
              {facet.label}
            </span>
            <svg
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              className="h-5 w-full min-w-0"
              aria-hidden="true"
            >
              <line x1={0} x2={100} y1={6} y2={6} stroke="var(--border)" strokeWidth={0.8} />
              {[0, 25, 50, 75, 100].map(tick => (
                <line
                  key={tick}
                  x1={tick}
                  x2={tick}
                  y1={2.5}
                  y2={9.5}
                  stroke="var(--border-subtle)"
                  strokeWidth={0.6}
                />
              ))}
              {facet.rows.map(row => {
                if (row.pass_rate === null || !Number.isFinite(row.pass_rate)) return null
                const x = Math.max(0, Math.min(100, row.pass_rate * 100))
                const highlighted =
                  highlightTaskId != null && row.task_id === highlightTaskId
                return (
                  <circle
                    key={sweepRowKey(row)}
                    data-task-id={row.task_id ?? undefined}
                    data-pass-rate={row.pass_rate}
                    data-highlighted={highlighted || undefined}
                    cx={x}
                    cy={6}
                    r={highlighted ? 3.2 : 2.2}
                    fill={highlighted ? 'var(--accent)' : 'var(--text-muted)'}
                    fillOpacity={highlighted ? 1 : 0.55}
                  >
                    <title>{`${facet.label} · ${row.task_id ?? 'all tasks'}: pass rate ${row.pass_rate.toFixed(3)}`}</title>
                  </circle>
                )
              })}
            </svg>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-[minmax(120px,1fr)_minmax(0,2.6fr)] gap-3 px-1">
        <span />
        <span className="flex justify-between font-mono text-[10px] text-[var(--text-muted)] tabular-nums">
          <span>0</span>
          <span>0.5</span>
          <span>1</span>
        </span>
      </div>
    </ChartPanel>
  )
}
