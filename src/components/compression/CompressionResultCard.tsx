import type { CompressionResultRow } from '@/fixtures/compression'
import { ResultBadge, SECTION_LABEL, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import { formatRatio, ratioDomainMax } from '@/lib/compression-view'
import { formatNumber } from '@/lib/format'
import { CharCountFlow } from '@/components/compression/CharCountFlow'
import { CompressionMethodTable } from '@/components/compression/CompressionMethodTable'
import { CompressionRatioBullet } from '@/components/compression/CompressionRatioBullet'

type CompressionResultCardProps = {
  row: CompressionResultRow
  /**
   * Upper bound of the ratio scale (from ratioDomainMax over the rows being
   * shown) so sibling cards share one comparable axis. Defaults to the row's
   * own domain.
   */
  ratioDomainMax?: number
}

function formatScore(score: number | null): string {
  if (score === null) return '—'
  return formatNumber(score)
}

export function CompressionResultCard({
  row,
  ratioDomainMax: sharedDomainMax,
}: CompressionResultCardProps) {
  const domainMax = sharedDomainMax ?? ratioDomainMax([row])

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <Tag mono>{row.identity.task_id}</Tag>
        <Tag mono>{row.identity.model}</Tag>
        <Tag>sample #{row.identity.sample_index}</Tag>
        <Tag tone="blue">{row.identity.experiment_kind}</Tag>
        <span className="ml-auto flex items-center gap-2">
          <ResultBadge state={row.result_state} size="sm" />
          <span className="font-mono text-[12px] text-[var(--text-secondary)]">
            score {formatScore(row.score)}
          </span>
        </span>
      </header>
      <div className="grid grid-cols-4 gap-px border-b border-[var(--border-subtle)] bg-[var(--border-subtle)] max-md:grid-cols-2">
        <StatCell label="Target ratio" value={formatRatio(row.target_compression_ratio)} mono />
        <StatCell
          label="Achieved ratio"
          value={formatRatio(row.achieved_compression_ratio)}
          mono
        />
        <StatCell label="Best codec ratio" value={formatRatio(row.best_compression_ratio)} mono />
        <StatCell
          label="Encoder char budget"
          value={row.encoder_char_budget !== null ? formatNumber(row.encoder_char_budget) : '—'}
          mono
        />
      </div>
      <div className="flex flex-col gap-5 px-4 py-4">
        <section className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Target vs achieved</span>
          <CompressionRatioBullet
            target_compression_ratio={row.target_compression_ratio}
            achieved_compression_ratio={row.achieved_compression_ratio}
            best_compression_ratio={row.best_compression_ratio}
            domainMax={domainMax}
          />
        </section>
        <section className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Character counts</span>
          <CharCountFlow
            ground_truth_char_count={row.ground_truth_char_count}
            encoded_char_count={row.encoded_char_count}
            generated_char_count={row.generated_char_count}
            encoder_char_budget={row.encoder_char_budget}
          />
        </section>
        <section className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Per-method compression</span>
          <CompressionMethodTable
            metrics={row.compression_metrics}
            best_compression_ratio={row.best_compression_ratio}
            domainMax={domainMax}
          />
        </section>
      </div>
    </article>
  )
}
