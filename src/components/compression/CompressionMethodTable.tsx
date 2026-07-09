import { COMPRESSION_METHODS } from '@/fixtures/primitives'
import type { CompressionMetric, CompressionResultRow } from '@/fixtures/compression'
import { Tag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { bestMetric, formatRatio, ratioPercent } from '@/lib/compression-view'
import { formatBytes } from '@/lib/format'

const HEADER_CELL =
  'px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase'
const NUMBER_CELL = 'px-3 py-1.5 text-right font-mono text-[12px]'

type CompressionMethodTableProps = {
  metrics: CompressionMetric[]
  best_compression_ratio: CompressionResultRow['best_compression_ratio']
  /** Shared ratio-axis max so the inline bars reconcile with the bullet above. */
  domainMax: number
}

function orderByFixtureMethods(metrics: CompressionMetric[]): CompressionMetric[] {
  return COMPRESSION_METHODS.flatMap(method =>
    metrics.filter(metric => metric.method === method),
  )
}

function formatPercentReduction(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

export function CompressionMethodTable({
  metrics,
  best_compression_ratio,
  domainMax,
}: CompressionMethodTableProps) {
  if (metrics.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-[12px] text-[var(--text-muted)] italic">
        No compression metrics recorded for this sample.
      </p>
    )
  }

  const best = bestMetric(metrics)
  const ordered = orderByFixtureMethods(metrics)
  const bestMismatch =
    best !== null &&
    best_compression_ratio !== null &&
    best.ratio_to_ground_truth !== best_compression_ratio

  return (
    <div className="flex flex-col gap-1.5">
      <table className="w-full border-collapse text-[var(--text-primary)]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            <th className={HEADER_CELL}>method</th>
            <th className={cn(HEADER_CELL, 'text-right')}>representation</th>
            <th className={cn(HEADER_CELL, 'text-right')}>compressed</th>
            <th className={HEADER_CELL}>ratio</th>
            <th className={cn(HEADER_CELL, 'text-right')}>% reduction</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(metric => {
            const isBest = metric === best
            return (
              <tr
                key={metric.method}
                data-testid={`method-row-${metric.method}`}
                className={cn(
                  'border-b border-[var(--border-subtle)]',
                  isBest && 'bg-[var(--green-bg)]',
                )}
              >
                <td className="px-3 py-1.5 font-mono text-[12px]">
                  <span className="inline-flex items-center gap-2">
                    {metric.method}
                    {isBest && <Tag tone="green">best</Tag>}
                  </span>
                </td>
                <td className={NUMBER_CELL}>{formatBytes(metric.representation_bytes)}</td>
                <td className={NUMBER_CELL}>{formatBytes(metric.compressed_bytes)}</td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="relative h-2 w-24 shrink-0 rounded-sm bg-[var(--bg-tertiary)]">
                      {metric.ratio_to_ground_truth !== null && (
                        <span
                          data-testid={`ratio-bar-${metric.method}`}
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-sm',
                            isBest ? 'bg-[var(--green)]' : 'bg-[var(--text-muted)]',
                          )}
                          style={{
                            width: `${ratioPercent(metric.ratio_to_ground_truth, domainMax)}%`,
                          }}
                        />
                      )}
                    </span>
                    <span className="font-mono text-[12px]">
                      {formatRatio(metric.ratio_to_ground_truth)}
                    </span>
                  </span>
                </td>
                <td className={NUMBER_CELL}>
                  {formatPercentReduction(metric.percent_reduction_vs_ground_truth)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {bestMismatch && (
        <span className="text-[11px] text-[var(--yellow)]">
          headline best {formatRatio(best_compression_ratio)} does not match the table
          minimum {formatRatio(best.ratio_to_ground_truth)}
        </span>
      )}
    </div>
  )
}
