import { AggregatePageShell } from '@/components/AggregatePageShell'
import { HeatmapFilters } from '@/components/HeatmapFilters'
import { BundleState } from '@/components/panels/BundleState'
import { ScoreHeatmap } from '@/components/ScoreHeatmap'
import { getHeatmapPage } from '@/lib/aggregate-data'
import { heatmapTitle } from '@/lib/heatmap-config'
import { parseHeatmapState } from '@/lib/heatmap-params'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const state = parseHeatmapState(resolvedSearchParams)

  const heatmapPage = await getHeatmapPage(state)

  return (
    <AggregatePageShell
      title={heatmapTitle(state.x, state.y)}
      description="Pick X/Y axes and a color metric, then filter rows. Lower values appear more red — useful for spotting models that fail across flows or budget settings."
      crossLink={{
        href: '/aggregate',
        label: 'View flexible aggregation →',
      }}
    >
      {heatmapPage.status === 'failure' && <BundleState plane="Analysis" failure={heatmapPage.failure} />}
      {heatmapPage.status === 'ok' && (
        <>
          <HeatmapFilters state={state} facets={heatmapPage.facets} />
          <ScoreHeatmap rows={[...heatmapPage.rows]} state={state} />
        </>
      )}
    </AggregatePageShell>
  )
}
