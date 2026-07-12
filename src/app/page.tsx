import Link from 'next/link'
import { BundleState } from '@/components/panels/BundleState'
import { Tag } from '@/components/primitives'
import { pinConfiguredBundle } from '@/lib/bundle-pins.server'
import { bundleFailure, type BundleViewFailure } from '@/lib/bundle-view'
import { getTableConfigs } from '@/lib/table-config'

export const dynamic = 'force-dynamic'

type PlaneStatus = { plane: 'Analysis' | 'Detail'; failure?: BundleViewFailure }

async function planeStatus(plane: 'analysis' | 'detail'): Promise<PlaneStatus> {
  try {
    await pinConfiguredBundle(plane)
    return { plane: plane === 'analysis' ? 'Analysis' : 'Detail' }
  } catch (error) {
    return { plane: plane === 'analysis' ? 'Analysis' : 'Detail', failure: bundleFailure(error) }
  }
}

export default async function Page() {
  const [tables, analysis, detail] = await Promise.all([
    Promise.resolve(getTableConfigs()),
    planeStatus('analysis'),
    planeStatus('detail'),
  ])

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag tone="accent">pinned publication bundles</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Unitbench
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          A read-only viewer for accepted benchmark results. Analysis and root-detail
          views are independently pinned to validated published bundles.
        </p>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {analysis.failure ? <BundleState plane={analysis.plane} failure={analysis.failure} /> : <p className="rounded-lg border border-[var(--green-border)] bg-[var(--green-bg)] px-4 py-3 text-sm text-[var(--green)]">Analysis bundle validated.</p>}
        {detail.failure ? <BundleState plane={detail.plane} failure={detail.failure} /> : <p className="rounded-lg border border-[var(--green-border)] bg-[var(--green-bg)] px-4 py-3 text-sm text-[var(--green)]">Detail root bundle validated.</p>}
      </div>

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {tables.map(table => (
          <Link
            key={table.id}
            href={`/tables/${table.id}`}
            className="group flex min-h-[178px] flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 transition-colors hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--border))] hover:bg-[var(--bg-hover)]"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent)]">
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 4.5H13.5" />
                <path d="M2.5 8H13.5" />
                <path d="M2.5 11.5H13.5" />
                <path d="M5 2.5V13.5" />
                <path d="M11 2.5V13.5" />
              </svg>
            </span>
            <h2 className="font-display text-[17px] font-semibold text-[var(--text-primary)]">
              {table.label}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {table.description}
            </p>
            <span className="mt-auto pt-4 text-[13px] font-medium text-[var(--accent)]">
              Open table
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
