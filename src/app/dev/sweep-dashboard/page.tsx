import { SweepDashboard } from '@/components/sweep/SweepDashboard'
import { makeSweepMetricsRows } from '@/fixtures'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** ?seed=N reruns the generator for quick visual fuzzing; invalid/missing → 1. */
function parseSeed(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || !/^\d+$/.test(raw)) return 1
  return Number.parseInt(raw, 10)
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const seed = parseSeed(resolvedSearchParams.seed)
  const perModel = makeSweepMetricsRows({ seed, groupBy: ['model'] })
  const perTask = makeSweepMetricsRows({ seed, groupBy: ['task_id'] })
  const perModelTask = makeSweepMetricsRows({ seed, groupBy: ['model', 'task_id'] })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Sweep dashboard (dev)
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Renders against makeSweepMetricsRows fixture data (current seed: {seed}).
          Append <code className="font-mono text-[12px]">?seed=N</code> to rerun the
          generator with a different seed.
        </p>
      </div>
      <SweepDashboard
        perModel={perModel}
        perTask={perTask}
        perModelTask={perModelTask}
      />
    </div>
  )
}
