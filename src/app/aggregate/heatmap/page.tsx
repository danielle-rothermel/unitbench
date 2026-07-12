import { AggregatePageShell } from '@/components/AggregatePageShell'
import { HeatmapFilters } from '@/components/HeatmapFilters'
import { BundleState } from '@/components/panels/BundleState'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'
import { getHeatmapFacets, getHeatmapRows } from '@/lib/aggregate-data'
import { heatmapTitle } from '@/lib/heatmap-config'
import { bundleFailure, type BundleViewFailure } from '@/lib/bundle-view'
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
  let failure: BundleViewFailure | null = null

  try {
    facets = await getHeatmapFacets(state)
    heatmapRows = await getHeatmapRows(state)
  } catch (error) {
    failure = bundleFailure(error)
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
      {failure && <BundleState plane="Analysis" failure={failure} />}
      {!failure && (
        <>
          <HeatmapFilters state={state} facets={facets} />
          <ScoreHeatmap rows={heatmapRows} state={state} />
        </>
      )}
    </AggregatePageShell>
  )
}
