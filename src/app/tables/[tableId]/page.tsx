import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GenericTable } from '@/components/GenericTable'
import { TableFilters } from '@/components/TableFilters'
import { TableExploreAggregatesLink } from '@/components/TableExploreAggregatesLink'
import { TableHideTestExperimentsToggle } from '@/components/TableHideTestExperimentsToggle'
import { TableQuickFilters } from '@/components/TableQuickFilters'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { Dot, Tag } from '@/components/primitives'
import { getTableFacets, getTablePage } from '@/lib/table-data'
import { UnknownTableError } from '@/lib/table-config'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ tableId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ tableId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])

  let tablePage
  try {
    tablePage = await getTablePage(tableId, resolvedSearchParams)
  } catch (error) {
    if (error instanceof UnknownTableError) notFound()
    throw error
  }

  const facets =
    tablePage.status === 'ok'
      ? await getTableFacets(tablePage.config, tablePage.state)
      : {}

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">&lt;-</span> Back to tables
        </Link>
      </div>

      <header className="mb-7 max-w-[980px]">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Tag mono>{tablePage.config.table.name}</Tag>
          <Dot />
          <span>{tablePage.config.columns.length} visible columns</span>
        </div>
        <h1 className="font-display text-[28px] leading-tight font-bold text-[var(--text-primary)]">
          {tablePage.config.label}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {tablePage.config.description}
        </p>
      </header>

      {tablePage.status === 'missing-url' && (
        <ErrorSection
          tone="setup"
          title="DATABASE_URL not configured"
          message="Set DATABASE_URL locally or in Vercel before reading this Neon table."
        />
      )}

      {tablePage.status === 'error' && (
        <ErrorSection title="Failed to load table" message={tablePage.message} />
      )}

      {tablePage.status === 'ok' && (
        <>
          <TableHideTestExperimentsToggle
            tableId={tableId}
            state={tablePage.state}
          />
          <TableQuickFilters tableId={tableId} state={tablePage.state} />
          <TableExploreAggregatesLink tableId={tableId} state={tablePage.state} />
          <TableFilters
            config={tablePage.config}
            state={tablePage.state}
            facets={facets}
          />
          <GenericTable
            config={tablePage.config}
            state={tablePage.state}
            rows={tablePage.rows}
            total={tablePage.total}
            totalPages={tablePage.totalPages}
          />
        </>
      )}
    </div>
  )
}
