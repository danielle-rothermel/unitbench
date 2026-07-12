import { ErrorSection } from '@/components/panels/ErrorSection'
import { Tag } from '@/components/primitives'
import { BundleReadError } from '@/lib/bundle-adapter.server'
import {
  fetchCompressionDistribution,
  fetchCorrectnessCompressionPoints,
  type CompressionDistributionBin,
  type CorrectnessCompressionPoint,
} from '@/lib/read-layer'
import { DashboardCharts } from './DashboardCharts'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let points: CorrectnessCompressionPoint[] = []
  let distribution: CompressionDistributionBin[] = []
  let status: 'ok' | 'missing-url' | 'error' = 'ok'
  let errorMessage = ''

  try {
    ;[points, distribution] = await Promise.all([
      fetchCorrectnessCompressionPoints(),
      fetchCompressionDistribution(),
    ])
  } catch (error) {
    if (error instanceof BundleReadError && error.code === 'STORE_NOT_CONFIGURED') {
      status = 'missing-url'
    } else {
      status = 'error'
      errorMessage = error instanceof Error ? error.message : String(error)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag mono>predictions</Tag>
          <Tag>enc-dec runs</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Correctness against compression for encoder–decoder runs. Every
          scatter point is one prediction — click it to open the sample
          detail. The distribution below covers all qualifying predictions.
        </p>
      </header>

      {status === 'missing-url' && (
        <ErrorSection
          tone="setup"
          title="Analysis store not configured"
          message="Set ANALYSIS_DATABASE_URL and ANALYSIS_PUBLICATION_DESTINATION_ID before reading a pinned bundle."
        />
      )}
      {status === 'error' && (
        <ErrorSection
          tone="error"
          title="Pinned Analysis bundle read failed"
          message={errorMessage}
        />
      )}
      {status === 'ok' && (
        <DashboardCharts points={points} distribution={distribution} />
      )}
    </div>
  )
}
