import { AggregatePageShell } from '@/components/AggregatePageShell'
import { HeatmapFilters } from '@/components/HeatmapFilters'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'
import { getAggregateFacets, getHeatmapRows } from '@/lib/aggregate-data'
import { MissingDatabaseUrlError } from '@/lib/neon'
import { parseHeatmapState } from '@/lib/heatmap-params'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const state = parseHeatmapState(resolvedSearchParams)

  let facets: Awaited<ReturnType<typeof getAggregateFacets>> = {}
  let heatmapRows: Awaited<ReturnType<typeof getHeatmapRows>> = []
  let status: 'ok' | 'missing-url' | 'error' = 'ok'
  let errorMessage = ''

  try {
    facets = await getAggregateFacets()
    heatmapRows = await getHeatmapRows(state)
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      status = 'missing-url'
    } else {
      status = 'error'
      errorMessage = error instanceof Error ? error.message : String(error)
    }
  }

  return (
    <AggregatePageShell
      title="Model × experiment kind"
      description="Compare average scores across models and experiment kinds. Low scores appear more red — useful for spotting models that fail in both direct and enc-dec flows."
      crossLink={{
        href: '/aggregate',
        label: 'View flexible aggregation →',
      }}
    >
      {status === 'missing-url' && (
        <ErrorSection
          tone="setup"
          title="DATABASE_URL not configured"
          message="Set DATABASE_URL locally or in Vercel before reading this Neon table."
        />
      )}

      {status === 'error' && (
        <ErrorSection title="Failed to load heatmap" message={errorMessage} />
      )}

      {status === 'ok' && (
        <>
          <HeatmapFilters state={state} facets={facets} />
          <ScoreHeatmap rows={heatmapRows} />
        </>
      )}
    </AggregatePageShell>
  )
}
