import type { Metadata } from 'next'
import { CompressionResultCard } from '@/components/compression/CompressionResultCard'
import { SECTION_LABEL } from '@/components/primitives'
import { makeCompressionResultRows, type CompressionResultRow } from '@/fixtures/compression'
import { formatRatio, ratioDomainMax } from '@/lib/compression-view'
import { EDGE_CASE_ROWS } from './demo-rows'

export const metadata: Metadata = {
  title: 'Compression results demo · Unitbench',
}

const DEMO_SEED = 7
const DEMO_TASK_COUNT = 3
const DEMO_TARGET_RATIOS = [0.25, 0.5, 1.0, 2.0] as const

function groupByTarget(
  rows: CompressionResultRow[],
): { target: number; rows: CompressionResultRow[] }[] {
  return DEMO_TARGET_RATIOS.map(target => ({
    target,
    rows: rows.filter(row => row.target_compression_ratio === target),
  })).filter(group => group.rows.length > 0)
}

export default function CompressionResultsDemoPage() {
  const rows = makeCompressionResultRows({
    seed: DEMO_SEED,
    taskCount: DEMO_TASK_COUNT,
    targetRatios: DEMO_TARGET_RATIOS,
    samplesPerTarget: 1,
  })
  const groups = groupByTarget(rows)

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Compression results (fixture demo)
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Lower ratio = tighter compression; 1.0 = no compression. Fake data from{' '}
          <code className="font-mono text-[12px]">
            makeCompressionResultRows(seed {DEMO_SEED})
          </code>
          , {DEMO_TASK_COUNT} tasks × 2 models × targets{' '}
          {DEMO_TARGET_RATIOS.map(formatRatio).join(', ')}. Cards within a target
          section share one ratio axis.
        </p>
      </header>

      {groups.map(group => {
        const domainMax = ratioDomainMax(group.rows)
        return (
          <section key={group.target} className="flex flex-col gap-3">
            <h2 className={SECTION_LABEL}>Target {formatRatio(group.target)}</h2>
            <div className="flex flex-col gap-4">
              {group.rows.map(row => (
                <CompressionResultCard
                  key={row.identity.prediction_id}
                  row={row}
                  ratioDomainMax={domainMax}
                />
              ))}
            </div>
          </section>
        )
      })}

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_LABEL}>Edge cases (hand-authored)</h2>
        <div className="flex flex-col gap-5">
          {EDGE_CASE_ROWS.map(edgeCase => (
            <div key={edgeCase.label} className="flex flex-col gap-1.5">
              <p className="text-sm text-[var(--text-secondary)]">{edgeCase.label}</p>
              <CompressionResultCard row={edgeCase.row} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
