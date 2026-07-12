import { AggregateControls } from '@/components/AggregateControls'
import { AggregatePageShell } from '@/components/AggregatePageShell'
import { AggregateTable } from '@/components/AggregateTable'
import { BundleState } from '@/components/panels/BundleState'
import { getAggregateFacets, getAggregatePage } from '@/lib/aggregate-data'
import { parseAggregateState } from '@/lib/aggregate-params'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const state = parseAggregateState(resolvedSearchParams)
  const aggregatePage = await getAggregatePage(state)

  const facets =
    aggregatePage.status === 'ok' ? await getAggregateFacets(aggregatePage.state) : {}

  return (
    <AggregatePageShell
      title="Aggregation"
      description="Group and filter prediction rows to explore aggregate patterns. Choose dimensions to group by, then sort the table by any measure."
      crossLink={{
        href: '/aggregate/heatmap',
        label: 'View model × experiment kind heatmap →',
      }}
    >
      {aggregatePage.status === 'failure' && <BundleState plane="Analysis" failure={aggregatePage.failure} />}

      {aggregatePage.status === 'ok' && (
        <>
          <AggregateControls state={aggregatePage.state} facets={facets} />
          <AggregateTable
            aggregateState={aggregatePage.state}
            tableConfig={aggregatePage.tableConfig}
            rows={aggregatePage.rows}
            total={aggregatePage.total}
            totalPages={aggregatePage.totalPages}
          />
        </>
      )}
    </AggregatePageShell>
  )
}
