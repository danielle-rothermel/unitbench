import { StatCell } from '@/components/stats/StatCell'
import { formatCostCell, formatNumber } from '@/lib/format'
import type { SweepMetricsRow } from '@/fixtures'

type SweepSummaryStripProps = {
  rows: SweepMetricsRow[]
}

type SweepTotals = {
  n: number
  passCount: number
  errorCount: number
  rateLimitCount: number
  totalCost: number | null
}

/** Counts and total_cost are additive across pre-grouped rows; no avg math. */
function sumTotals(rows: SweepMetricsRow[]): SweepTotals {
  const totals: SweepTotals = {
    n: 0,
    passCount: 0,
    errorCount: 0,
    rateLimitCount: 0,
    totalCost: null,
  }
  for (const row of rows) {
    totals.n += row.n
    totals.passCount += row.pass_count
    totals.errorCount += row.error_count
    totals.rateLimitCount += row.rate_limit_count
    if (row.total_cost !== null && Number.isFinite(row.total_cost)) {
      totals.totalCost = (totals.totalCost ?? 0) + row.total_cost
    }
  }
  return totals
}

/** KPI strip: total n, overall pass rate, total cost, error count, rate-limit count. */
export function SweepSummaryStrip({ rows }: SweepSummaryStripProps) {
  const totals = sumTotals(rows)
  const passRate = totals.n > 0 ? totals.passCount / totals.n : null

  return (
    <section
      aria-label="Sweep summary"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-5"
    >
      <StatCell label="Total runs" value={formatNumber(totals.n)} mono />
      <StatCell
        label="Pass rate"
        value={passRate === null ? '—' : `${(passRate * 100).toFixed(1)}%`}
        sub={passRate === null ? 'no runs' : `${formatNumber(totals.passCount)} passed`}
        mono
      />
      <StatCell
        label="Total cost"
        value={totals.totalCost === null ? '—' : formatCostCell(totals.totalCost)}
        mono
      />
      <StatCell label="API errors" value={formatNumber(totals.errorCount)} mono />
      <StatCell label="Rate limited" value={formatNumber(totals.rateLimitCount)} mono />
    </section>
  )
}
