import { AggregateControls } from '@/components/AggregateControls'
import { AggregatePageShell } from '@/components/AggregatePageShell'
import { AggregateTable } from '@/components/AggregateTable'
import { ErrorSection } from '@/components/panels/ErrorSection'
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
    aggregatePage.status === 'ok' ? await getAggregateFacets() : {}

  return (
    <AggregatePageShell
      title="Aggregation"
      description="Group and filter prediction rows to explore aggregate patterns. Choose dimensions to group by, then sort the table by any measure."
      crossLink={{
        href: '/aggregate/heatmap',
        label: 'View model × experiment kind heatmap →',
      }}
    >
      {aggregatePage.status === 'missing-url' && (
        <ErrorSection
          tone="setup"
          title="DATABASE_URL not configured"
          message="Set DATABASE_URL locally or in Vercel before reading this Neon table."
        />
      )}

      {aggregatePage.status === 'error' && (
        <ErrorSection
          title="Failed to load aggregates"
          message={aggregatePage.message}
        />
      )}

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
