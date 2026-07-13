import { BundleState } from '@/components/panels/BundleState'
import { Tag } from '@/components/primitives'
import { bundleFailure, type BundleViewFailure } from '@/lib/bundle-view'
import { fetchDashboardRead, type DashboardRead } from '@/lib/read-layer'
import { DashboardCharts } from './DashboardCharts'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let read: DashboardRead | null = null
  let failure: BundleViewFailure | null = null

  try {
    read = await fetchDashboardRead()
  } catch (error) {
    failure = bundleFailure(error)
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

      {failure && <BundleState plane="Analysis" failure={failure} />}
      {!failure && read && <><p className="mb-3 font-mono text-[11px] text-[var(--text-muted)]">Pinned Analysis bundle {read.bundle.bundle_id} · snapshot {read.bundle.snapshot_seq}</p><DashboardCharts points={[...read.points]} distribution={[...read.distribution]} /></>}
    </div>
  )
}
