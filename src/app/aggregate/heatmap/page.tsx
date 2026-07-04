import { AggregatePageShell } from '@/components/AggregatePageShell'
import { HeatmapFilters } from '@/components/HeatmapFilters'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'
import { getHeatmapFacets, getHeatmapRows } from '@/lib/aggregate-data'
import { heatmapTitle } from '@/lib/heatmap-config'
import { MissingDatabaseUrlError } from '@/lib/neon'
import { parseHeatmapState } from '@/lib/heatmap-params'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const state = parseHeatmapState(resolvedSearchParams)

  let facets: Awaited<ReturnType<typeof getHeatmapFacets>> = {}
  let heatmapRows: Awaited<ReturnType<typeof getHeatmapRows>> = []
  let status: 'ok' | 'missing-url' | 'error' = 'ok'
  let errorMessage = ''

  try {
    facets = await getHeatmapFacets(state)
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
      title={heatmapTitle(state.x, state.y)}
      description="Pick X/Y axes and a color metric, then filter rows. Lower values appear more red — useful for spotting models that fail across flows or budget settings."
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
          <ScoreHeatmap rows={heatmapRows} state={state} />
        </>
      )}
    </AggregatePageShell>
  )
}
